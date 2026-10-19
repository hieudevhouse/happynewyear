import express from 'express';
import { randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkPassword, cookies, hashPassword, hashToken, newToken } from './security.js';
import { createEnvelopes, effectiveStatus, ENVELOPE_COUNT, hasReward, pageParams, publicCode, publicPlayer, publicPrize } from './domain.js';

const route = callback => (req, res, next) => Promise.resolve(callback(req, res, next)).catch(next);
const fail = (status, message) => { throw Object.assign(new Error(message), { status }); };
const cleanText = (value, max, required = false) => {
  if (typeof value !== 'string' || value.length > max || /[\u0000-\u001f\u007f]/u.test(value)) fail(400, 'Thông tin không hợp lệ.');
  const text = value.trim();
  if (required && !text) fail(400, 'Vui lòng điền đầy đủ thông tin.');
  return text;
};
const normalizeCode = value => {
  const code = cleanText(value, 40, true).toUpperCase();
  if (!/^[A-Z0-9][A-Z0-9-]{2,39}$/.test(code)) fail(400, 'Mã chỉ gồm 3–40 chữ cái, chữ số và dấu gạch ngang.');
  return code;
};
const publicAdmin = admin => ({ id: String(admin.id || admin._id), username: admin.username });
const prizeOutput = prize => ({ ...publicPrize(prize), weight: prize.weight, active: prize.active });

export function createApp({ store, config = {} }) {
  if (!store) throw new Error('A persistent store (or explicit test store) is required.');
  const app = express();
  app.disable('x-powered-by');
  const production = Boolean(config.production);
  const origins = new Set(config.clientOrigins || ['http://localhost:5173']);
  const sessionDays = config.sessionDays || 30;
  const adminCookie = 'lm_admin';
  const playerCookie = 'lm_player';
  const cookieOptions = { httpOnly: true, secure: production, sameSite: 'lax', path: '/' };
  // A real hash also keeps unknown-account login checks comparable to valid users.
  const dummyPasswordHash = hashPassword(newToken());
  const loginAttempts = new Map();
  const playerAttempts = new Map();
  const limited = (bucket, key, max, windowMs) => {
    const now = Date.now();
    if (bucket.size > 2000) for (const [entry, state] of bucket) if (state.reset <= now) bucket.delete(entry);
    const previous = bucket.get(key);
    const state = previous && previous.reset > now ? previous : { count: 0, reset: now + windowMs };
    state.count++;
    bucket.set(key, state);
    if (state.count > max) fail(429, 'Bạn đã thử quá nhiều lần. Vui lòng thử lại sau ít phút.');
  };
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'same-origin');
    if (req.path.startsWith('/api/')) res.setHeader('Cache-Control', 'no-store');
    const origin = req.headers.origin;
    let allowed = !origin;
    if (origin) {
      try {
        const url = new URL(origin);
        allowed = origins.has(origin) || (['http:', 'https:'].includes(url.protocol) && url.host === req.headers.host);
      } catch { allowed = false; }
      if (!allowed) return res.status(403).json({ message: 'Nguồn truy cập không được cho phép.' });
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Vary', 'Origin');
    }
    if (req.method === 'OPTIONS') {
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      return res.sendStatus(204);
    }
    if (!['GET', 'HEAD'].includes(req.method)) {
      if (!origin && req.headers['sec-fetch-site'] === 'cross-site') return res.status(403).json({ message: 'Nguồn truy cập không được cho phép.' });
      if (!req.is('application/json')) return res.status(415).json({ message: 'Yêu cầu phải dùng application/json.' });
    }
    next();
  });
  app.use(express.json({ limit: '16kb', strict: true }));
  app.get('/api/health', (_, res) => {
    const ready = store.isReady();
    res.status(ready ? 200 : 503).json({ ok: ready, database: ready ? 'connected' : 'unavailable' });
  });
  app.use('/api', (req, res, next) => store.isReady() ? next() : res.status(503).json({ message: 'Cơ sở dữ liệu chưa sẵn sàng. Vui lòng thử lại sau.' }));
  const readSession = async (req, name, kind) => {
    const token = cookies(req)[name];
    if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
    const hash = hashToken(token);
    const session = await store.getSession(hash, kind);
    return session ? { ...session, hash } : null;
  };
  const issueSession = async (res, name, kind, extra = {}) => {
    const token = newToken();
    const hash = hashToken(token);
    const maxAge = (kind === 'admin' ? 12 * 3600000 : sessionDays * 86400000);
    await store.createSession({ hash, kind, expiresAt: new Date(Date.now() + maxAge), ...extra });
    res.cookie(name, token, { ...cookieOptions, maxAge });
    return { hash, kind, ...extra };
  };
  const adminOnly = route(async (req, _, next) => {
    const session = await readSession(req, adminCookie, 'admin');
    const admin = session && await store.getAdmin(session.adminId);
    if (!admin) fail(401, 'Vui lòng đăng nhập quản trị.');
    req.admin = admin;
    next();
  });
  const ownedPlayer = async req => {
    const session = await readSession(req, playerCookie, 'player');
    if (!session) fail(401, 'Vui lòng nhập mã lì xì để bắt đầu.');
    const code = await store.getPlayerCode(session.hash);
    if (!code) fail(401, 'Phiên nhận lì xì không còn hợp lệ.');
    if (code.status === 'disabled') fail(403, 'Mã lì xì đã bị tạm khóa.');
    return { session, code };
  };

  app.post('/api/auth/login', route(async (req, res) => {
    limited(loginAttempts, req.ip, config.loginLimit || 8, 15 * 60000);
    const username = cleanText(req.body.username, 80, true);
    const password = req.body.password;
    if (typeof password !== 'string' || !password.length || password.length > 256) fail(400, 'Vui lòng nhập mật khẩu hợp lệ.');
    const admin = await store.findAdmin(username);
    const valid = await checkPassword(password, admin?.passwordHash || await dummyPasswordHash);
    if (!admin || !valid) fail(401, 'Tên đăng nhập hoặc mật khẩu không đúng.');
    const previous = await readSession(req, adminCookie, 'admin');
    if (previous) await store.deleteSession(previous.hash);
    await issueSession(res, adminCookie, 'admin', { adminId: admin.id || String(admin._id) });
    res.json({ admin: publicAdmin(admin) });
  }));
  app.get('/api/auth/me', adminOnly, (req, res) => res.json({ admin: publicAdmin(req.admin) }));
  app.post('/api/auth/logout', route(async (req, res) => {
    const session = await readSession(req, adminCookie, 'admin');
    if (session) await store.deleteSession(session.hash);
    res.clearCookie(adminCookie, cookieOptions);
    res.json({ ok: true });
  }));
  app.get('/api/player/session', route(async (req, res) => {
    const session = await readSession(req, playerCookie, 'player');
    const code = session && await store.getPlayerCode(session.hash);
    if (code?.status === 'disabled') fail(403, 'Mã lì xì đã bị tạm khóa.');
    res.json({ player: code ? publicPlayer(code) : null });
  }));
  app.post('/api/player/start', route(async (req, res) => {
    limited(playerAttempts, req.ip, 60, 60000);
    const codeValue = normalizeCode(req.body.code);
    let code = await store.getCode(codeValue);
    if (!code || code.status === 'disabled') fail(404, 'Mã lì xì không hợp lệ hoặc đã bị khóa.');
    let session = await readSession(req, playerCookie, 'player');
    if (code.ownerHash) {
      if (code.ownerHash !== session?.hash) fail(409, 'Mã lì xì đã được sử dụng trên một phiên khác.');
    } else {
      if (effectiveStatus(code) !== 'available') fail(409, 'Mã lì xì đã được sử dụng.');
      const envelopes = createEnvelopes(await store.listPrizes());
      if (!session) session = await issueSession(res, playerCookie, 'player');
      const claimed = await store.claimCode(codeValue, session.hash, envelopes);
      code = claimed || await store.getCode(codeValue);
      if (code?.ownerHash !== session.hash) fail(409, 'Mã lì xì vừa được sử dụng trên một phiên khác.');
    }
    await store.selectPlayerCode(session.hash, code.id);
    res.json({ player: publicPlayer(code) });
  }));
  app.patch('/api/player/name', route(async (req, res) => {
    const name = cleanText(req.body.name, 80, true).replace(/\s+/g, ' ');
    const { session, code } = await ownedPlayer(req);
    if (hasReward(code) && code.name !== name) fail(409, 'Không thể đổi tên sau khi đã mở lì xì.');
    const updated = code.name === name ? code : await store.setPlayerName(code.id, session.hash, name);
    if (!updated) fail(409, 'Phiên nhận lì xì đã thay đổi. Vui lòng tải lại.');
    res.json({ player: publicPlayer(updated) });
  }));
  app.post('/api/player/envelopes/:index/open', route(async (req, res) => {
    if (!/^\d{1,2}$/.test(req.params.index)) fail(400, 'Bao lì xì không hợp lệ.');
    const index = Number(req.params.index);
    if (index < 0 || index >= ENVELOPE_COUNT) fail(400, 'Bao lì xì không hợp lệ.');
    const { session, code } = await ownedPlayer(req);
    let current = code;
    if (!hasReward(code)) {
      if (!code.name) fail(400, 'Vui lòng nhập họ tên trước khi mở lì xì.');
      current = await store.openEnvelope(code.id, session.hash, index) || await store.getCodeById(code.id);
      if (!current || current.status === 'disabled') fail(403, 'Mã lì xì đã bị tạm khóa.');
    }
    const player = publicPlayer(current);
    const reward = player.rewards[0];
    if (reward?.index === index) return res.json({ player, reward });
    return res.status(409).json({ message: hasReward(current) ? 'Mỗi mã chỉ được nhận một phần quà. Mã lì xì này đã nhận lộc.' : 'Không thể mở bao lì xì. Vui lòng thử lại.', player });
  }));
  app.post('/api/codes/validate', route(async (req, res) => {
    limited(playerAttempts, req.ip, 60, 60000);
    const code = normalizeCode(req.body.code);
    const record = await store.getCode(code);
    res.json({ valid: Boolean(record && effectiveStatus(record) === 'available' && !record.ownerHash), code });
  }));

  app.use('/api/admin', adminOnly);
  app.get('/api/admin/dashboard', route(async (_, res) => res.json(await store.dashboard())));
  app.get('/api/admin/codes', route(async (req, res) => res.json(await store.listCodes(pageParams(req.query)))));
  app.post('/api/admin/codes', route(async (req, res) => {
    const hasCode = typeof req.body.code === 'string' && req.body.code.trim();
    const quantity = req.body.quantity === undefined ? 1 : req.body.quantity;
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 500 || (hasCode && quantity !== 1)) fail(400, 'Số lượng mã phải từ 1 đến 500; mã tùy chỉnh chỉ tạo một lần.');
    const codes = hasCode ? [normalizeCode(req.body.code)] : Array.from({ length: quantity }, () => `LM-2027-${randomBytes(5).toString('hex').toUpperCase()}`);
    const items = await store.createCodes(codes);
    res.status(201).json({ items: items.map(publicCode) });
  }));
  app.patch('/api/admin/codes/:id', route(async (req, res) => {
    if (!['disabled', 'available'].includes(req.body.status)) fail(400, 'Trạng thái không hợp lệ.');
    const code = await store.setCodeStatus(req.params.id, req.body.status);
    if (!code) fail(404, 'Không tìm thấy mã lì xì.');
    res.json({ item: publicCode(code) });
  }));
  app.delete('/api/admin/codes/:id', route(async (req, res) => {
    const code = await store.getCodeById(req.params.id);
    if (!code) fail(404, 'Không tìm thấy mã lì xì.');
    if (!await store.deleteUnusedCode(req.params.id)) fail(409, 'Không thể xóa mã đã có người nhận.');
    res.json({ ok: true });
  }));
  app.get('/api/admin/winners', route(async (req, res) => res.json(await store.listWinners(pageParams(req.query)))));
  app.get('/api/admin/prizes', route(async (_, res) => res.json({ items: (await store.listPrizes()).map(prizeOutput) })));
  const validatePrize = (body, partial = false) => {
    const result = {};
    for (const [field, max, required] of [['title', 100, true], ['sub', 200, false], ['icon', 16, true], ['color', 7, true]]) {
      if (partial && body[field] === undefined) continue;
      result[field] = cleanText(body[field] ?? (required ? undefined : ''), max, required);
    }
    if (result.color !== undefined && !/^#[0-9a-f]{6}$/i.test(result.color)) fail(400, 'Màu phần thưởng phải có dạng #rrggbb.');
    if (body.weight !== undefined || !partial) {
      result.weight = body.weight ?? 1;
      if (!Number.isInteger(result.weight) || result.weight < 1 || result.weight > 10000) fail(400, 'Trọng số phải là số nguyên từ 1 đến 10000.');
    }
    if (body.active !== undefined || !partial) {
      result.active = body.active ?? true;
      if (typeof result.active !== 'boolean') fail(400, 'Trạng thái phần thưởng không hợp lệ.');
    }
    if (!Object.keys(result).length) fail(400, 'Không có thông tin cần cập nhật.');
    return result;
  };
  app.post('/api/admin/prizes', route(async (req, res) => res.status(201).json({ item: prizeOutput(await store.createPrize(validatePrize(req.body))) })));
  app.patch('/api/admin/prizes/:id', route(async (req, res) => {
    const prize = await store.updatePrize(req.params.id, validatePrize(req.body, true));
    if (!prize) fail(404, 'Không tìm thấy phần thưởng.');
    res.json({ item: prizeOutput(prize) });
  }));
  app.use('/api', (_, res) => res.status(404).json({ message: 'API không tồn tại.' }));
  const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../dist');
  if (existsSync(path.join(dist, 'index.html'))) {
    app.use(express.static(dist));
    app.get('*', (_, res) => res.sendFile(path.join(dist, 'index.html')));
  }
  app.use((error, _, res, next) => {
    if (res.headersSent) return next(error);
    if (error.code === 11000) return res.status(409).json({ message: 'Mã hoặc tài khoản đã tồn tại.' });
    if (error.type === 'entity.too.large') return res.status(413).json({ message: 'Nội dung gửi lên quá lớn.' });
    if (error instanceof SyntaxError && error.status === 400) return res.status(400).json({ message: 'Dữ liệu JSON không hợp lệ.' });
    if (error.status && error.status < 500) return res.status(error.status).json({ message: error.message });
    if (!store.isReady() || /Mongo|Mongoose/.test(error.name)) return res.status(503).json({ message: 'Cơ sở dữ liệu chưa sẵn sàng. Vui lòng thử lại sau.' });
    res.status(500).json({ message: 'Không thể xử lý yêu cầu. Vui lòng thử lại.' });
  });
  return app;
}
