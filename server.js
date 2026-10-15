import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';

const app = express();
app.use(cors());
app.use(express.json());

const codeSchema = new mongoose.Schema({ code: { type: String, unique: true }, status: { type: String, default: 'available' }, usedBy: String, prize: String, usedAt: Date }, { timestamps: true });
const winnerSchema = new mongoose.Schema({ name: String, code: String, prize: String, spinAt: { type: Date, default: Date.now } });
const Code = mongoose.model('Code', codeSchema);
const Winner = mongoose.model('Winner', winnerSchema);

const prizes = ['Lộc Phát 2027', 'Tài Lộc May Mắn', 'Xuân An Khang', 'Vạn Sự Như Ý', 'Bình An Hạnh Phúc'];
app.get('/api/health', (_, res) => res.json({ ok: true, service: 'LuckyMoney 2027' }));
app.post('/api/codes/validate', async (req, res) => {
  const code = String(req.body.code || '').trim().toUpperCase();
  if (!code) return res.status(400).json({ message: 'Vui lòng nhập mã quay.' });
  if (mongoose.connection.readyState !== 1) return res.json({ valid: code.startsWith('LM-'), code });
  const record = await Code.findOne({ code });
  res.json({ valid: Boolean(record && record.status === 'available'), code });
});
app.post('/api/spins', async (req, res) => {
  const { name, code, prize } = req.body;
  if (!name || !code || !prize) return res.status(400).json({ message: 'Thiếu thông tin lượt quay.' });
  if (mongoose.connection.readyState === 1) {
    await Code.findOneAndUpdate({ code, status: 'available' }, { status: 'used', usedBy: name, prize, usedAt: new Date() });
    await Winner.create({ name, code, prize });
  }
  res.json({ ok: true });
});
app.get('/api/admin/codes', async (_, res) => {
  if (mongoose.connection.readyState !== 1) return res.json([{ code: 'LM-2027-8F2K', status: 'available' }, { code: 'LM-2027-3A7Q', status: 'used', usedBy: 'Nguyễn Minh Anh', prize: 'Lộc Phát 2027' }]);
  res.json(await Code.find().sort({ createdAt: -1 }));
});
app.post('/api/admin/codes', async (req, res) => {
  const code = String(req.body.code || `LM-2027-${Math.random().toString(36).slice(2, 6).toUpperCase()}`).toUpperCase();
  if (mongoose.connection.readyState === 1) return res.json(await Code.create({ code }));
  res.json({ code, status: 'available' });
});
app.delete('/api/admin/codes/:code', async (req, res) => { if (mongoose.connection.readyState === 1) await Code.deleteOne({ code: req.params.code }); res.json({ ok: true }); });

const PORT = process.env.PORT || 4000;
mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/luckymoney2027').catch(() => console.log('MongoDB chưa kết nối — đang chạy demo mode.'));
app.listen(PORT, '0.0.0.0', () => console.log(`LuckyMoney API running on port ${PORT} — accessible on your local network`));
