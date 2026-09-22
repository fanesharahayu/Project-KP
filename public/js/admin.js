let DATA = null;

async function load() {
  guard('admin');
  showSkeleton();
  DATA = await api.get('/api/admin/stats');
  renderStats();
  renderOverview();
  renderSantri();
  renderMusyrif();
  renderWaliLinks();
  renderTarget();
  renderUsers();
  renderSetoran();
  fillSelects();
  bindTabs();
  setTimeout(() => activateTabFromHash(), 50);
}

function showSkeleton() {
  document.getElementById('statsGrid').innerHTML = '<div class="card"><p class="muted">Memuat data...</p></div>';
}

// ===== TABS =====
function bindTabs() {
  document.querySelectorAll('.tab-bar button').forEach((btn) => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      document.querySelectorAll('.tab-bar button').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      ['overview', 'santri', 'musyrif', 'wali', 'target', 'users', 'setoran'].forEach((t) => {
        const el = document.getElementById('tab-' + t);
        if (el) el.classList.toggle('hidden', t !== tab);
      });
      // update sidebar active link
      document.querySelectorAll('.sidebar-nav a').forEach((a) => {
        a.classList.remove('active');
        const h = a.getAttribute('href');
        if (tab === 'overview' && !h.includes('#')) a.classList.add('active');
        else if (h && h.endsWith('#tab-' + tab)) a.classList.add('active');
      });
      // update URL hash tanpa reload
      if (tab === 'overview') history.replaceState(null, '', location.pathname);
      else history.replaceState(null, '', '#tab-' + tab);
    });
  });
}

// ===== STATS =====
function renderStats() {
  const stats = [
    { icon: '👥', cls: 'icon-emerald', label: 'Jumlah Santri', value: DATA.jumlahSantri },
    { icon: '📝', cls: 'icon-blue', label: 'Total Setoran', value: DATA.jumlahSetoran },
    { icon: '👤', cls: 'icon-gold', label: 'Musyrif', value: DATA.jumlahMusyrif },
    { icon: '👨‍👩‍👧', cls: 'icon-purple', label: 'Wali Santri', value: DATA.jumlahWali }
  ];
  document.getElementById('statsGrid').innerHTML = stats.map((s) => `
    <div class="card stat-card">
      <div class="icon ${s.cls}">${s.icon}</div>
      <div><div class="value">${s.value}</div><div class="label">${s.label}</div></div>
    </div>`).join('');
}

// ===== OVERVIEW =====
function renderOverview() {
  const santriProgres = DATA.santri.map((s) => {
    const juzSet = new Set();
    DATA.setoran.forEach((x) => {
      if (x.santri_id === s.id && x.jenis !== 'murajaah') juzSet.add(x.juz);
    });
    const juzTercapai = juzSet.size;
    const persen = s.target_juz ? Math.round((juzTercapai / s.target_juz) * 100) : 0;
    return { s, juzTercapai, persen };
  });

  const avgPersen = santriProgres.length
    ? Math.round(santriProgres.reduce((a, p) => a + p.persen, 0) / santriProgres.length)
    : 0;
  document.getElementById('avgPersen').textContent = avgPersen + '%';
  document.getElementById('avgBar').style.width = avgPersen + '%';
  document.getElementById('avgText').textContent = DATA.santri.length
    ? `Rata-rata ${avgPersen}% dari target juz seluruh santri.`
    : 'Belum ada data santri.';

  const jenisCount = { hafalan_baru: 0, tambahan: 0, murajaah: 0 };
  const nilaiCount = { lancar: 0, cukup_lancar: 0, perlu_ulang: 0 };
  DATA.setoran.forEach((s) => {
    jenisCount[s.jenis] = (jenisCount[s.jenis] || 0) + 1;
    nilaiCount[s.nilai] = (nilaiCount[s.nilai] || 0) + 1;
  });

  loadChartJs(() => {
    document.getElementById('jenisChartBox').innerHTML = '<canvas></canvas>';
    document.getElementById('nilaiChartBox').innerHTML = '<canvas></canvas>';
    new Chart(document.querySelector('#jenisChartBox canvas'), {
      type: 'doughnut',
      data: {
        labels: ['Hafalan Baru', 'Tambahan', 'Murajaah'],
        datasets: [{ data: [jenisCount.hafalan_baru, jenisCount.tambahan, jenisCount.murajaah], backgroundColor: ['#0f766e', '#c9a227', '#2563eb'] }]
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }
    });
    new Chart(document.querySelector('#nilaiChartBox canvas'), {
      type: 'doughnut',
      data: {
        labels: ['Lancar', 'Cukup Lancar', 'Perlu Ulang'],
        datasets: [{ data: [nilaiCount.lancar, nilaiCount.cukup_lancar, nilaiCount.perlu_ulang], backgroundColor: ['#16a34a', '#d97706', '#dc2626'] }]
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }
    });
  });

  document.getElementById('overviewSantriTable').innerHTML = `
    <thead><tr><th>Nama</th><th>Kelas</th><th>Juz Dicapai</th><th>Target</th><th>Progres</th><th>Musyrif</th></tr></thead>
    <tbody>${santriProgres.map(({ s, juzTercapai, persen }) => `
      <tr>
        <td>${escapeHtml(s.nama)}</td>
        <td>${escapeHtml(s.kelas || '-')}</td>
        <td>${juzTercapai} juz</td>
        <td>${s.target_juz} juz</td>
        <td style="min-width:170px;">
          <div class="progress-wrap">
            <div class="progress-label"><span>${persen}%</span></div>
            <div class="progress-track"><div class="progress-fill" style="width:${persen}%"></div></div>
          </div>
        </td>
        <td>${escapeHtml(s.musyrif_nama || '-')}</td>
      </tr>`).join('') || `<tr><td colspan="6" class="empty">Belum ada santri</td></tr>`}</tbody>`;
}

// ===== SANTRI =====
function renderSantri() {
  document.getElementById('santriTable').innerHTML = `
    <thead><tr><th>Nama</th><th>NIS</th><th>Kelas</th><th>Musyrif</th><th>Target</th><th>Aksi</th></tr></thead>
    <tbody>${DATA.santri.map((s) => `
      <tr>
        <td>${escapeHtml(s.nama)}</td>
        <td>${escapeHtml(s.nis || '-')}</td>
        <td>${escapeHtml(s.kelas || '-')}</td>
        <td>${escapeHtml(s.musyrif_nama || 'Belum ditugaskan')}</td>
        <td>${s.target_juz} juz</td>
        <td>
          <div class="row-actions">
            <button title="Edit" onclick="editSantri(${s.id})">✏️</button>
            <button title="Hapus" onclick="confirmDeleteSantri(${s.id}, '${escapeHtml(s.nama)}')">🗑️</button>
          </div>
        </td>
      </tr>`).join('') || `<tr><td colspan="6" class="empty">Belum ada santri</td></tr>`}</tbody>`;
}

function fillSelects() {
  const musyrifs = DATA.users.filter((u) => u.role === 'musyrif');
  const waliUsers = DATA.users.filter((u) => u.role === 'wali');
  document.getElementById('f_santri_musyrif').innerHTML =
    '<option value="">Belum ditugaskan</option>' + musyrifs.map((m) => `<option value="${m.id}">${escapeHtml(m.nama)}</option>`).join('');
  document.getElementById('f_wali_user').innerHTML =
    '<option value="">Pilih wali</option>' + waliUsers.map((w) => `<option value="${w.id}">${escapeHtml(w.nama)}</option>`).join('');
  document.getElementById('f_wali_santri').innerHTML =
    '<option value="">Pilih santri</option>' + DATA.santri.map((s) => `<option value="${s.id}">${escapeHtml(s.nama)}${s.kelas ? ' (' + escapeHtml(s.kelas) + ')' : ''}</option>`).join('');
  document.getElementById('f_target_santri').innerHTML =
    '<option value="">Pilih santri</option>' + DATA.santri.map((s) => `<option value="${s.id}">${escapeHtml(s.nama)}</option>`).join('');
}

function resetSantriForm() {
  ['f_santri_id', 'f_santri_nama', 'f_santri_user', 'f_santri_email', 'f_santri_pass', 'f_santri_nis', 'f_santri_kelas', 'f_santri_tgl'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  document.getElementById('f_santri_target').value = 30;
  document.getElementById('f_santri_musyrif').value = '';
  document.getElementById('fsantri_pass_field').classList.remove('hidden');
  document.getElementById('f_santri_pass').removeAttribute('required');
}

function editSantri(id) {
  const s = DATA.santri.find((x) => x.id === id);
  if (!s) return;
  resetSantriForm();
  document.getElementById('santriModalTitle').textContent = '✏️ Edit Santri';
  document.getElementById('f_santri_id').value = s.id;
  document.getElementById('f_santri_nama').value = s.nama;
  document.getElementById('f_santri_user').value = s.username;
  document.getElementById('f_santri_user').disabled = true;
  document.getElementById('f_santri_email').value = s.email;
  document.getElementById('f_santri_email').disabled = true;
  document.getElementById('fsantri_pass_field').classList.add('hidden');
  document.getElementById('f_santri_nis').value = s.nis || '';
  document.getElementById('f_santri_kelas').value = s.kelas || '';
  document.getElementById('f_santri_target').value = s.target_juz;
  document.getElementById('f_santri_tgl').value = s.tanggal_bergabung || '';
  document.getElementById('f_santri_musyrif').value = s.musyrif_id || '';
  openModal('modalSantri');
}

function openAddSantri() {
  resetSantriForm();
  document.getElementById('santriModalTitle').textContent = '➕ Tambah Santri';
  document.getElementById('f_santri_user').disabled = false;
  document.getElementById('f_santri_email').disabled = false;
  document.getElementById('f_santri_user').setAttribute('required', '');
  document.getElementById('f_santri_email').setAttribute('required', '');
  openModal('modalSantri');
}

async function saveSantri() {
  const id = document.getElementById('f_santri_id').value;
  const body = {
    nama: document.getElementById('f_santri_nama').value.trim(),
    nis: document.getElementById('f_santri_nis').value.trim(),
    kelas: document.getElementById('f_santri_kelas').value.trim(),
    target_juz: Number(document.getElementById('f_santri_target').value) || 30,
    musyrif_id: document.getElementById('f_santri_musyrif').value || null,
    tanggal_bergabung: document.getElementById('f_santri_tgl').value || null
  };
  try {
    if (id) {
      await api.put('/api/admin/santri/' + id, body);
    } else {
      body.username = document.getElementById('f_santri_user').value.trim();
      body.email = document.getElementById('f_santri_email').value.trim();
      body.password = document.getElementById('f_santri_pass').value;
      await api.post('/api/admin/santri', body);
    }
    closeModal('modalSantri');
    toast('Santri disimpan');
    await load();
  } catch (e) { toast(e.message, false); }
}

function confirmDeleteSantri(id, nama) {
  const s = DATA.santri.find((x) => x.id === id);
  if (!confirm(`Hapus santri ${nama}? Semua data hafalan ikut terhapus.`)) return;
  api.del('/api/admin/users/' + s.user_id).then(async () => {
    toast('Santri dihapus');
    await load();
  }).catch((e) => toast(e.message, false));
}

// ===== MUSYRIF =====
function renderMusyrif() {
  const musyrifs = DATA.users.filter((u) => u.role === 'musyrif');
  const counts = DATA.santri.reduce((acc, s) => {
    if (s.musyrif_id) acc[s.musyrif_id] = (acc[s.musyrif_id] || 0) + 1;
    return acc;
  }, {});
  document.getElementById('musyrifTable').innerHTML = `
    <thead><tr><th>Nama</th><th>Username</th><th>Email</th><th>Santri Binaan</th><th>Aksi</th></tr></thead>
    <tbody>${musyrifs.map((u) => `
      <tr>
        <td>${escapeHtml(u.nama)}</td>
        <td>${escapeHtml(u.username)}</td>
        <td>${escapeHtml(u.email)}</td>
        <td>${counts[u.id] || 0} santri</td>
        <td><div class="row-actions"><button title="Hapus" onclick="confirmDeleteUser(${u.id}, '${escapeHtml(u.nama)}')">🗑️</button></div></td>
      </tr>`).join('') || `<tr><td colspan="5" class="empty">Belum ada musyrif</td></tr>`}</tbody>`;
}

async function saveMusyrif() {
  try {
    await api.post('/api/admin/users', {
      nama: document.getElementById('f_musyrif_nama').value.trim(),
      username: document.getElementById('f_musyrif_user').value.trim(),
      email: document.getElementById('f_musyrif_email').value.trim(),
      password: document.getElementById('f_musyrif_pass').value,
      role: 'musyrif'
    });
    closeModal('modalMusyrif');
    toast('Musyrif ditambahkan');
    await load();
  } catch (e) { toast(e.message, false); }
}

// ===== USERS =====
function renderUsers() {
  const roles = { admin: 'role-admin', musyrif: 'role-musyrif', santri: 'role-santri', wali: 'role-wali' };
  document.getElementById('userTable').innerHTML = `
    <thead><tr><th>Nama</th><th>Username</th><th>Email</th><th>Role</th><th>Aksi</th></tr></thead>
    <tbody>${DATA.users.map((u) => `
      <tr>
        <td>${escapeHtml(u.nama)}</td>
        <td>${escapeHtml(u.username)}</td>
        <td>${escapeHtml(u.email)}</td>
        <td><span class="role-pill ${roles[u.role]}">${ROLE_NAMES[u.role] || u.role}</span></td>
        <td>
          <div class="row-actions">
            <button title="Hapus" onclick="confirmDeleteUser(${u.id}, '${escapeHtml(u.nama)}')">🗑️</button>
          </div>
        </td>
      </tr>`).join('')}</tbody>`;
}

async function saveUser() {
  try {
    await api.post('/api/admin/users', {
      nama: document.getElementById('f_user_nama').value.trim(),
      username: document.getElementById('f_user_username').value.trim(),
      email: document.getElementById('f_user_email').value.trim(),
      password: document.getElementById('f_user_pass').value,
      role: document.getElementById('f_user_role').value
    });
    closeModal('modalUser');
    toast('Pengguna ditambahkan');
    await load();
  } catch (e) { toast(e.message, false); }
}

function confirmDeleteUser(id, nama) {
  if (!confirm(`Hapus pengguna ${nama}?`)) return;
  api.del('/api/admin/users/' + id).then(async () => {
    toast('Pengguna dihapus');
    await load();
  }).catch((e) => toast(e.message, false));
}

// ===== WALI LINKS =====
async function renderWaliLinks() {
  const rows = await api.get('/api/admin/wali-links');
  const santriMap = Object.fromEntries(DATA.santri.map((s) => [s.id, s]));
  const waliMap = Object.fromEntries(DATA.users.filter((u) => u.role === 'wali').map((w) => [w.id, w]));
  document.getElementById('waliTable').innerHTML = `
    <thead><tr><th>Wali</th><th>Santri</th><th>Relasi</th><th>Kelas</th><th>Aksi</th></tr></thead>
    <tbody>${rows.map((r) => `
      <tr>
        <td>${escapeHtml((waliMap[r.wali_user_id] || {}).nama || '?')}</td>
        <td>${escapeHtml((santriMap[r.santri_id] || {}).nama || '?')}</td>
        <td>${escapeHtml(r.relasi || 'Wali Santri')}</td>
        <td>${escapeHtml((santriMap[r.santri_id] || {}).kelas || '-')}</td>
        <td><div class="row-actions"><button title="Hapus" onclick="deleteWaliLink(${r.id})">🗑️</button></div></td>
      </tr>`).join('') || `<tr><td colspan="5" class="empty">Belum ada relasi wali</td></tr>`}</tbody>`;
}

async function deleteWaliLink(id) {
  if (!confirm('Hapus hubungan wali-santri ini?')) return;
  try {
    await api.del('/api/admin/wali-link/' + id);
    toast('Hubungan dihapus');
    await load();
  } catch (e) { toast(e.message, false); }
}

async function saveWaliLink() {
  try {
    await api.post('/api/admin/wali-link', {
      wali_user_id: document.getElementById('f_wali_user').value,
      santri_id: document.getElementById('f_wali_santri').value,
      relasi: document.getElementById('f_wali_relasi').value.trim()
    });
    closeModal('modalWaliLink');
    toast('Relasi wali-santri dibuat');
    await load();
  } catch (e) { toast(e.message, false); }
}

// ===== TARGET =====
function renderTarget() {
  document.getElementById('targetTable').innerHTML = `
    <thead><tr><th>Santri</th><th>Target Juz</th><th>Periode</th><th>Tanggal</th><th>Aksi</th></tr></thead>
    <tbody>${DATA.target.map((t) => `
      <tr>
        <td>${escapeHtml(t.santri_nama)}</td>
        <td>${t.target_juz} juz</td>
        <td>${escapeHtml(t.periode || '-')}</td>
        <td>${fmtDate(t.tanggal_mulai)} → ${fmtDate(t.tanggal_selesai)}</td>
        <td><div class="row-actions"><button title="Hapus" onclick="deleteTarget(${t.id})">🗑️</button></div></td>
      </tr>`).join('') || `<tr><td colspan="5" class="empty">Belum ada target</td></tr>`}</tbody>`;
}

async function saveTarget() {
  try {
    await api.post('/api/admin/target', {
      santri_id: document.getElementById('f_target_santri').value,
      target_juz: Number(document.getElementById('f_target_juz').value) || 1,
      periode: document.getElementById('f_target_periode').value.trim(),
      tanggal_mulai: document.getElementById('f_target_mulai').value || null,
      tanggal_selesai: document.getElementById('f_target_selesai').value || null
    });
    closeModal('modalTarget');
    toast('Target hafalan disimpan');
    await load();
  } catch (e) { toast(e.message, false); }
}

function deleteTarget(id) {
  if (!confirm('Hapus target hafalan ini?')) return;
  api.del('/api/admin/target/' + id).then(async () => {
    toast('Target dihapus');
    await load();
  }).catch((e) => toast(e.message, false));
}

// ===== SETORAN =====
function renderSetoran() {
  document.getElementById('setoranTable').innerHTML = `
    <thead><tr><th>Tanggal</th><th>Santri</th><th>Musyrif</th><th>Juz</th><th>Surah</th><th>Ayat</th><th>Jenis</th><th>Nilai</th><th>Aksi</th></tr></thead>
    <tbody>${DATA.setoran.map((s) => `
      <tr>
        <td>${fmtDate(s.created_at)}</td>
        <td>${escapeHtml(s.santri_nama)}</td>
        <td>${escapeHtml(s.musyrif_nama)}</td>
        <td>${s.juz}</td>
        <td>${escapeHtml(s.surah)}</td>
        <td>${s.ayat_awal}-${s.ayat_akhir}</td>
        <td>${badgeHtml(JENIS_LABEL[s.jenis] || s.jenis, s.jenis)}</td>
        <td>${badgeHtml(NILAI_LABEL[s.nilai] || s.nilai, s.nilai)}</td>
        <td><div class="row-actions">
          <button title="Edit" onclick="editAdminSetoran(${s.id})">✏️</button>
          <button title="Hapus" onclick="deleteAdminSetoran(${s.id})">🗑️</button>
        </div></td>
      </tr>`).join('') || `<tr><td colspan="9" class="empty">Belum ada setoran</td></tr>`}</tbody>`;
}

function fillAdminSetoranSelects() {
  document.getElementById('adf_santri').innerHTML = DATA.santri.map((s) =>
    `<option value="${s.id}">${escapeHtml(s.nama)} (${escapeHtml(s.kelas || '-')})</option>`
  ).join('');
  document.getElementById('adf_musyrif').innerHTML = DATA.users.filter((u) => u.role === 'musyrif').map((m) =>
    `<option value="${m.id}">${escapeHtml(m.nama)}</option>`
  ).join('');
}

function openAdminSetoranForm(id) {
  fillAdminSetoranSelects();
  document.getElementById('adf_setoran_id').value = '';
  ['adf_juz', 'adf_surah', 'adf_awal', 'adf_akhir', 'adf_catatan'].forEach((x) => (document.getElementById(x).value = ''));
  document.getElementById('adf_awal').value = 1;
  document.getElementById('adf_akhir').value = 7;
  document.getElementById('adf_jenis').value = 'hafalan_baru';
  document.getElementById('adf_nilai').value = 'lancar';
  document.getElementById('adminSetoranTitle').textContent = '➕ Tambah Setoran';
  openModal('modalAdminSetoran');
}

function editAdminSetoran(id) {
  const s = DATA.setoran.find((x) => x.id === id);
  if (!s) return;
  fillAdminSetoranSelects();
  document.getElementById('adf_setoran_id').value = s.id;
  document.getElementById('adf_santri').value = s.santri_id;
  document.getElementById('adf_musyrif').value = s.musyrif_id;
  document.getElementById('adf_juz').value = s.juz;
  document.getElementById('adf_surah').value = s.surah;
  document.getElementById('adf_awal').value = s.ayat_awal;
  document.getElementById('adf_akhir').value = s.ayat_akhir;
  document.getElementById('adf_jenis').value = s.jenis;
  document.getElementById('adf_nilai').value = s.nilai;
  document.getElementById('adf_catatan').value = s.catatan || '';
  document.getElementById('adminSetoranTitle').textContent = '✏️ Edit Setoran';
  openModal('modalAdminSetoran');
}

async function saveAdminSetoran() {
  const id = document.getElementById('adf_setoran_id').value;
  const body = {
    santri_id: document.getElementById('adf_santri').value,
    musyrif_id: document.getElementById('adf_musyrif').value,
    juz: Number(document.getElementById('adf_juz').value),
    surah: document.getElementById('adf_surah').value.trim(),
    ayat_awal: Number(document.getElementById('adf_awal').value) || 0,
    ayat_akhir: Number(document.getElementById('adf_akhir').value) || 0,
    jenis: document.getElementById('adf_jenis').value,
    nilai: document.getElementById('adf_nilai').value,
    catatan: document.getElementById('adf_catatan').value.trim()
  };
  if (!body.santri_id || !body.musyrif_id || !body.juz || !body.surah) {
    return toast('Lengkapi santri, musyrif, juz, dan surah', false);
  }
  try {
    if (id) await api.put('/api/admin/setoran/' + id, body);
    else await api.post('/api/admin/setoran', body);
    closeModal('modalAdminSetoran');
    toast('Setoran disimpan');
    await load();
  } catch (e) { toast(e.message, false); }
}

function deleteAdminSetoran(id) {
  if (!confirm('Hapus catatan setoran ini?')) return;
  api.del('/api/admin/setoran/' + id).then(async () => {
    toast('Setoran dihapus');
    await load();
  }).catch((e) => toast(e.message, false));
}

load();