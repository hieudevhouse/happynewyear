import assert from 'node:assert/strict';
import test from 'node:test';
import { PRIZES } from '../src/data/prizes.js';
import {
  createPlayerSession, startPlayerSession, restorePlayerSession, openPlayerEnvelope, getPlayerReward
} from '../src/state/playerSession.js';

test('a code can receive only one envelope and retains its assigned prize', () => {
  let player = { ...createPlayerSession('lm-2027-8f2k'), name: 'Minh Anh' };
  assert.equal(getPlayerReward(player, 4), null);
  player = openPlayerEnvelope(player, 4);
  const first = getPlayerReward(player, 4);
  player = openPlayerEnvelope(player, 11);
  assert.deepEqual(player.opened, [4]);
  assert.deepEqual(getPlayerReward(player, 4), first);
  assert.equal(getPlayerReward(player, 11), null);
  assert.equal(PRIZES.includes(first.prize), true);
});

test('duplicate clicks and invalid envelope IDs cannot grant extra rewards', () => {
  const player = openPlayerEnvelope(createPlayerSession('LM-2027-8F2K'), 7);
  for (const id of [7, 2, 15, -1, 16, .5, '2', null]) assert.equal(openPlayerEnvelope(player, id), player);
  assert.equal(getPlayerReward(player, 16), null);
});

test('refreshing a page preserves the single received prize', () => {
  let player = { ...createPlayerSession('LM-2027-8F2K'), name: 'Nguyễn Minh Anh' };
  player = openPlayerEnvelope(openPlayerEnvelope(player, 2), 12);
  const restored = restorePlayerSession(JSON.stringify(player));
  assert.deepEqual(restored, player);
  assert.deepEqual(restored.opened, [2]);
  assert.deepEqual(getPlayerReward(restored, 2), getPlayerReward(player, 2));
});

test('submitting the same code preserves progress and a new code starts a new tree', () => {
  const player = { ...openPlayerEnvelope(createPlayerSession('LM-2027-8F2K'), 3), name: 'An' };
  assert.equal(startPlayerSession(player, ' lm-2027-8f2k '), player);
  const next = startPlayerSession(player, 'LM-2027-9P1M');
  assert.equal(next.code, 'LM-2027-9P1M');
  assert.equal(next.name, '');
  assert.deepEqual(next.opened, []);
});

test('corrupt storage is rejected and legacy reward history is limited to the first choice', () => {
  for (const value of [null, '', '{', '{}', '[]', JSON.stringify({ code: 'invalid' })]) {
    assert.equal(restorePlayerSession(value), null);
  }
  const player = createPlayerSession('LM-2027-8F2K');
  player.opened = [2, 2, -1, 18, '4', 9];
  assert.deepEqual(restorePlayerSession(JSON.stringify(player)).opened, [2]);
  player.gifts[1] = 100;
  assert.equal(restorePlayerSession(JSON.stringify(player)), null);
});
