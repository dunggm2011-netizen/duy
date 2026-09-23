module.exports = {
  PORT: process.env.PORT || 3000,
  SESSION_SECRET: process.env.SESSION_SECRET || 'duydevtool_secret_change_me_2026',

  ADMIN_USER: process.env.ADMIN_USER || 'duy11912',
  ADMIN_PASS: process.env.ADMIN_PASS || 'duy11912',

  BANK: {
    bank: 'MB Bank',
    account: '0982344729',
    owner: 'TRAN THANH NGAN',
    qrTemplate: 'https://img.vietqr.io/image/MB-0982344729-compact2.png?amount={amount}&addInfo={info}&accountName=TRAN%20THANH%20NGAN'
  },

  TOOL247_API: 'https://api.tool247.fun/api/pred-log',
  BCR_API: 'https://jjjjbcrsexxy-1.onrender.com/api/bcrvh11',

  GAMES: {
    '68tx': '68 Tài Xỉu',
    '789club': '789Club Tài Xỉu',
    'b52_tx': 'B52 Tài Xỉu',
    'b52_md5': 'B52 MD5',
    'betvip_tx': 'BetVip Tài Xỉu',
    'betvip_md5': 'BetVip MD5',
    'hitclub_tx': 'Hitclub Tài Xỉu',
    'hitclub_md5': 'Hitclub MD5',
    'lc79_hu': 'LC79 Tài Xỉu',
    'lc79_md5': 'LC79 MD5',
    'luck8_tx': 'Luck8 Tài Xỉu',
    'luck8_md5': 'Luck8 MD5',
    'max789_tx': 'Max789 Tài Xỉu',
    'max789_md5': 'Max789 MD5',
    'rikvip_hu': 'Rikvip Tài Xỉu',
    'rikvip_md5': 'Rikvip MD5',
    'son789_tx': 'Son789 Tài Xỉu',
    'son789_md5': 'Son789 MD5'
  },

  KEY_PRICES: {
    '1d':      { label: '1 Ngày',    price: 10000,  hours: 24 },
    '3d':      { label: '3 Ngày',    price: 30000,  hours: 72 },
    '1w':      { label: '1 Tuần',    price: 60000, hours: 168 },
    '1m':      { label: '1 Tháng',   price: 100000, hours: 720 },
    '2m':      { label: '2 Tháng',   price: 180000, hours: 1440 },
    'forever': { label: 'Vĩnh Viễn', price: 350000, hours: null }
  }
};
