// The server supplies a fixed deadline only after a gift-wallet QR is revealed.
export function getWalletDeadline(redemption, now = Date.now()) {
  if (!['momo', 'zalopay'].includes(redemption?.method)) return null;
  const expiresAt = Date.parse(redemption.qrExpiresAt);
  if (!Number.isFinite(expiresAt)) return redemption.qrExpired ? { expired: true, remainingSeconds: 0, label: '00:00:00' } : null;
  const remainingSeconds = redemption.qrExpired ? 0 : Math.max(0, Math.ceil((expiresAt - now) / 1000));
  const days = Math.floor(remainingSeconds / 86400);
  const hours = Math.floor(remainingSeconds % 86400 / 3600);
  const minutes = Math.floor(remainingSeconds % 3600 / 60);
  const seconds = remainingSeconds % 60;
  const time = [hours, minutes, seconds].map(value => String(value).padStart(2, '0')).join(':');
  return { expiresAt, expired: remainingSeconds === 0, remainingSeconds, label: `${days > 0 ? `${days} ngày ` : ''}${time}` };
}
