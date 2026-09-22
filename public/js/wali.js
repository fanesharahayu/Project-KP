let childrenData = [];

async function load() {
  try {
    await guard('wali');
    document.getElementById('page-title').textContent = 'Dashboard Wali Santri';
    childrenData = await api.get('/api/wali/children');
  } catch (e) {
    if (e.message && !/login/i.test(e.message)) toast('Gagal memuat data: ' + e.message, false);
    return; // guard sudah redirect ke login bila sesi invalid
  }
  renderChildren();
}

function renderChildren() {
  const list = document.getElementById('childList');
  list.innerHTML = childrenData.map((c) => `
    <div class="santri-card" onclick="openChildDetail(${c.santri_id})">
      <div class="top">
        <div class="avatar">${escapeHtml(c.nama).charAt(0)}</div>
        <div class="grow">
          <h4>${escapeHtml(c.nama)} <span class="muted">(${escapeHtml(c.relasi || 'Anak')})</span></h4>
          <div class="sub">${escapeHtml(c.kelas || 'Tanpa kelas')} • NIS ${escapeHtml(c.nis || '-')}</div>
        </div>
      </div>
      <div class="progress-wrap">
        <div class="progress-label"><span>${c.progress.juzTercapai} juz dicapai</span><span>${c.progress.persenJuz}%</span></div>
        <div class="progress-track"><div class="progress-fill" style="width:${c.progress.persenJuz}%"></div></div>
      </div>
      <div class="sub" style="margin-top:8px;">🎯 Target ${c.progress.targetJuz} juz • ${c.setoranCount} kali setoran</div>
    </div>`).join('') || '<p class="muted">Belum ada anak yang terhubung. Hubungi admin pesantren untuk menautkan akun Anda dengan santri.</p>';
}

async function openChildDetail(santriId) {
  const data = await api.get('/api/wali/child/' + santriId);
  const s = data.santri;
  document.getElementById('detailTitle').textContent = `👤 ${s.nama} (${escapeHtml(data.relasi || 'Anak')})`;

  const stats = [
    { icon: '📖', cls: 'icon-emerald', label: 'Juz Tercapai', value: data.progress.juzTercapai + ' juz' },
    { icon: '🎯', cls: 'icon-gold', label: 'Progres', value: data.progress.persenJuz + '%' },
    { icon: '📝', cls: 'icon-blue', label: 'Total Setoran', value: data.progress.totalSetoran },
    { icon: '⭐', cls: 'icon-purple', label: 'Setoran Lancar', value: data.progress.lancar }
  ];
  document.getElementById('detailStats').innerHTML = stats.map((x) => `
    <div class="card stat-card">
      <div class="icon ${x.cls}">${x.icon}</div>
      <div><div class="value">${x.value}</div><div class="label">${x.label}</div></div>
    </div>`).join('');

  document.getElementById('dpersen').textContent = data.progress.persenJuz + '%';
  document.getElementById('dbar').style.width = data.progress.persenJuz + '%';
  document.getElementById('dhint').textContent = data.progress.totalSetoran === 0
    ? 'Belum ada catatan setoran untuk anak Anda.'
    : `Musyrif: ${s.musyrif_nama || '-'}. Total ${data.progress.juzTercapai} juz sudah terhafal dari target ${data.progress.targetJuz} juz.`;

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
          fill: true, tension: 0.3, borderWidth: 2
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

  document.getElementById('targetTable').innerHTML = `
    <thead><tr><th>Target Juz</th><th>Periode</th><th>Periode Waktu</th></tr></thead>
    <tbody>${data.targets.map((t) => `
      <tr>
        <td>${t.target_juz} juz</td>
        <td>${escapeHtml(t.periode || '-')}</td>
        <td>${fmtDate(t.tanggal_mulai)} → ${fmtDate(t.tanggal_selesai)}</td>
      </tr>`).join('') || `<tr><td colspan="3" class="empty">Belum ada target khusus</td></tr>`}</tbody>`;

  document.getElementById('setoranTable').innerHTML = `
    <thead><tr><th>Tanggal</th><th>Juz</th><th>Surah</th><th>Ayat</th><th>Jenis</th><th>Nilai</th><th>Musyrif</th><th>Catatan</th></tr></thead>
    <tbody>${data.setoran.map((x) => `
      <tr>
        <td>${fmtDate(x.created_at)}</td>
        <td>${x.juz}</td>
        <td>${escapeHtml(x.surah)}</td>
        <td>${x.ayat_awal}-${x.ayat_akhir}</td>
        <td>${badgeHtml(JENIS_LABEL[x.jenis] || x.jenis, x.jenis)}</td>
        <td>${badgeHtml(NILAI_LABEL[x.nilai] || x.nilai, x.nilai)}</td>
        <td>${escapeHtml(x.musyrif_nama)}</td>
        <td>${escapeHtml(x.catatan || '-')}</td>
      </tr>`).join('') || `<tr><td colspan="8" class="empty">Belum ada catatan setoran</td></tr>`}</tbody>`;

  document.getElementById('detailCard').classList.remove('hidden');
}

function hideDetail() {
  document.getElementById('detailCard').classList.add('hidden');
}

load();