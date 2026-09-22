const api = {
  async request(url, options = {}) {
    const res = await fetch(url, {
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      ...options
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || `Kesalahan (${res.status})`);
    }
    return data;
  },
  get: (url) => api.request(url),
  post: (url, body) => api.request(url, { method: 'POST', body: JSON.stringify(body || {}) }),
  put: (url, body) => api.request(url, { method: 'PUT', body: JSON.stringify(body || {}) }),
  del: (url) => api.request(url, { method: 'DELETE' })
};

const ROLE_NAMES = { admin: 'Admin', musyrif: 'Musyrif', santri: 'Santri', wali: 'Wali Santri' };
const JENIS_LABEL = { hafalan_baru: 'Hafalan Baru', tambahan: 'Tambahan', murajaah: 'Murajaah' };
const NILAI_LABEL = { lancar: 'Lancar', cukup_lancar: 'Cukup Lancar', perlu_ulang: 'Perlu Ulang' };

function badgeHtml(text, type) {
  const map = { lancar: 'badge-green', cukup_lancar: 'badge-amber', perlu_ulang: 'badge-red' };
  const cls = map[type] || 'badge-gray';
  return `<span class="badge ${cls}">${text}</span>`;
}

function escapeHtml(str) {
  return String(str == null ? '' : str).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

async function fetchMe() {
  return api.get('/api/auth/me');
}

// Proteksi halaman: cek sesi, arahkan jika belum login / role salah
async function guard(requiredRole) {
  try {
    const { user } = await fetchMe();
    if (requiredRole && user.role !== requiredRole) {
      window.location.href = redirectFor(user.role);
      return user;
    }
    renderShell(user);
    return user;
  } catch (e) {
    window.location.href = '/pages/login.html';
    return null;
  }
}

function redirectFor(role) {
  return `/pages/${role}/dashboard.html`;
}

// Render sidebar, topbar & footer
function renderShell(user) {
  const sidebar = document.getElementById('sidebar');
  const topbar = document.getElementById('topbar');
  if (!sidebar || !topbar) return;

  const nav = navigationFor(user.role);
  sidebar.innerHTML = `
    <div class="sidebar-brand">
      <div class="icon">📖</div>
      <div>
        <h1>Tahfidz Monitor</h1>
        <small>Sistem Monitoring Hafalan</small>
      </div>
    </div>
    <nav class="sidebar-nav">
      ${nav.map((n) => `
        <a href="${n.href}" data-link="${n.active ? 'yes' : ''}">
          <span>${n.icon}</span> ${n.label}
        </a>`).join('')}
    </nav>
    <div class="sidebar-footer">
      <div class="user-chip">
        <div class="avatar">${(user.nama || '?').charAt(0).toUpperCase()}</div>
        <div class="grow">
          <div class="uname">${escapeHtml(user.nama)}</div>
          <div class="urole">${ROLE_NAMES[user.role] || user.role}</div>
        </div>
      </div>
      <div class="footer-actions">
        <a class="footer-btn" href="/pages/profil/index.html">👤 Profil</a>
        <a class="footer-btn" href="#" onclick="doLogout(event)">⏻ Keluar</a>
      </div>
    </div>`;

  // tandai link aktif sesuai halaman saat ini
  const currentPath = location.pathname;
  nav.forEach((n) => { n.active = n.href.split('#')[0] === currentPath; });
  if (!nav.some((n) => n.active) && nav.length) nav[0].active = true;
  sidebar.querySelectorAll('.sidebar-nav a').forEach((a, i) => {
    if (nav[i]?.active) a.classList.add('active');
  });
  sidebar.querySelector('.sidebar-nav')?.addEventListener('click', handleSidebarClick);

  const today = new Date().toLocaleDateString('id-ID', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });
  topbar.innerHTML = `
    <div>
      <h2 id="page-title">Dashboard</h2>
      <p>${today}</p>
    </div>
    <button class="btn btn-ghost menu-btn" onclick="toggleSidebar()">☰</button>`;
}

function navigationFor(role) {
  switch (role) {
    case 'admin':
      return [
        { icon: '📊', label: 'Dashboard', href: '/pages/admin/dashboard.html', active: true },
        { icon: '👥', label: 'Santri', href: '/pages/admin/dashboard.html#tab-santri' },
        { icon: '🎯', label: 'Target Hafalan', href: '/pages/admin/dashboard.html#tab-target' },
        { icon: '👤', label: 'Pengguna', href: '/pages/admin/dashboard.html#tab-users' },
        { icon: '🔗', label: 'Relasi Wali', href: '/pages/admin/dashboard.html#tab-wali' },
        { icon: '📝', label: 'Riwayat Setoran', href: '/pages/admin/dashboard.html#tab-setoran' }
      ];
    case 'musyrif':
      return [
        { icon: '📊', label: 'Dashboard', href: '/pages/musyrif/dashboard.html', active: true },
        { icon: '👥', label: 'Santri Binaan', href: '/pages/musyrif/santri-binaan.html' },
        { icon: '🎯', label: 'Target Hafalan', href: '/pages/musyrif/target-hafalan.html' },
        { icon: '📝', label: 'Riwayat Setoran', href: '/pages/musyrif/riwayat-setoran.html' },
        { icon: '🔗', label: 'Relasi Wali', href: '/pages/musyrif/relasi-wali.html' }
      ];
    case 'santri':
      return [
        { icon: '🕌', label: 'Dashboard', href: '/pages/santri/dashboard.html', active: true }
      ];
    case 'wali':
      return [
        { icon: '👨‍👦', label: 'Perkembangan Anak', href: '/pages/wali/dashboard.html', active: true }
      ];
    default:
      return [];
  }
}

// Klik sidebar: admin pindah tab, musyrif scroll ke section tertentu
function handleSidebarClick(e) {
  const link = e.target.closest('.sidebar-nav a');
  if (!link) return;
  const href = link.getAttribute('href');
  const m = href && href.match(/#(.+)$/);
  const isCurrentPage = href && href.split('#')[0] === location.pathname;

  if (isCurrentPage && m) {
    e.preventDefault();
    const target = document.getElementById(m[1]);
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      // untuk admin, pindah tab
      if (m[1].startsWith('tab-')) {
        const btn = document.querySelector(`.tab-bar button[data-tab="${m[1].replace('tab-', '')}"]`);
        if (btn) btn.click();
      }
    }
    // sorot link aktif di sidebar
    document.querySelectorAll('.sidebar-nav a').forEach((a) => a.classList.remove('active'));
    link.classList.add('active');
  }
}

function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
}

function activateTabFromHash() {
  const hash = location.hash.replace('#', '');
  if (!hash) return;
  const tabBtn = document.querySelector(`.tab-bar button[data-tab="${hash}"]`);
  if (tabBtn) tabBtn.click();
}

window.addEventListener('hashchange', activateTabFromHash);

async function doLogout(e) {
  if (e) e.preventDefault();
  try {
    await api.post('/api/auth/logout');
  } catch (err) {
    console.error('Logout gagal:', err.message);
  }
  window.location.href = '/pages/login.html';
}

function toast(msg, ok = true) {
  const el = document.getElementById('toastBox');
  if (!el) {
    alert(msg);
    return;
  }
  el.textContent = msg;
  el.className = 'notice ' + (ok ? 'notice-ok' : 'notice-err');
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 3000);
}

function openModal(id) { const el = document.getElementById(id); if (el) el.classList.add('show'); }
function closeModal(id) { const el = document.getElementById(id); if (el) el.classList.remove('show'); }

function fmtDate(d) {
  if (!d) return '-';
  // Format SQLite 'YYYY-MM-DD HH:MM:SS' tidak dipahami Safari -> ubah ke ISO 'T'
  const date = new Date(String(d).replace(' ', 'T'));
  if (isNaN(date.getTime())) return String(d).slice(0, 10);
  return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

// Chart.js dimuat dari file lokal agar tidak perlu internet
function loadChartJs(cb) {
  if (window.Chart) return cb();
  const s = document.createElement('script');
  s.src = '/vendor/chart.umd.min.js';
  s.onload = cb;
  s.onerror = () => console.error('Gagal memuat Chart.js');
  document.head.appendChild(s);
}

// Buat chart sambil menghancurkan chart lama di box yang sama,
// agar tidak bocor memori / error "canvas already in use"
// saat halaman di-render ulang (load/refresh).
const __charts = {};
function makeChart(boxId, config) {
  const box = document.getElementById(boxId);
  if (!box || typeof Chart === 'undefined') return;
  if (__charts[boxId]) {
    try { __charts[boxId].destroy(); } catch (e) { /* abaikan */ }
    delete __charts[boxId];
  }
  box.innerHTML = '<canvas></canvas>';
  __charts[boxId] = new Chart(box.querySelector('canvas'), config);
}