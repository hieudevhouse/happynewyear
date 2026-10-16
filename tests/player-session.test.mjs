import assert from 'node:assert/strict';
import test from 'node:test';
import { PRIZES } from '../src/data/prizes.js';
import {
  createPlayerSession, startPlayerSession, restorePlayerSession, openPlayerEnvelope, getPlayerReward
} from '../src/state/playerSession.js';

test('a player can receive several envelopes without changing their assigned gifts', () => {
  let player = { ...createPlayerSession('lm-2027-8f2k'), name: 'Minh Anh' };
  const first = getPlayerReward(player, 4);
  player = openPlayerEnvelope(player, 4);
  player = openPlayerEnvelope(player, 11);
  assert.deepEqual(player.opened, [4, 11]);
  assert.deepEqual(getPlayerReward(player, 4), first);
  assert.equal(PRIZES.includes(first.prize), true);
});

test('duplicate clicks and invalid envelope IDs cannot grant extra rewards', () => {
  const player = openPlayerEnvelope(createPlayerSession('LM-2027-8F2K'), 7);
  for (const id of [7, -1, 16, .5, '2', null]) assert.equal(openPlayerEnvelope(player, id), player);
  assert.equal(getPlayerReward(player, 16), null);
});

test('refreshing a page preserves code, name, gift assignments and opened envelopes', () => {
  let player = { ...createPlayerSession('LM-2027-8F2K'), name: 'Nguyễn Minh Anh' };
  player = openPlayerEnvelope(openPlayerEnvelope(player, 2), 12);
  const restored = restorePlayerSession(JSON.stringify(player));
  assert.deepEqual(restored, player);
  assert.deepEqual(getPlayerReward(restored, 12), getPlayerReward(player, 12));
});

test('submitting the same code preserves progress and a new code starts a new tree', () => {
  const player = { ...openPlayerEnvelope(createPlayerSession('LM-2027-8F2K'), 3), name: 'An' };
  assert.equal(startPlayerSession(player, ' lm-2027-8f2k '), player);
  const next = startPlayerSession(player, 'LM-2027-9P1M');
  assert.equal(next.code, 'LM-2027-9P1M');
  assert.equal(next.name, '');
  assert.deepEqual(next.opened, []);
});

test('corrupt storage is rejected and duplicate history entries are normalized', () => {
  for (const value of [null, '', '{', '{}', '[]', JSON.stringify({ code: 'invalid' })]) {
    assert.equal(restorePlayerSession(value), null);
  }
  const player = createPlayerSession('LM-2027-8F2K');
  player.opened = [2, 2, -1, 18, '4', 9];
  assert.deepEqual(restorePlayerSession(JSON.stringify(player)).opened, [2, 9]);
  player.gifts[1] = 100;
  assert.equal(restorePlayerSession(JSON.stringify(player)), null);
});
