const express = require('express');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcryptjs');
const axios = require('axios');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const cfg = require('./config');
const db = require('./db');

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(session({
  secret: cfg.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 30 * 24 * 60 * 60 * 1000 }
}));

app.use(express.static(path.join(__dirname, 'public')));

if (!fs.existsSync('uploads')) fs.mkdirSync('uploads');
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

// ============ HELPERS ============
function requireLogin(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ error: 'Chưa đăng nhập', code: 'NO_LOGIN' });
  next();
}

function requireAdmin(req, res, next) {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.session.userId);
  if (!user || user.role !== 'admin') return res.status(403).json({ error: 'Không có quyền' });
  next();
}

function requireVip(req, res, next) {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.session.userId);
  if (!user) return res.status(401).json({ error: 'Chưa đăng nhập', code: 'NO_LOGIN' });
  if (user.role === 'admin') return next();
  if (!user.vip_key) return res.status(403).json({ error: 'Chưa có key VIP', code: 'NO_VIP' });
  if (user.vip_expiry !== null && user.vip_expiry * 1000 <= Date.now()) {
    return res.status(403).json({ error: 'Key VIP đã hết hạn', code: 'VIP_EXPIRED' });
  }
  next();
}

function genKey() {
  return crypto.randomBytes(8).toString('hex').toUpperCase().match(/.{1,4}/g).join('-');
}
function genPayCode() {
  return 'NAP' + crypto.randomInt(100000, 999999);
}

// ============ AUTH ============
app.post('/api/register', async (req, res) => {
  const { username, password, email } = req.body;
  if (!username || !password) return res.json({ ok: false, msg: 'Thiếu thông tin' });
  if (username.length < 3) return res.json({ ok: false, msg: 'Username tối thiểu 3 ký tự' });
  if (password.length < 6) return res.json({ ok: false, msg: 'Mật khẩu tối thiểu 6 ký tự' });

  const exist = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (exist) return res.json({ ok: false, msg: 'Username đã tồn tại' });

  const hash = await bcrypt.hash(password, 10);
  db.prepare('INSERT INTO users (username, password, email) VALUES (?, ?, ?)').run(username, hash, email || null);
  res.json({ ok: true, msg: 'Đăng ký thành công' });
});

app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user) return res.json({ ok: false, msg: 'Sai tài khoản hoặc mật khẩu' });

  const ok = await bcrypt.compare(password, user.password);
  if (!ok) return res.json({ ok: false, msg: 'Sai tài khoản hoặc mật khẩu' });

  req.session.userId = user.id;
  res.json({ ok: true, role: user.role });
});

app.post('/api/logout', (req, res) => {
  req.session.destroy();
  res.json({ ok: true });
});

app.get('/api/me', requireLogin, (req, res) => {
  const user = db.prepare('SELECT id, username, email, balance, role, vip_key, vip_expiry FROM users WHERE id = ?').get(req.session.userId);
  if (!user) return res.json({ ok: false });
  const vipValid = user.vip_expiry === null
    ? !!user.vip_key
    : (user.vip_expiry && user.vip_expiry * 1000 > Date.now());
  res.json({ ok: true, user: { ...user, vip_valid: vipValid } });
});

app.post('/api/change-password', requireLogin, async (req, res) => {
  const { oldPass, newPass } = req.body;
  if (!oldPass || !newPass || newPass.length < 6) return res.json({ ok: false, msg: 'Mật khẩu mới tối thiểu 6 ký tự' });
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.session.userId);
  const ok = await bcrypt.compare(oldPass, user.password);
  if (!ok) return res.json({ ok: false, msg: 'Mật khẩu cũ sai' });
  const hash = await bcrypt.hash(newPass, 10);
  db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hash, user.id);
  res.json({ ok: true, msg: 'Đổi mật khẩu thành công' });
});

// ============ TOOL247 (bắt login + VIP) ============
app.get('/api/tx', requireLogin, requireVip, async (req, res) => {
  const { game, limit = 50 } = req.query;
  if (!game) return res.json({ error: 'Thiếu game' });
  if (!cfg.GAMES[game]) return res.json({ error: 'Game không hợp lệ' });

  try {
    const r = await axios.get(cfg.TOOL247_API, {
      params: { game, limit, t: Date.now() },
      timeout: 10000
    });
    res.json(r.data);
  } catch (e) {
    res.status(500).json({ error: 'Lỗi lấy dữ liệu', detail: e.message });
  }
});

app.get('/api/games', requireLogin, requireVip, (req, res) => {
  res.json({ games: cfg.GAMES });
});

// ============ BACCARAT (bắt login + VIP) ============
app.get('/api/bcr', requireLogin, requireVip, async (req, res) => {
  try {
    const r = await axios.get(cfg.BCR_API, { timeout: 10000 });
    res.json(r.data);
  } catch (e) {
    res.status(500).json({ error: 'Lỗi lấy baccarat', detail: e.message });
  }
});

// ============ VIP KEY ============
app.get('/api/key/prices', (req, res) => {
  res.json({ prices: cfg.KEY_PRICES });
});

app.post('/api/key/activate', requireLogin, (req, res) => {
  const { key } = req.body;
  if (!key) return res.json({ ok: false, msg: 'Chưa nhập key' });

  const k = db.prepare('SELECT * FROM keys_pool WHERE key = ?').get(key);
  if (!k) return res.json({ ok: false, msg: 'Key không tồn tại' });
  if (k.used_by) return res.json({ ok: false, msg: 'Key đã được sử dụng' });

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.session.userId);
  const expiry = k.hours ? Math.floor(Date.now() / 1000) + k.hours * 3600 : null;

  db.prepare('UPDATE keys_pool SET used_by = ?, used_at = ? WHERE key = ?')
    .run(user.id, Math.floor(Date.now() / 1000), key);
  db.prepare('UPDATE users SET vip_key = ?, vip_expiry = ? WHERE id = ?')
    .run(key, expiry, user.id);
  db.prepare('INSERT INTO history (user_id, action, detail, status) VALUES (?, ?, ?, ?)')
    .run(user.id, 'Kích hoạt key', `${k.label} - ${key}`, 'Thành công');

  res.json({ ok: true, msg: 'Kích hoạt thành công', label: k.label });
});

app.post('/api/key/buy', requireLogin, (req, res) => {
  const { package: pkg } = req.body;
  const info = cfg.KEY_PRICES[pkg];
  if (!info) return res.json({ ok: false, msg: 'Gói không hợp lệ' });

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.session.userId);
  if (user.balance < info.price) return res.json({ ok: false, msg: 'Số dư không đủ' });

  const newKey = genKey();
  db.prepare('UPDATE users SET balance = balance - ? WHERE id = ?').run(info.price, user.id);
  db.prepare('INSERT INTO keys_pool (key, label, hours) VALUES (?, ?, ?)').run(newKey, info.label, info.hours);
  db.prepare('INSERT INTO history (user_id, action, detail, status) VALUES (?, ?, ?, ?)')
    .run(user.id, 'Mua key', `${info.label} - ${info.price}đ - ${newKey}`, 'Thành công');

  res.json({ ok: true, key: newKey, label: info.label });
});

// ============ NẠP TIỀN ============
app.post('/api/nap/create', requireLogin, (req, res) => {
  const { amount } = req.body;
  if (!amount || amount < 10000) return res.json({ ok: false, msg: 'Tối thiểu 10.000đ' });

  const code = genPayCode();
  const qr = cfg.BANK.qrTemplate.replace('{amount}', amount).replace('{info}', code);

  db.prepare('INSERT INTO history (user_id, action, detail, status) VALUES (?, ?, ?, ?)')
    .run(req.session.userId, 'Tạo lệnh nạp', `${amount} - ${code}`, 'Chờ duyệt');

  res.json({ ok: true, code, amount, qr, bank: cfg.BANK });
});

app.post('/api/nap/bill', requireLogin, upload.single('image'), (req, res) => {
  const { code, amount } = req.body;
  if (!req.file) return res.json({ ok: false, msg: 'Chưa có ảnh' });

  db.prepare('INSERT INTO bills (user_id, amount, code, image) VALUES (?, ?, ?, ?)')
    .run(req.session.userId, amount, code, req.file.filename);
  db.prepare('INSERT INTO history (user_id, action, detail, status) VALUES (?, ?, ?, ?)')
    .run(req.session.userId, 'Gửi bill nạp', `${amount} - ${code}`, 'Chờ duyệt');

  res.json({ ok: true, msg: 'Đã gửi bill, chờ admin duyệt' });
});

// ============ HISTORY ============
app.get('/api/history', requireLogin, (req, res) => {
  const rows = db.prepare('SELECT * FROM history WHERE user_id = ? ORDER BY id DESC LIMIT 50').all(req.session.userId);
  res.json({ history: rows });
});

// ============ ADMIN ============
app.get('/api/admin/users', requireAdmin, (req, res) => {
  const users = db.prepare('SELECT id, username, email, balance, role, vip_key, vip_expiry, created_at FROM users ORDER BY id DESC').all();
  res.json({ users });
});

app.post('/api/admin/addbalance', requireAdmin, (req, res) => {
  const { userId, amount } = req.body;
  db.prepare('UPDATE users SET balance = balance + ? WHERE id = ?').run(amount, userId);
  db.prepare('INSERT INTO history (user_id, action, detail, status) VALUES (?, ?, ?, ?)')
    .run(userId, 'Admin cộng tiền', `+${amount}`, 'Thành công');
  res.json({ ok: true });
});

app.post('/api/admin/subbalance', requireAdmin, (req, res) => {
  const { userId, amount } = req.body;
  db.prepare('UPDATE users SET balance = balance - ? WHERE id = ?').run(amount, userId);
  db.prepare('INSERT INTO history (user_id, action, detail, status) VALUES (?, ?, ?, ?)')
    .run(userId, 'Admin trừ tiền', `-${amount}`, 'Thành công');
  res.json({ ok: true });
});

app.get('/api/admin/bills', requireAdmin, (req, res) => {
  const bills = db.prepare(`
    SELECT b.*, u.username 
    FROM bills b LEFT JOIN users u ON u.id = b.user_id 
    WHERE b.status = 'pending' 
    ORDER BY b.id DESC
  `).all();
  res.json({ bills });
});

app.post('/api/admin/bill/approve', requireAdmin, (req, res) => {
  const { billId, action } = req.body;
  const bill = db.prepare('SELECT * FROM bills WHERE id = ?').get(billId);
  if (!bill) return res.json({ ok: false, msg: 'Bill không tồn tại' });

  if (action === 'ok') {
    db.prepare('UPDATE users SET balance = balance + ? WHERE id = ?').run(bill.amount, bill.user_id);
    db.prepare('UPDATE bills SET status = ?, approved_at = ? WHERE id = ?')
      .run('approved', Math.floor(Date.now() / 1000), billId);
    db.prepare('INSERT INTO history (user_id, action, detail, status) VALUES (?, ?, ?, ?)')
      .run(bill.user_id, 'Admin duyệt nạp', `+${bill.amount}`, 'Thành công');
  } else {
    db.prepare('UPDATE bills SET status = ? WHERE id = ?').run('rejected', billId);
    db.prepare('INSERT INTO history (user_id, action, detail, status) VALUES (?, ?, ?, ?)')
      .run(bill.user_id, 'Admin từ chối nạp', bill.amount.toString(), 'Từ chối');
  }
  res.json({ ok: true });
});

app.post('/api/admin/genkey', requireAdmin, (req, res) => {
  const { label, hours } = req.body;
  const key = genKey();
  db.prepare('INSERT INTO keys_pool (key, label, hours) VALUES (?, ?, ?)').run(key, label || 'Admin tạo', hours || null);
  res.json({ ok: true, key });
});

app.get('/api/admin/keys', requireAdmin, (req, res) => {
  const keys = db.prepare('SELECT * FROM keys_pool ORDER BY created_at DESC LIMIT 200').all();
  res.json({ keys });
});

app.get('/api/admin/stats', requireAdmin, (req, res) => {
  const totalUsers = db.prepare('SELECT COUNT(*) as c FROM users WHERE role = "user"').get().c;
  const totalBills = db.prepare('SELECT COUNT(*) as c FROM bills WHERE status = "approved"').get().c;
  const totalBalance = db.prepare('SELECT SUM(balance) as s FROM users').get().s || 0;
  const totalKeys = db.prepare('SELECT COUNT(*) as c FROM keys_pool').get().c;
  const usedKeys = db.prepare('SELECT COUNT(*) as c FROM keys_pool WHERE used_by IS NOT NULL').get().c;
  res.json({ totalUsers, totalBills, totalBalance, totalKeys, usedKeys });
});

app.post('/api/admin/deleteuser', requireAdmin, (req, res) => {
  const { userId } = req.body;
  db.prepare('DELETE FROM users WHERE id = ? AND role != "admin"').run(userId);
  res.json({ ok: true });
});

// ============ SEED ADMIN ============
(async () => {
  const admin = db.prepare('SELECT id FROM users WHERE username = ?').get(cfg.ADMIN_USER);
  if (!admin) {
    const hash = await bcrypt.hash(cfg.ADMIN_PASS, 10);
    db.prepare('INSERT INTO users (username, password, role, balance) VALUES (?, ?, ?, ?)')
      .run(cfg.ADMIN_USER, hash, 'admin', 999999999);
    console.log(`[SEED] Admin created: ${cfg.ADMIN_USER}`);
  }
})();

app.listen(cfg.PORT, () => {
  console.log(`[WEB] DuydevTool running on port ${cfg.PORT}`);
  console.log(`[WEB] Admin: ${cfg.ADMIN_USER}`);
});
