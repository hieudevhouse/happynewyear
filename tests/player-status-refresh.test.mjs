import test from 'node:test';
import assert from 'node:assert/strict';
import { createPlayerRefreshController } from '../src/state/playerRefresh.js';
import { startStatusPolling } from '../src/state/statusPolling.js';
import { createServerClock } from '../src/lib/serverClock.js';

const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
const flush = async () => { for (let i = 0; i < 8; i += 1) await Promise.resolve(); };

function environment() {
  const visibility = new EventTarget();
  visibility.visibilityState = 'visible';
  const focusTarget = new EventTarget();
  const timers = new Map();
  let nextTimer = 0;
  return {
    visibility, focusTarget, timers,
    schedule: (callback, ms) => { timers.set(++nextTimer, { callback, ms }); return nextTimer; },
    cancel: id => timers.delete(id),
    tick() {
      const entry = timers.entries().next().value;
      assert.ok(entry, 'a refresh should be scheduled');
      const [id, timer] = entry;
      timers.delete(id);
      assert.equal(timer.ms, 15000);
      timer.callback();
    },
    show(state) { visibility.visibilityState = state; visibility.dispatchEvent(new Event('visibilitychange')); }
  };
}

test('bank status polling refreshes immediately, waits for slow requests, and stops cleanly', async () => {
  const env = environment();
  const requests = [];
  const stop = startStatusPolling({ ...env, refresh: ({ signal }) => {
    const request = { ...deferred(), signal };
    requests.push(request);
    return request.promise;
  } });
  assert.equal(requests.length, 1);
  assert.equal(env.timers.size, 0, 'a slow request must not overlap with an interval');
  requests[0].resolve();
  await flush();
  env.tick();
  assert.equal(requests.length, 2);
  stop();
  assert.equal(requests[1].signal.aborted, true);
  requests[1].resolve();
  await flush();
  assert.equal(env.timers.size, 0);
  env.focusTarget.dispatchEvent(new Event('focus'));
  env.show('visible');
  assert.equal(requests.length, 2, 'a paid or unmounted player must not resume polling');
});

test('hidden tabs cancel refreshes and returning to the tab immediately rechecks payment', async () => {
  const env = environment();
  const requests = [];
  const failures = [];
  const stop = startStatusPolling({ ...env, onError: error => failures.push(error), refresh: ({ signal }) => {
    const request = { ...deferred(), signal };
    requests.push(request);
    return request.promise;
  } });
  env.show('hidden');
  assert.equal(requests[0].signal.aborted, true);
  requests[0].reject(new Error('canceled'));
  await flush();
  assert.equal(env.timers.size, 0);
  assert.equal(failures.length, 0);
  env.show('visible');
  assert.equal(requests.length, 2);
  requests[1].resolve();
  await flush();
  env.focusTarget.dispatchEvent(new Event('focus'));
  assert.equal(requests.length, 3);
  requests[2].reject(new Error('offline'));
  await flush();
  assert.equal(failures[0].message, 'offline');
  assert.equal(env.timers.size, 1, 'temporary failure should leave later retries enabled');
  stop();
});

test('a slow status GET cannot overwrite a newer QR save or payment confirmation', async () => {
  let player = { code: 'TET2027', redemption: { method: 'bank', status: 'pending', recipientQr: { publicId: 'old' } } };
  const pending = deferred();
  let requestSignal;
  const sync = createPlayerRefreshController({
    getPlayer: () => player,
    applyPlayer: next => { player = next; },
    fetchPlayer: signal => { requestSignal = signal; return pending.promise; }
  });
  const oldRefresh = sync.refresh();
  assert.equal(sync.refresh(), oldRefresh, 'manual and background refreshes share one GET');
  const token = sync.invalidate();
  const saved = { code: 'TET2027', redemption: { method: 'bank', status: 'paid', recipientQr: { publicId: 'new' } } };
  assert.equal(sync.commit(saved, token, 'TET2027'), true);
  assert.equal(requestSignal.aborted, true);
  // Simulate a server/fetch implementation that still delivers a canceled GET.
  pending.resolve({ code: 'TET2027', redemption: { method: 'bank', status: 'pending', recipientQr: { publicId: 'old' } } });
  await assert.rejects(oldRefresh, { name: 'AbortError' });
  assert.equal(player, saved);
});

test('a status GET started during a QR save cannot overwrite that completed save', async () => {
  let player = { code: 'TET2027', redemption: { method: 'bank', status: 'pending', recipientQr: { publicId: 'old' } } };
  const pending = deferred();
  let requestSignal;
  const sync = createPlayerRefreshController({
    getPlayer: () => player,
    applyPlayer: next => { player = next; },
    fetchPlayer: signal => { requestSignal = signal; return pending.promise; }
  });
  const mutationToken = sync.invalidate();
  const duringSave = sync.refresh();
  const saved = { code: 'TET2027', redemption: { method: 'bank', status: 'pending', recipientQr: { publicId: 'new' } } };
  assert.equal(sync.commit(saved, mutationToken, 'TET2027'), true);
  assert.equal(requestSignal.aborted, true);
  pending.resolve({ code: 'TET2027', redemption: { method: 'bank', status: 'pending', recipientQr: { publicId: 'old' } } });
  await assert.rejects(duringSave, { name: 'AbortError' });
  assert.equal(player, saved);
});

test('changing code invalidates both an old GET and an old mutation response', async () => {
  let player = { code: 'FIRST' };
  const pending = deferred();
  const sync = createPlayerRefreshController({
    getPlayer: () => player,
    applyPlayer: next => { player = next; },
    fetchPlayer: () => pending.promise
  });
  const firstToken = sync.invalidate();
  const request = sync.refresh();
  const nextToken = sync.invalidate();
  sync.apply({ code: 'SECOND' }, nextToken);
  assert.equal(sync.apply({ code: 'FIRST', name: 'Late name' }, firstToken, 'FIRST'), false);
  pending.resolve({ code: 'FIRST' });
  await assert.rejects(request, { name: 'AbortError' });
  assert.equal(player.code, 'SECOND');
});

test('a changed server session is reported instead of silently replacing the active code', async () => {
  const player = { code: 'FIRST' };
  let applied = false;
  const sync = createPlayerRefreshController({
    getPlayer: () => player,
    applyPlayer: () => { applied = true; },
    fetchPlayer: async () => ({ code: 'SECOND' })
  });
  await assert.rejects(sync.refresh(), /Phiên nhận lộc đã thay đổi/);
  assert.equal(applied, false);
});

test('QR countdown uses server time and keeps ticking when the device clock changes', () => {
  let deviceTime = Date.parse('2036-01-01T00:00:00Z');
  let tick = 100;
  const clock = createServerClock({ wallNow: () => deviceTime, steadyNow: () => tick });
  assert.equal(clock.sync('Wed, 21 Oct 2026 12:00:00 GMT', { requestStartedAt: 0, responseReceivedAt: 100 }), true);
  const synced = clock.now();
  assert.equal(synced, Date.parse('2026-10-21T12:00:00Z') + 50);
  deviceTime = Date.parse('2000-01-01T00:00:00Z');
  tick += 1000;
  assert.equal(clock.now(), synced + 1000);
  assert.equal(clock.sync(null), false);
  assert.equal(clock.now(), synced + 1000);
});

test('an older response cannot move the countdown back after a newer server time sample', () => {
  let tick = 200;
  const clock = createServerClock({ wallNow: () => 0, steadyNow: () => tick });
  clock.sync('Wed, 21 Oct 2026 12:00:10 GMT', { requestStartedAt: 100, responseReceivedAt: tick });
  const latest = clock.now();
  tick += 100;
  assert.equal(clock.sync('Wed, 21 Oct 2026 12:00:00 GMT', { requestStartedAt: 50, responseReceivedAt: tick }), false);
  assert.equal(clock.now(), latest + 100);
});
