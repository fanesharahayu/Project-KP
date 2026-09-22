const pool = require('../config/db');

// Ambil info tambahan santri/musyrif berdasarkan role
async function getProfile(user) {
  if (user.role === 'santri') {
    const [rows] = await pool.query(
      `SELECT s.*, u.nama, u.email, mu.nama AS musyrif_nama
       FROM santri s
       JOIN users u ON u.id = s.user_id
       LEFT JOIN users mu ON mu.id = s.musyrif_id
       WHERE s.user_id = ?`,
      [user.id]
    );
    return rows[0] || null;
  }
  if (user.role === 'musyrif') {
    const [rows] = await pool.query(
      `SELECT m.*, u.nama, u.email
       FROM musyrif m
       JOIN users u ON u.id = m.user_id
       WHERE m.user_id = ?`,
      [user.id]
    );
    return rows[0] || null;
  }
  return user;
}

function computeProgress(setorans, targetJuz) {
  const distinctJuz = new Set(
    setorans.filter((s) => s.jenis !== 'murajaah').map((s) => s.juz)
  );
  const juzTercapai = distinctJuz.size;
  const totalSetoran = setorans.length;
  const totalHafalanBaru = setorans.filter((s) => s.jenis === 'hafalan_baru').length;
  const lancar = setorans.filter((s) => s.nilai === 'lancar').length;
  return {
    juzTercapai,
    targetJuz: targetJuz || 30,
    persenJuz: targetJuz ? Math.min(100, Math.round((juzTercapai / targetJuz) * 100)) : 0,
    totalSetoran,
    totalHafalanBaru,
    lancar
  };
}

module.exports = { getProfile, computeProgress };