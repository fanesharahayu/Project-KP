const express = require('express');
const pool = require('../config/db');
const { requireRole } = require('../middleware/auth');
const { computeProgress } = require('../utils/helper');

const router = express.Router();
router.use(requireRole('santri'));

// Dashboard santri: profil, target, riwayat setoran
router.get('/dashboard', async (req, res) => {
  try {
    const [[santri]] = await pool.query(
      `SELECT s.*, u.nama, u.email, mu.nama AS musyrif_nama
       FROM santri s
       JOIN users u ON u.id = s.user_id
       LEFT JOIN users mu ON mu.id = s.musyrif_id
       WHERE s.user_id = ?`,
      [req.session.user.id]
    );
    if (!santri) return res.status(404).json({ error: 'Data santri tidak ditemukan' });

    const [setoran] = await pool.query(
      `SELECT st.*, u.nama AS musyrif_nama
       FROM setoran st
       JOIN users u ON u.id = st.musyrif_id
       WHERE st.santri_id = ?
       ORDER BY st.created_at DESC`,
      [santri.id]
    );
    const [targets] = await pool.query(
      'SELECT * FROM target_hafalan WHERE santri_id = ? ORDER BY created_at DESC',
      [santri.id]
    );

    // Grafik perkembangan juz unik kumulatif
    const byTanggal = {};
    const juzSet = new Set();
    const asc = [...setoran].reverse();
    for (const s of asc) {
      if (s.jenis !== 'murajaah') juzSet.add(s.juz);
      byTanggal[s.created_at.slice(0, 10)] = juzSet.size;
    }
    const grafik = Object.entries(byTanggal).map(([tanggal, juz]) => ({ tanggal, juz }));

    res.json({
      santri,
      setoran,
      targets,
      progress: computeProgress(setoran, santri.target_juz),
      grafik
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;