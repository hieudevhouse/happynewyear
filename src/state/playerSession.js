import { PRIZES } from '../data/prizes.js';
import { ENVELOPE_ANCHORS, ENVELOPE_STYLES } from '../data/envelopes.js';

export const PLAYER_STORAGE_KEY = 'luckymoney.player.v1';

export function createPlayerSession(code = '', random = Math.random) {
  const gifts = ENVELOPE_ANCHORS.map((_, index) => index % PRIZES.length);
  for (let i = gifts.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [gifts[i], gifts[j]] = [gifts[j], gifts[i]];
  }
  return { code: code.trim().toUpperCase(), name: '', gifts, opened: [] };
}

export function startPlayerSession(current, code) {
  const normalized = code.trim().toUpperCase();
  return current.code === normalized ? current : createPlayerSession(normalized);
}

export function restorePlayerSession(raw) {
  try {
    const saved = JSON.parse(raw);
    if (!saved || typeof saved.code !== 'string' || !saved.code.trim().toUpperCase().startsWith('LM-')
      || typeof saved.name !== 'string' || !Array.isArray(saved.gifts)
      || saved.gifts.length !== ENVELOPE_ANCHORS.length
      || !saved.gifts.every(index => Number.isInteger(index) && index >= 0 && index < PRIZES.length)
      || !Array.isArray(saved.opened)) return null;
    return {
      code: saved.code.trim().toUpperCase(),
      name: saved.name.trim().slice(0, 60),
      gifts: [...saved.gifts],
      opened: [...new Set(saved.opened.filter(index => Number.isInteger(index) && index >= 0 && index < saved.gifts.length))].slice(0, 1)
    };
  } catch { return null; }
}

export function openPlayerEnvelope(session, index) {
  if (!Number.isInteger(index) || index < 0 || index >= session.gifts.length || session.opened.length > 0) return session;
  return { ...session, opened: [...session.opened, index] };
}

export function getPlayerReward(session, index) {
  if (Array.isArray(session.rewards)) {
    const reward = session.rewards.find(item => item.index === index);
    if (!reward || !Number.isInteger(index) || index < 0 || index >= ENVELOPE_ANCHORS.length) return null;
    return { ...reward, style: ENVELOPE_STYLES[index % ENVELOPE_STYLES.length] };
  }
  if (!Number.isInteger(index) || index < 0 || index >= session.gifts.length || session.opened[0] !== index) return null;
  return {
    index,
    number: index + 1,
    style: ENVELOPE_STYLES[index % ENVELOPE_STYLES.length],
    prize: PRIZES[session.gifts[index]]
  };
}
