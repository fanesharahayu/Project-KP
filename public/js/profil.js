async function load() {
  const user = await guard(null);
  if (!user) return;
  document.getElementById('page-title').textContent = 'Profil Saya';

  const profile = await fetchMe();
  const u = profile.user;

  document.getElementById('pAvatar').textContent = (u.nama || '?').charAt(0).toUpperCase();
  document.getElementById('pNama').textContent = u.nama || '-';
  document.getElementById('pRole').textContent = ROLE_NAMES[u.role] || u.role;
  document.getElementById('pUsername').textContent = u.username || '-';
  document.getElementById('pEmail').textContent = u.email || '-';

  if (u.role === 'santri') {
    document.getElementById('rowNis').classList.remove('hidden');
    document.getElementById('rowKelas').classList.remove('hidden');
    document.getElementById('rowMusyrif').classList.remove('hidden');
    document.getElementById('rowTarget').classList.remove('hidden');
    document.getElementById('pNis').textContent = u.nis || '-';
    document.getElementById('pKelas').textContent = u.kelas || '-';
    document.getElementById('pMusyrif').textContent = u.musyrif_nama || 'Belum ditugaskan';
    document.getElementById('pTarget').textContent = (u.target_juz ? u.target_juz + ' juz' : '-');
  } else if (u.role === 'musyrif') {
    document.getElementById('rowSpesialisasi').classList.remove('hidden');
    document.getElementById('pSpesialisasi').textContent = u.spesialisasi || '-';
  }
}

load();