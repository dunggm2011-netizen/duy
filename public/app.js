// ============================================================
// DUYDEVTOOL — FRONTEND JS
// ============================================================

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

function toast(msg, type = '') {
  let el = document.querySelector('.toast');
  if (!el) {
    el = document.createElement('div');
    el.className = 'toast';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.className = 'toast on ' + type;
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('on'), 2500);
}

async function api(url, opts = {}) {
  try {
    const r = await fetch(url, {
      headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
      credentials: 'same-origin',
      ...opts
    });
    return await r.json();
  } catch (e) {
    return { ok: false, msg: e.message };
  }
}

function fmtPrice(n) {
  return Number(n).toLocaleString('vi-VN') + 'đ';
}

function fmtDate(ts) {
  if (!ts) return '—';
  return new Date(ts * 1000).toLocaleString('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

function openModal(id) { $('#' + id)?.classList.add('on'); }
function closeModal(id) { $('#' + id)?.classList.remove('on'); }

document.addEventListener('click', e => {
  if (e.target.classList?.contains('mask')) e.target.classList.remove('on');
  const x = e.target.closest('.modal-x');
  if (x) x.closest('.mask')?.classList.remove('on');
});

// ============================================================
// AUTH CHECK
// ============================================================
async function checkAuth(requireLogin = false) {
  const r = await api('/api/me');
  if (!r.ok) {
    if (requireLogin) location.href = '/login.html';
    return null;
  }
  return r.user;
}

async function logout() {
  await api('/api/logout', { method: 'POST' });
  location.href = '/login.html';
}

// ============================================================
// RENDER USER CHIP (header)
// ============================================================
async function renderUserChip() {
  const el = document.getElementById('userChip');
  if (!el) return;
  const user = await checkAuth();
  if (!user) {
    el.innerHTML = `
      <a class="btn btn-primary btn-sm" href="/login.html">Đăng nhập</a>
      <a class="btn btn-sm" href="/register.html">Đăng ký</a>
    `;
    return;
  }
  const initial = user.username.charAt(0).toUpperCase();
  el.innerHTML = `
    <div class="user-chip">
      <div class="ava">${initial}</div>
      <div class="info">
        <div class="u">${user.username}</div>
        <div class="b">💰 ${fmtPrice(user.balance)}</div>
      </div>
    </div>
    <button class="btn btn-sm" onclick="logout()">Thoát</button>
  `;
}
