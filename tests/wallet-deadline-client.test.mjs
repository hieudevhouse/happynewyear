import assert from 'node:assert/strict';
import test from 'node:test';
import { getWalletDeadline } from '../src/lib/walletDeadline.js';

const revealedAt = Date.parse('2026-10-21T08:00:00.000Z');
const expiresAt = revealedAt + 72 * 60 * 60 * 1000;
const wallet = method => ({ method, qrShownAt: new Date(revealedAt).toISOString(), qrExpiresAt: new Date(expiresAt).toISOString(), qrExpired: false });

test('wallet countdown uses its fixed server deadline for both supported wallets', () => {
  for (const method of ['momo', 'zalopay']) {
    const redemption = wallet(method);
    const initial = getWalletDeadline(redemption, revealedAt);
    assert.equal(initial.remainingSeconds, 72 * 60 * 60);
    assert.equal(initial.label, '3 ngày 00:00:00');
    assert.equal(initial.expired, false);

    // A fresh response/object after reopening must keep the original deadline.
    const reopened = getWalletDeadline(JSON.parse(JSON.stringify(redemption)), revealedAt + 25 * 60 * 60 * 1000);
    assert.equal(reopened.expiresAt, initial.expiresAt);
    assert.equal(reopened.remainingSeconds, 47 * 60 * 60);
    assert.equal(reopened.label, '1 ngày 23:00:00');
    assert.equal(redemption.qrExpiresAt, new Date(expiresAt).toISOString());
  }
});

test('countdown rounds up live fractional seconds and expires exactly at the deadline', () => {
  const redemption = wallet('momo');
  assert.equal(getWalletDeadline(redemption, expiresAt - 60_001).label, '00:01:01');
  assert.equal(getWalletDeadline(redemption, expiresAt - 60_000).label, '00:01:00');
  assert.equal(getWalletDeadline(redemption, expiresAt - 1).label, '00:00:01');
  assert.equal(getWalletDeadline(redemption, expiresAt - 1).expired, false);
  for (const now of [expiresAt, expiresAt + 1, expiresAt + 24 * 60 * 60 * 1000]) {
    const result = getWalletDeadline(redemption, now);
    assert.equal(result.expired, true);
    assert.equal(result.remainingSeconds, 0);
    assert.equal(result.label, '00:00:00');
  }
});

test('server-expired status takes precedence over a slow client clock', () => {
  for (const method of ['momo', 'zalopay']) {
    const result = getWalletDeadline({ ...wallet(method), qrExpired: true }, revealedAt);
    assert.equal(result.expired, true);
    assert.equal(result.remainingSeconds, 0);
    assert.equal(result.label, '00:00:00');
    assert.equal(result.expiresAt, expiresAt);
  }
});

test('bank QR and unselected methods never acquire a wallet deadline', () => {
  for (const redemption of [null, undefined, {}, { ...wallet('bank'), qrExpired: true }, wallet('other')]) {
    assert.equal(getWalletDeadline(redemption, expiresAt + 1), null);
  }
});

test('missing wallet timestamps do not create a new countdown on reload', () => {
  for (const qrExpiresAt of [undefined, null, '', 'invalid-date']) {
    assert.equal(getWalletDeadline({ method: 'momo', qrExpiresAt }, revealedAt), null);
    const expired = getWalletDeadline({ method: 'momo', qrExpiresAt, qrExpired: true }, revealedAt);
    assert.equal(expired.expired, true);
    assert.equal(expired.remainingSeconds, 0);
    assert.equal(expired.label, '00:00:00');
  }
});
