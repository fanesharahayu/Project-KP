let SANTRIS = [];
let ALLSETORAN = [];
let currentSantriId = null;
let currentDetail = null;
let setoranFilter = '';

function has(el) { return !!document.getElementById(el); }

async function load() {
  try {
    await guard('musyrif');
  } catch (e) {
    return; // guard sudah redirect ke login
  }
  const titleEl = document.getElementById('page-title');
  if (titleEl) {
    if (has('santriList')) titleEl.textContent = 'Santri Binaan';
    else if (has('allSetoranTable')) titleEl.textContent = 'Riwayat Setoran';
    else if (has('targetListTable')) titleEl.textContent = 'Target Hafalan';
    else if (has('waliTable')) titleEl.textContent = 'Relasi Wali';
    else titleEl.textContent = 'Dashboard Musyrif';
  }
  try {
    SANTRIS = await api.get('/api/musyrif/santri');
  } catch (e) {
    toast('Gagal memuat data: ' + e.message, false);
    return;
  }
  if (has('targetListTable')) { await loadTargets(); return; }
  if (has('waliTable')) { await loadWaliLinks(); return; }
  try {
    ALLSETORAN = await api.get('/api/musyrif/setoran');
  } catch (e) {
    toast('Gagal memuat riwayat setoran: ' + e.message, false);
    ALLSETORAN = [];
  }
  if (has('f_santri_add_mode')) {
    document.getElementById('f_santri_add_mode').addEventListener('change', toggleAddMode);
  }
  if (has('statsGrid')) renderStats();
  if (has('avgPersen')) renderCharts();
  if (has('santriList')) renderList();
  if (has('recentSetoranTable')) renderRecentSetoran();
  if (has('allSetoranTable')) renderAllSetoran();
  if (has('detailCard')) hideDetail();
}

function renderStats() {
  const totalJuz = SANTRIS.reduce((a, s) => a + s.progress.juzTercapai, 0);
  const totalTarget = SANTRIS.reduce((a, s) => a + s.progress.targetJuz, 0);
  const beresTarget = SANTRIS.filter((s) => s.progress.persenJuz >= 100).length;
  const stats = [
    { icon: '👥', cls: 'icon-emerald', label: 'Santri Binaan', value: SANTRIS.length },
    { icon: '📖', cls: 'icon-blue', label: 'Juz Terhafal', value: totalJuz + ' / ' + totalTarget + ' juz' },
    { icon: '🏆', cls: 'icon-gold', label: 'Tuntas Target', value: beresTarget + ' santri' }
  ];
  document.getElementById('statsGrid').innerHTML = stats.map((s) => `
    <div class="card stat-card">
      <div class="icon ${s.cls}">${s.icon}</div>
      <div><div class="value">${s.value}</div><div class="label">${s.label}</div></div>
    </div>`).join('');
}

function setoranRow(x, withSantri) {
  return `
    <tr>
      <td>${fmtDate(x.created_at)}</td>
      ${withSantri ? tds(escapeHtml(x.santri_nama), escapeHtml(x.kelas || '-')) : ''}
      <td>${x.juz}</td>
      <td>${escapeHtml(x.surah)}</td>
      <td>${x.ayat_awal}-${x.ayat_akhir}</td>
      <td>${badgeHtml(JENIS_LABEL[x.jenis] || x.jenis, x.jenis)}</td>
      <td>${badgeHtml(NILAI_LABEL[x.nilai] || x.nilai, x.nilai)}</td>
      <td><div class="row-actions">
        <button title="Edit" onclick="editSetoranAll(${x.id})">✏️</button>
        <button title="Hapus" onclick="deleteSetoran(${x.id})">🗑️</button>
      </div></td>
    </tr>`;
}

function tds() { return Array.from(arguments).map((t) => `<td>${t}</td>`).join(''); }

function saidahSetoran(x) {
  const q = setoranFilter.toLowerCase();
  return !q || (x.santri_nama && x.santri_nama.toLowerCase().includes(q)) || (x.surah && x.surah.toLowerCase().includes(q)) || (x.kelas && x.kelas.toLowerCase().includes(q));
}

function renderList() {
  const list = document.getElementById('santriList');
  list.innerHTML = SANTRIS.map((s) => `
    <div class="santri-card" onclick="openDetail(${s.santri_id})">
      <div class="top">
        <div class="avatar">${escapeHtml(s.nama).charAt(0)}</div>
        <div class="grow">
          <h4>${escapeHtml(s.nama)}</h4>
          <div class="sub">${escapeHtml(s.kelas || 'Tanpa kelas')} • NIS ${escapeHtml(s.nis || '-')}</div>
        </div>
        <button class="btn btn-outline btn-sm" onclick="openSetoranForm(${s.santri_id}); event.stopPropagation();">📝</button>
      </div>
      <div class="progress-wrap">
        <div class="progress-label"><span>${s.progress.juzTercapai} juz dicapai</span><span>${s.progress.persenJuz}%</span></div>
        <div class="progress-track"><div class="progress-fill" style="width:${s.progress.persenJuz}%"></div></div>
      </div>
      <div class="sub" style="margin-top:8px;">🎯 Target ${s.progress.targetJuz} juz • ${s.setoranCount} kali setoran</div>
    </div>`).join('') || '<p class="muted">Belum ada santri yang ditugaskan kepada Anda.</p>';
}

function renderCharts() {
  const avgPersen = SANTRIS.length
    ? Math.round(SANTRIS.reduce((a, s) => a + s.progress.persenJuz, 0) / SANTRIS.length)
    : 0;
  document.getElementById('avgPersen').textContent = avgPersen + '%';
  document.getElementById('avgBar').style.width = avgPersen + '%';
  document.getElementById('avgText').textContent = SANTRIS.length
    ? `Rata-rata ${avgPersen}% dari target juz ${SANTRIS.length} santri binaan.`
    : 'Belum ada santri binaan.';

  const jenisCount = { hafalan_baru: 0, tambahan: 0, murajaah: 0 };
  const nilaiCount = { lancar: 0, cukup_lancar: 0, perlu_ulang: 0 };
  ALLSETORAN.forEach((s) => {
    jenisCount[s.jenis] = (jenisCount[s.jenis] || 0) + 1;
    nilaiCount[s.nilai] = (nilaiCount[s.nilai] || 0) + 1;
  });

  loadChartJs(() => {
    makeChart('jenisChartBox', {
      type: 'doughnut',
      data: {
        labels: ['Hafalan Baru', 'Tambahan', 'Murajaah'],
        datasets: [{ data: [jenisCount.hafalan_baru, jenisCount.tambahan, jenisCount.murajaah], backgroundColor: ['#0f766e', '#c9a227', '#2563eb'] }]
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }
    });
    makeChart('nilaiChartBox', {
      type: 'doughnut',
      data: {
        labels: ['Lancar', 'Cukup Lancar', 'Perlu Ulang'],
        datasets: [{ data: [nilaiCount.lancar, nilaiCount.cukup_lancar, nilaiCount.perlu_ulang], backgroundColor: ['#16a34a', '#d97706', '#dc2626'] }]
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }
    });
  });
}

function renderRecentSetoran() {
  const rows = ALLSETORAN.filter(saidahSetoran).slice(0, 8);
  document.getElementById('recentSetoranTable').innerHTML = `
    <thead><tr><th>Tanggal</th><th>Santri</th><th>Juz</th><th>Surah</th><th>Ayat</th><th>Jenis</th><th>Nilai</th></tr></thead>
    <tbody>${rows.map((x) => `
      <tr>
        <td>${fmtDate(x.created_at)}</td>
        <td>${escapeHtml(x.santri_nama)}</td>
        <td>${x.juz}</td>
        <td>${escapeHtml(x.surah)}</td>
        <td>${x.ayat_awal}-${x.ayat_akhir}</td>
        <td>${badgeHtml(JENIS_LABEL[x.jenis] || x.jenis, x.jenis)}</td>
        <td>${badgeHtml(NILAI_LABEL[x.nilai] || x.nilai, x.nilai)}</td>
      </tr>`).join('') || `<tr><td colspan="7" class="empty">Belum ada setoran</td></tr>`}</tbody>`;
}

function filterSetoran() {
  setoranFilter = document.getElementById('setoranSearch').value;
  renderAllSetoran();
}

function renderAllSetoran() {
  const rows = ALLSETORAN.filter(saidahSetoran);
  document.getElementById('allSetoranTable').innerHTML = `
    <thead><tr><th>Tanggal</th><th>Santri</th><th>Kelas</th><th>Juz</th><th>Surah</th><th>Ayat</th><th>Jenis</th><th>Nilai</th><th>Aksi</th></tr></thead>
    <tbody>${rows.map((x) => setoranRow(x, true)).join('') || `<tr><td colspan="9" class="empty">Belum ada riwayat setoran</td></tr>`}</tbody>`;
}

function editSetoranAll(id) {
  if (!currentSantriId) {
    // cari santri dari data
    const x = ALLSETORAN.find((s) => s.id === id);
    if (x) currentSantriId = x.santri_id;
    else return;
  }
  const x = ALLSETORAN.find((s) => s.id === id);
  if (!x) return;
  document.getElementById('f_setoran_id').value = x.id;
  document.getElementById('f_setoran_santri').value = x.santri_id;
  document.getElementById('f_setoran_juz').value = x.juz;
  document.getElementById('f_setoran_awal').value = x.ayat_awal;
  document.getElementById('f_setoran_akhir').value = x.ayat_akhir;
  document.getElementById('f_setoran_surah').value = x.surah;
  document.getElementById('f_setoran_jenis').value = x.jenis;
  document.getElementById('f_setoran_nilai').value = x.nilai;
  document.getElementById('f_setoran_catatan').value = x.catatan || '';
  document.getElementById('f_setoran_santri').disabled = true;
  document.getElementById('setoranModalTitle').textContent = '✏️ Edit Setoran';
  openModal('modalSetoran');
}

async function openDetail(santriId) {
  currentSantriId = santriId;
  const data = await api.get('/api/musyrif/santri/' + santriId);
  currentDetail = data;

  const s = data.santri;
  document.getElementById('detailTitle').textContent = `👤 ${s.nama} (${s.kelas || 'Tanpa kelas'})`;
  document.getElementById('dJuz').textContent = data.progress.juzTercapai + ' juz';
  document.getElementById('dTarget').textContent = data.progress.persenJuz + '%';
  document.getElementById('dtotalSetoran').textContent = data.progress.totalSetoran;
  document.getElementById('dLancar').textContent = data.progress.lancar + ' 🟢';
  document.getElementById('dSurah').textContent = s.musyrif_nama || '-';
  document.getElementById('dprogressText').textContent = data.progress.persenJuz + '%';
  document.getElementById('dprogressBar').style.width = data.progress.persenJuz + '%';

  document.getElementById('binaan').classList.add('hidden');
  document.getElementById('detailCard').classList.remove('hidden');

  // grafik
  loadChartJs(() => {
    makeChart('chartBox', {
      type: 'line',
      data: {
        labels: data.grafik.map((g) => g.tanggal),
        datasets: [{
          label: 'Juz tercapai',
          data: data.grafik.map((g) => g.juz),
          borderColor: '#0f766e',
          backgroundColor: 'rgba(15,118,110,0.15)',
          fill: true,
          tension: 0.3,
          borderWidth: 2
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        scales: {
          y: { beginAtZero: true, title: { display: true, text: 'Juz' } },
          x: { title: { display: true, text: 'Tanggal' } }
        },
        plugins: { legend: { display: false } }
      }
    });
  });

  renderSetoranTable();
  renderTargetTable();
  renderSetoranSantriSelect();
}

function hideDetail() {
  document.getElementById('detailCard').classList.add('hidden');
  document.getElementById('binaan').classList.remove('hidden');
  currentSantriId = null;
  currentDetail = null;
}

function renderSetoranTable() {
  document.getElementById('setoranTable').innerHTML = `
    <thead><tr><th>Tanggal</th><th>Juz</th><th>Surah</th><th>Ayat</th><th>Jenis</th><th>Nilai</th><th>Catatan</th><th>Aksi</th></tr></thead>
    <tbody>${currentDetail.setoran.map((x) => `
      <tr>
        <td>${fmtDate(x.created_at)}</td>
        <td>${x.juz}</td>
        <td>${escapeHtml(x.surah)}</td>
        <td>${x.ayat_awal}-${x.ayat_akhir}</td>
        <td>${badgeHtml(JENIS_LABEL[x.jenis] || x.jenis, x.jenis)}</td>
        <td>${badgeHtml(NILAI_LABEL[x.nilai] || x.nilai, x.nilai)}</td>
        <td>${escapeHtml(x.catatan || '-')}</td>
        <td><div class="row-actions">
          <button title="Edit" onclick="editSetoran(${x.id})">✏️</button>
          <button title="Hapus" onclick="deleteSetoran(${x.id})">🗑️</button>
        </div></td>
      </tr>`).join('') || `<tr><td colspan="8" class="empty">Belum ada setoran</td></tr>`}</tbody>`;
}

function renderTargetTable() {
  document.getElementById('targetTable').innerHTML = `
    <thead><tr><th>Target Juz</th><th>Periode</th><th>Periode Waktu</th></tr></thead>
    <tbody>${currentDetail.targets.map((t) => `
      <tr>
        <td>${t.target_juz} juz</td>
        <td>${escapeHtml(t.periode || '-')}</td>
        <td>${fmtDate(t.tanggal_mulai)} → ${fmtDate(t.tanggal_selesai)}</td>
      </tr>`).join('') || `<tr><td colspan="3" class="empty">Belum ada target khusus</td></tr>`}</tbody>`;
}

function renderSetoranSantriSelect() {
  const sel = document.getElementById('f_setoran_santri');
  sel.innerHTML = SANTRIS.map((s) =>
    `<option value="${s.santri_id}" ${s.santri_id === currentSantriId ? 'selected' : ''}>${escapeHtml(s.nama)}</option>`
  ).join('');
}

function openSantriForm() {
  ['f_santri_nama', 'f_santri_nis', 'f_santri_kelas', 'f_santri_email', 'f_santri_username', 'f_santri_password'].forEach((x) => (document.getElementById(x).value = ''));
  document.getElementById('f_santri_target').value = 30;
  document.getElementById('f_santri_add_mode').value = 'pick';
  toggleAddMode();
  api.get('/api/musyrif/santri/unassigned').then((list) => {
    const sel = document.getElementById('f_santri_pick');
    sel.innerHTML = list.map((s) =>
      `<option value="${s.santri_id}">${escapeHtml(s.nama)}${s.kelas ? ' · ' + escapeHtml(s.kelas) : ''}</option>`
    ).join('') || '<option value="">Belum ada santri terdaftar</option>';
  }).catch(() => {});
  openModal('modalSantri');
}

function toggleAddMode() {
  const mode = document.getElementById('f_santri_add_mode').value;
  document.getElementById('pickSantriSection').classList.toggle('hidden', mode !== 'pick');
  document.getElementById('newSantriSection').classList.toggle('hidden', mode !== 'new');
}

async function saveSantri() {
  const mode = document.getElementById('f_santri_add_mode').value;
  try {
    if (mode === 'pick') {
      const santriId = document.getElementById('f_santri_pick').value;
      if (!santriId) return toast('Pilih santri terlebih dahulu', false);
      await api.post('/api/musyrif/santri/' + santriId + '/assign');
      closeModal('modalSantri');
      toast('Santri berhasil diangkat menjadi binaan Anda');
    } else {
      const body = {
        nama: document.getElementById('f_santri_nama').value.trim(),
        nis: document.getElementById('f_santri_nis').value.trim(),
        kelas: document.getElementById('f_santri_kelas').value.trim(),
        target_juz: Number(document.getElementById('f_santri_target').value) || 30,
        email: document.getElementById('f_santri_email').value.trim(),
        username: document.getElementById('f_santri_username').value.trim(),
        password: document.getElementById('f_santri_password').value
      };
      if (!body.nama || !body.email || !body.username || !body.password) {
        return toast('Lengkapi nama, email, username, dan password', false);
      }
      await api.post('/api/musyrif/santri', body);
      closeModal('modalSantri');
      toast('Santri berhasil ditambahkan ke binaan Anda');
    }
    await refreshAll();
  } catch (e) { toast(e.message, false); }
}

function openSetoranForm(santriId) {
  currentSantriId = santriId;
  document.getElementById('f_setoran_id').value = '';
  document.getElementById('f_setoran_juz').value = '';
  document.getElementById('f_setoran_awal').value = '';
  document.getElementById('f_setoran_akhir').value = '';
  document.getElementById('f_setoran_surah').value = '';
  document.getElementById('f_setoran_jenis').value = 'hafalan_baru';
  document.getElementById('f_setoran_nilai').value = 'lancar';
  document.getElementById('f_setoran_catatan').value = '';
  document.getElementById('setoranModalTitle').textContent = '➕ Catat Setoran Hafalan';
  document.getElementById('f_setoran_santri').disabled = false;
  renderSetoranSantriSelect();
  openModal('modalSetoran');
}

function editSetoran(id) {
  const x = currentDetail.setoran.find((s) => s.id === id);
  if (!x) return;
  document.getElementById('f_setoran_id').value = x.id;
  document.getElementById('f_setoran_santri').value = x.santri_id;
  document.getElementById('f_setoran_juz').value = x.juz;
  document.getElementById('f_setoran_awal').value = x.ayat_awal;
  document.getElementById('f_setoran_akhir').value = x.ayat_akhir;
  document.getElementById('f_setoran_surah').value = x.surah;
  document.getElementById('f_setoran_jenis').value = x.jenis;
  document.getElementById('f_setoran_nilai').value = x.nilai;
  document.getElementById('f_setoran_catatan').value = x.catatan || '';
  document.getElementById('f_setoran_santri').disabled = true;
  document.getElementById('setoranModalTitle').textContent = '✏️ Edit Setoran';
  openModal('modalSetoran');
}

async function saveSetoran() {
  const id = document.getElementById('f_setoran_id').value;
  const santriId = document.getElementById('f_setoran_santri').value;
  const body = {
    juz: Number(document.getElementById('f_setoran_juz').value),
    surah: document.getElementById('f_setoran_surah').value.trim(),
    ayat_awal: Number(document.getElementById('f_setoran_awal').value) || 0,
    ayat_akhir: Number(document.getElementById('f_setoran_akhir').value) || 0,
    jenis: document.getElementById('f_setoran_jenis').value,
    nilai: document.getElementById('f_setoran_nilai').value,
    catatan: document.getElementById('f_setoran_catatan').value.trim()
  };
  try {
    if (id) {
      await api.put('/api/musyrif/setoran/' + id, body);
    } else {
      await api.post('/api/musyrif/santri/' + santriId + '/setoran', body);
    }
    closeModal('modalSetoran');
    document.getElementById('f_setoran_santri').disabled = false;
    toast('Setoran disimpan');
    await refreshAll();
  } catch (e) {
    toast(e.message, false);
    document.getElementById('f_setoran_santri').disabled = false;
  }
}

function deleteSetoran(id) {
  if (!confirm('Hapus catatan setoran ini?')) return;
  api.del('/api/musyrif/setoran/' + id).then(async () => {
    toast('Setoran dihapus');
    await refreshAll();
  }).catch((e) => toast(e.message, false));
}

async function refreshAll() {
  SANTRIS = await api.get('/api/musyrif/santri');
  ALLSETORAN = await api.get('/api/musyrif/setoran');
  if (has('statsGrid')) renderStats();
  if (has('avgPersen')) renderCharts();
  if (has('santriList')) renderList();
  if (has('recentSetoranTable')) renderRecentSetoran();
  if (has('allSetoranTable')) renderAllSetoran();
  if (currentSantriId != null && has('detailCard') && !document.getElementById('detailCard').classList.contains('hidden')) {
    await openDetail(currentSantriId);
  }
}

// ===== TARGET HAFALAN (halaman target-hafalan.html) =====
let TARGETS = [];

async function loadTargets() {
  TARGETS = await api.get('/api/musyrif/targets');
  renderTargetList();
}

function renderTargetList() {
  document.getElementById('targetListTable').innerHTML = `
    <thead><tr><th>Santri</th><th>Kelas</th><th>Target Juz</th><th>Periode</th><th>Tanggal</th><th>Aksi</th></tr></thead>
    <tbody>${TARGETS.map((t) => `
      <tr>
        <td>${escapeHtml(t.santri_nama)}</td>
        <td>${escapeHtml(t.kelas || '-')}</td>
        <td>${t.target_juz} juz</td>
        <td>${escapeHtml(t.periode || '-')}</td>
        <td>${fmtDate(t.tanggal_mulai)} → ${fmtDate(t.tanggal_selesai)}</td>
        <td><div class="row-actions"><button title="Hapus" onclick="deleteTarget(${t.id})">🗑️</button></div></td>
      </tr>`).join('') || `<tr><td colspan="6" class="empty">Belum ada target hafalan</td></tr>`}</tbody>`;
}

function openTargetForm() {
  document.getElementById('f_target_santri').innerHTML = SANTRIS.map((s) =>
    `<option value="${s.santri_id}">${escapeHtml(s.nama)} (${escapeHtml(s.kelas || '-')})</option>`
  ).join('');
  document.getElementById('f_target_juz').value = 1;
  document.getElementById('f_target_periode').value = '';
  document.getElementById('f_target_mulai').value = '';
  document.getElementById('f_target_selesai').value = '';
  openModal('modalTarget');
}

async function saveTarget() {
  const santri_id = document.getElementById('f_target_santri').value;
  if (!santri_id) return toast('Pilih santri terlebih dahulu', false);
  try {
    await api.post('/api/musyrif/target', {
      santri_id,
      target_juz: Number(document.getElementById('f_target_juz').value) || 1,
      periode: document.getElementById('f_target_periode').value.trim(),
      tanggal_mulai: document.getElementById('f_target_mulai').value || null,
      tanggal_selesai: document.getElementById('f_target_selesai').value || null
    });
    closeModal('modalTarget');
    toast('Target hafalan disimpan');
    await loadTargets();
  } catch (e) { toast(e.message, false); }
}

function deleteTarget(id) {
  if (!confirm('Hapus target hafalan ini?')) return;
  api.del('/api/musyrif/target/' + id).then(async () => {
    toast('Target dihapus');
    await loadTargets();
  }).catch((e) => toast(e.message, false));
}

// ===== RELASI WALI (halaman relasi-wali.html) =====
let WALIS = [];

async function loadWaliLinks() {
  WALIS = await api.get('/api/musyrif/walis');
  const links = await api.get('/api/musyrif/wali-links');
  renderWaliLinks(links);
}

function renderWaliLinks(links) {
  document.getElementById('waliTable').innerHTML = `
    <thead><tr><th>Wali</th><th>Santri</th><th>Kelas</th><th>Relasi</th><th>Aksi</th></tr></thead>
    <tbody>${links.map((r) => `
      <tr>
        <td>${escapeHtml(r.wali_nama || '?')}</td>
        <td>${escapeHtml(r.santri_nama || '?')}</td>
        <td>${escapeHtml(r.kelas || '-')}</td>
        <td>${escapeHtml(r.relasi || 'Wali Santri')}</td>
        <td><div class="row-actions"><button title="Hapus" onclick="deleteWaliLink(${r.id})">🗑️</button></div></td>
      </tr>`).join('') || `<tr><td colspan="5" class="empty">Belum ada relasi wali</td></tr>`}</tbody>`;
}

function openWaliForm() {
  document.getElementById('f_wali_santri').innerHTML = SANTRIS.map((s) =>
    `<option value="${s.santri_id}">${escapeHtml(s.nama)} (${escapeHtml(s.kelas || '-')})</option>`
  ).join('');
  document.getElementById('f_wali_user').innerHTML = WALIS.map((w) =>
    `<option value="${w.id}">${escapeHtml(w.nama)} ${w.email ? '· ' + escapeHtml(w.email) : ''}</option>`
  ).join('');
  document.getElementById('f_wali_relasi').value = 'Wali Santri';
  openModal('modalWaliLink');
}

async function saveWaliLink() {
  const wali_user_id = document.getElementById('f_wali_user').value;
  const santri_id = document.getElementById('f_wali_santri').value;
  if (!wali_user_id || !santri_id) return toast('Pilih wali dan santri terlebih dahulu', false);
  try {
    await api.post('/api/musyrif/wali-link', {
      wali_user_id,
      santri_id,
      relasi: document.getElementById('f_wali_relasi').value.trim()
    });
    closeModal('modalWaliLink');
    toast('Relasi wali-santri dibuat');
    await loadWaliLinks();
  } catch (e) { toast(e.message, false); }
}

function deleteWaliLink(id) {
  if (!confirm('Hapus hubungan wali-santri ini?')) return;
  api.del('/api/musyrif/wali-link/' + id).then(async () => {
    toast('Hubungan dihapus');
    await loadWaliLinks();
  }).catch((e) => toast(e.message, false));
}

load();