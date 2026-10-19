import { randomInt } from 'node:crypto';

export const ENVELOPE_COUNT = 16;
export const REWARD_LIMIT = 1;
export const publicPrize = prize => ({ id: String(prize.id || prize._id), title: prize.title, sub: prize.sub, icon: prize.icon, color: prize.color });
const openedEnvelopes = code => (code.envelopes || []).filter(envelope => envelope.openedAt);
export const hasReward = code => code.status === 'used' || Boolean(code.usedAt) || Number(code.openedCount) >= REWARD_LIMIT || openedEnvelopes(code).length > 0;
export const firstReward = code => openedEnvelopes(code).sort((a, b) => new Date(a.openedAt) - new Date(b.openedAt) || a.index - b.index)[0] || null;
export const effectiveStatus = code => code.status === 'disabled' ? 'disabled' : hasReward(code) ? 'used' : code.status;
export const publicCode = code => ({ id: String(code.id || code._id), code: code.code, status: effectiveStatus(code), name: code.name || '', openedCount: Math.max(Number(code.openedCount) || 0, openedEnvelopes(code).length), createdAt: code.createdAt, usedAt: code.usedAt || firstReward(code)?.openedAt || null, canDelete: !hasReward(code) && !code.ownerHash && ['available', 'disabled'].includes(code.status) });
export const publicReward = envelope => ({ index: envelope.index, number: envelope.number, prize: publicPrize(envelope.prize) });
export const publicPlayer = code => {
  const rewards = [firstReward(code)].filter(Boolean).slice(0, REWARD_LIMIT);
  return { code: code.code, name: code.name || '', status: effectiveStatus(code), opened: rewards.map(envelope => envelope.index), rewards: rewards.map(publicReward) };
};
export const winner = (code, envelope) => ({ id: `${code.id || code._id}:${envelope.index}`, name: code.name || '', code: code.code, index: envelope.index, prize: publicPrize(envelope.prize), openedAt: envelope.openedAt });
export function createEnvelopes(prizes) {
  const active = prizes.filter(prize => prize.active && prize.weight > 0);
  if (!active.length) throw Object.assign(new Error('Chưa có phần thưởng đang hoạt động.'), { status: 409 });
  const total = active.reduce((sum, prize) => sum + prize.weight, 0);
  return Array.from({ length: ENVELOPE_COUNT }, (_, index) => {
    let point = randomInt(total);
    const prize = active.find(item => { point -= item.weight; return point < 0; });
    return { index, number: index + 1, prize: publicPrize(prize), openedAt: null };
  });
}
export function pageParams(query) {
  const page = Math.max(1, Math.min(100000, Number.parseInt(query.page, 10) || 1));
  const limit = Math.max(1, Math.min(100, Number.parseInt(query.limit, 10) || 20));
  const search = String(query.search || '').trim().slice(0, 80);
  return { page, limit, search, status: query.status };
}
export const pagination = (items, total, page, limit) => ({ items, total, page, pages: Math.max(1, Math.ceil(total / limit)) });
export function dashboardFromCodes(codes) {
  const stats = { totalCodes: codes.length, availableCodes: 0, activeCodes: 0, usedCodes: 0, disabledCodes: 0, totalPlayers: 0, totalRewards: 0, todayRewards: 0, redemptionRate: 0 };
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' });
  const byDay = new Map();
  for (let offset = 6; offset >= 0; offset--) {
    const date = new Date(Date.now() - offset * 86400000).toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' });
    byDay.set(date, 0);
  }
  const rewards = [];
  for (const code of codes) {
    const status = effectiveStatus(code);
    stats[`${status}Codes`]++;
    if (code.ownerHash) stats.totalPlayers++;
    for (const envelope of code.envelopes || []) {
      if (!envelope.openedAt) continue;
      const date = new Date(envelope.openedAt).toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' });
      stats.totalRewards++;
      if (date === today) stats.todayRewards++;
      if (byDay.has(date)) byDay.set(date, byDay.get(date) + 1);
      rewards.push(winner(code, envelope));
    }
  }
  stats.redemptionRate = stats.totalCodes ? Math.round(stats.totalPlayers / stats.totalCodes * 1000) / 10 : 0;
  return { stats, daily: [...byDay].map(([date, count]) => ({ date, count })), recent: rewards.sort((a, b) => new Date(b.openedAt) - new Date(a.openedAt)).slice(0, 8) };
}
