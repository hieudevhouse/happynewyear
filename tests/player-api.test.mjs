import assert from 'node:assert/strict';
import test from 'node:test';
import { getPlayerReward } from '../src/state/playerSession.js';
import { ENVELOPE_STYLES } from '../src/data/envelopes.js';

test('server reward history is displayed with the matching envelope style', () => {
  const reward = { index: 5, number: 6, prize: { id: 'spring', title: 'Lộc xuân', icon: '🌸' } };
  const player = { code: '2027-ABCD', name: 'An', opened: [5], rewards: [reward] };
  assert.deepEqual(getPlayerReward(player, 5), { ...reward, style: ENVELOPE_STYLES[5] });
  assert.equal(getPlayerReward(player, 2), null);
});

test('a server session never reveals an unopened local gift assignment', () => {
  const player = { gifts: Array(16).fill(0), opened: [], rewards: [] };
  assert.equal(getPlayerReward(player, 0), null);
  assert.equal(getPlayerReward(player, 16), null);
  assert.equal(getPlayerReward(player, '0'), null);
});
