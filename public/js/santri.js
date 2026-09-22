async function load() {
  guard('santri');
  const data = await api.get('/api/santri/dashboard');
  const s = data.santri;
  document.getElementById('page-title').textContent = 'Dashboard Santri';

  const stats = [
    { icon: '📖', cls: 'icon-emerald', label: 'Juz Tercapai', value: data.progress.juzTercapai + ' juz' },
    { icon: '🎯', cls: 'icon-gold', label: 'Progres Target', value: data.progress.persenJuz + '%' },
    { icon: '📝', cls: 'icon-blue', label: 'Total Setoran', value: data.progress.totalSetoran },
    { icon: '👤', cls: 'icon-purple', label: 'Musyrif', value: s.musyrif_nama || 'Belum ditugaskan' }
  ];
  document.getElementById('statsGrid').innerHTML = stats.map((x) => `
    <div class="card stat-card">
      <div class="icon ${x.cls}">${x.icon}</div>
      <div><div class="value" style="font-size:20px;">${escapeHtml(x.value)}</div><div class="label">${x.label}</div></div>
    </div>`).join('');

  const persen = data.progress.persenJuz;
  document.getElementById('pText').textContent = persen + '%';
  document.getElementById('pJuzText').textContent = data.progress.juzTercapai + ' / ' + data.progress.targetJuz + ' juz';
  document.getElementById('pBar').style.width = persen + '%';
  document.getElementById('pHint').textContent = persen >= 100
    ? 'Alhamdulillah, target hafalan Anda tercapai! Terus jaga dengan murajaah. 🌟'
    : `Anda telah menghafal ${data.progress.juzTercapai} juz. Total ${data.progress.targetJuz - data.progress.juzTercapai} juz lagi menuju target. Semangat!`;

  // grafik
  loadChartJs(() => {
    document.getElementById('chartBox').innerHTML = '<canvas></canvas>';
    new Chart(document.querySelector('#chartBox canvas'), {
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

  // target
  document.getElementById('targetTable').innerHTML = `
    <thead><tr><th>Target Juz</th><th>Periode</th><th>Periode Waktu</th></tr></thead>
    <tbody>${data.targets.map((t) => `
      <tr>
        <td>${t.target_juz} juz</td>
        <td>${escapeHtml(t.periode || '-')}</td>
        <td>${fmtDate(t.tanggal_mulai)} → ${fmtDate(t.tanggal_selesai)}</td>
      </tr>`).join('') || `<tr><td colspan="3" class="empty">Belum ada target khusus</td></tr>`}</tbody>`;

  // setoran
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
      </tr>`).join('') || `<tr><td colspan="8" class="empty">Belum ada setoran. Segera setorkan hafalan kepada musyrif.</td></tr>`}</tbody>`;
}

load();