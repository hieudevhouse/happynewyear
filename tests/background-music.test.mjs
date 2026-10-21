import assert from 'node:assert/strict';
import test from 'node:test';
import { createBackgroundMusic } from '../src/lib/backgroundMusic.js';

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function mockMusic(t, { supported = true, deferredPlay = false, metadata = true, seekError = false } = {}) {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'Audio');
  const elements = [];
  const statuses = [];

  class Audio {
    listeners = new Map();
    readyState = metadata ? 1 : 0;
    paused = true;
    position = 0;
    playCalls = [];
    pauseCalls = 0;
    loadCalls = 0;
    seekError = seekError;

    constructor(src) {
      this.src = src;
      elements.push(this);
    }
    get currentTime() { return this.position; }
    set currentTime(value) {
      if (!this.readyState || this.seekError) throw new Error('Cannot seek');
      this.position = value;
    }
    addEventListener(type, listener) { this.listeners.set(type, listener); }
    removeEventListener(type, listener) {
      if (this.listeners.get(type) === listener) this.listeners.delete(type);
    }
    emit(type) { this.listeners.get(type)?.(); }
    play() {
      const request = deferred();
      this.playCalls.push({ ...request, position: this.position, muted: this.muted });
      if (!deferredPlay) {
        this.paused = false;
        request.resolve();
      }
      return request.promise;
    }
    completePlay(index) {
      this.paused = false;
      this.playCalls[index].resolve();
    }
    pause() { this.pauseCalls += 1; this.paused = true; this.emit('pause'); }
    removeAttribute(name) { if (name === 'src') this.src = ''; }
    load() { this.loadCalls += 1; }
  }

  Object.defineProperty(globalThis, 'Audio', { configurable: true, writable: true, value: supported ? Audio : undefined });
  const music = createBackgroundMusic('/music/tet-dong-day.mp3', {
    onPlaybackChange: status => statuses.push(status),
  });
  t.after(() => {
    music.dispose();
    if (original) Object.defineProperty(globalThis, 'Audio', original);
    else delete globalThis.Audio;
  });
  return { music, elements, statuses };
}

test('the supplied recording starts at 10 seconds and repeats from that offset', async t => {
  const { music, elements, statuses } = mockMusic(t);
  const result = music.start();
  const element = elements[0];
  assert.equal(element.src, '/music/tet-dong-day.mp3');
  assert.equal(element.preload, 'auto');
  assert.equal(element.loop, false);
  assert.equal(element.volume, 0.28);
  assert.deepEqual(element.playCalls.map(call => call.position), [10]);
  assert.equal(element.playCalls[0].muted, false, 'autoplay asks for audible playback immediately');
  assert.equal(await result, true);
  assert.deepEqual(statuses, ['loading', 'playing']);

  element.position = 180;
  element.emit('ended');
  assert.deepEqual(element.playCalls.map(call => call.position), [10, 10]);
  await Promise.resolve();
  assert.equal(element.muted, false);
  assert.equal(elements.length, 1);
});

test('late metadata seeks before playback starts without a muted autoplay transition', async t => {
  const { music, elements } = mockMusic(t, { metadata: false, deferredPlay: true });
  const result = music.start();
  const element = elements[0];
  assert.equal(element.playCalls.length, 1, 'play happens synchronously before metadata');
  assert.equal(element.playCalls[0].muted, false);
  assert.equal(element.currentTime, 0);

  element.readyState = 1;
  element.emit('loadedmetadata');
  assert.equal(element.currentTime, 10);
  assert.equal(element.muted, false);
  element.completePlay(0);
  assert.equal(await result, true);
});

test('mute or visibility pauses preserve the current song position on resume', async t => {
  const { music, elements } = mockMusic(t);
  assert.equal(await music.start(), true);
  const element = elements[0];
  element.currentTime = 47.5;
  music.pause();
  assert.equal(element.paused, true);
  assert.equal(element.currentTime, 47.5);
  assert.equal(await music.start(), true);
  assert.deepEqual(element.playCalls.map(call => call.position), [10, 47.5]);
  assert.equal(elements.length, 1);
});

test('a trusted gesture retries pending autoplay synchronously without another element', async t => {
  const { music, elements } = mockMusic(t, { deferredPlay: true });
  const autoplay = music.start();
  const element = elements[0];
  const gesture = music.start();
  assert.equal(element.playCalls.length, 2);
  assert.equal(elements.length, 1);
  element.completePlay(1);
  element.completePlay(0);
  assert.deepEqual(await Promise.all([autoplay, gesture]), [true, true]);
  assert.equal(element.paused, false);
});

test('a rejected old play request cannot stop a newer successful request', async t => {
  const { music, elements, statuses } = mockMusic(t, { deferredPlay: true });
  const first = music.start();
  const second = music.start();
  const element = elements[0];
  element.completePlay(1);
  assert.equal(await second, true);
  element.playCalls[0].reject(new DOMException('Autoplay blocked', 'NotAllowedError'));
  assert.equal(await first, false);
  assert.equal(element.paused, false);
  assert.equal(element.pauseCalls, 0);
  assert.deepEqual(statuses, ['loading', 'playing']);
});

test('a late play completion cannot revive a paused or disposed player', async t => {
  const { music, elements } = mockMusic(t, { deferredPlay: true });
  const first = music.start();
  const element = elements[0];
  music.pause();
  element.completePlay(0);
  assert.equal(await first, false);
  assert.equal(element.paused, true);

  const second = music.start();
  music.dispose();
  element.completePlay(1);
  assert.equal(await second, false);
  assert.equal(element.paused, true);
  assert.equal(element.src, '');
  assert.equal(element.loadCalls, 1);
  assert.equal(element.listeners.size, 0);
  assert.equal(await music.start(), false);
  music.dispose();
  assert.equal(element.loadCalls, 1);
});

test('a completion from before a pause does not pause newer playback', async t => {
  const { music, elements } = mockMusic(t, { deferredPlay: true });
  const first = music.start();
  const element = elements[0];
  music.pause();
  const second = music.start();
  element.completePlay(1);
  assert.equal(await second, true);
  const pauseCalls = element.pauseCalls;
  element.completePlay(0);
  assert.equal(await first, false);
  assert.equal(element.pauseCalls, pauseCalls);
  assert.equal(element.paused, false);
});

test('unsupported media fails silently', async t => {
  const unsupported = mockMusic(t, { supported: false });
  assert.equal(await unsupported.music.start(), false);
  unsupported.music.pause();
  unsupported.music.dispose();
  assert.equal(unsupported.elements.length, 0);
});

test('blocked playback can be retried after rejection', async t => {
  const blocked = mockMusic(t, { deferredPlay: true });
  const autoplay = blocked.music.start();
  const blockedElement = blocked.elements[0];
  blockedElement.playCalls[0].reject(new DOMException('Autoplay blocked', 'NotAllowedError'));
  assert.equal(await autoplay, false);
  assert.deepEqual(blocked.statuses, ['loading', 'blocked']);
  const retry = blocked.music.start();
  blockedElement.completePlay(1);
  assert.equal(await retry, true);
  assert.deepEqual(blocked.statuses, ['loading', 'blocked', 'loading', 'playing']);
});

test('metadata seek errors fail silently without playing the intro', async t => {
  const invalid = mockMusic(t, { metadata: false, deferredPlay: true, seekError: true });
  const failed = invalid.music.start();
  const invalidElement = invalid.elements[0];
  invalidElement.readyState = 1;
  invalidElement.emit('loadedmetadata');
  invalidElement.completePlay(0);
  assert.equal(await failed, false);
  assert.equal(invalidElement.muted, false);
  assert.equal(invalidElement.paused, true);
  assert.deepEqual(invalid.statuses, ['loading', 'error']);
});

test('a media error stops repetition and invalidates pending playback', async t => {
  const { music, elements } = mockMusic(t, { deferredPlay: true });
  const result = music.start();
  const element = elements[0];
  element.emit('error');
  element.completePlay(0);
  assert.equal(await result, false);
  assert.equal(element.paused, true);
  element.emit('ended');
  assert.equal(element.playCalls.length, 1);
});

test('retrying an already audible track does not publish a loading state', async t => {
  const { music, elements, statuses } = mockMusic(t);
  assert.equal(await music.start(), true);
  assert.equal(await music.start(), true);
  assert.equal(elements[0].playCalls.length, 2, 'each gesture still calls play synchronously');
  assert.deepEqual(statuses, ['loading', 'playing']);
});

test('media events report real playback and a later browser pause', async t => {
  const { music, elements, statuses } = mockMusic(t, { deferredPlay: true });
  const result = music.start();
  const element = elements[0];
  element.paused = false;
  element.emit('playing');
  assert.deepEqual(statuses, ['loading', 'playing']);
  element.completePlay(0);
  assert.equal(await result, true);
  element.pause();
  assert.deepEqual(statuses, ['loading', 'playing', 'paused']);
});

test('a fulfilled play promise is not success if the element remains muted or paused', async t => {
  const { music, elements, statuses } = mockMusic(t, { deferredPlay: true });
  const muted = music.start();
  const element = elements[0];
  element.muted = true;
  element.completePlay(0);
  assert.equal(await muted, false);
  assert.equal(element.paused, true);
  assert.deepEqual(statuses, ['loading', 'error']);

  element.muted = false;
  const paused = music.start();
  element.playCalls[1].resolve();
  assert.equal(await paused, false);
  assert.deepEqual(statuses, ['loading', 'error', 'loading', 'error']);
});

test('metadata-ready seek failures stop before an audible play request', async t => {
  const { music, elements, statuses } = mockMusic(t, { seekError: true });
  assert.equal(await music.start(), false);
  assert.equal(elements[0].playCalls.length, 0);
  assert.equal(elements[0].paused, true);
  assert.deepEqual(statuses, ['loading', 'error']);
});

test('non-policy play failures report an error rather than an autoplay block', async t => {
  const { music, elements, statuses } = mockMusic(t, { deferredPlay: true });
  const result = music.start();
  elements[0].playCalls[0].reject(new DOMException('Unsupported recording', 'NotSupportedError'));
  assert.equal(await result, false);
  assert.deepEqual(statuses, ['loading', 'error']);
});
