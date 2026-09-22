const express = require('express');
const pool = require('../config/db');
const { requireRole } = require('../middleware/auth');
const { computeProgress } = require('../utils/helper');

const router = express.Router();
router.use(requireRole('wali'));

// Daftar anak / santri yang terhubung dengan wali
router.get('/children', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT ws.relasi, s.id AS santri_id, s.nis, s.kelas, s.target_juz,
              u.nama, u.email, mu.nama AS musyrif_nama
       FROM wali_santri ws
       JOIN santri s ON s.id = ws.santri_id
       JOIN users u ON u.id = s.user_id
       LEFT JOIN users mu ON mu.id = s.musyrif_id
       WHERE ws.wali_user_id = ?
       ORDER BY u.nama`,
      [req.session.user.id]
    );
    for (const s of rows) {
      const [setoran] = await pool.query(
        'SELECT * FROM setoran WHERE santri_id = ?', [s.santri_id]
      );
      s.progress = computeProgress(setoran, s.target_juz);
      s.setoranCount = setoran.length;
      const [targets] = await pool.query(
        'SELECT * FROM target_hafalan WHERE santri_id = ? ORDER BY created_at DESC LIMIT 1',
        [s.santri_id]
      );
      s.targetAktif = targets[0] || null;
    }
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Detail progres satu santri untuk wali
router.get('/child/:santriId', async (req, res) => {
  try {
    const santriId = Number(req.params.santriId);
    const [[link]] = await pool.query(
      'SELECT relasi FROM wali_santri WHERE wali_user_id = ? AND santri_id = ?',
      [req.session.user.id, santriId]
    );
    if (!link) return res.status(403).json({ error: 'Anda tidak memiliki akses ke santri ini' });

    const [[santri]] = await pool.query(
      `SELECT s.*, u.nama, u.email, mu.nama AS musyrif_nama
       FROM santri s
       JOIN users u ON u.id = s.user_id
       LEFT JOIN users mu ON mu.id = s.musyrif_id
       WHERE s.id = ?`,
      [santriId]
    );
    const [setoran] = await pool.query(
      `SELECT st.*, u.nama AS musyrif_nama
       FROM setoran st
       JOIN users u ON u.id = st.musyrif_id
       WHERE st.santri_id = ?
       ORDER BY st.created_at DESC`,
      [santriId]
    );
    const [targets] = await pool.query(
      'SELECT * FROM target_hafalan WHERE santri_id = ? ORDER BY created_at DESC',
      [santriId]
    );

    const byTanggal = {};
    const juzSet = new Set();
    const asc = [...setoran].reverse();
    for (const s of asc) {
      if (s.jenis !== 'murajaah') juzSet.add(s.juz);
      byTanggal[s.created_at.slice(0, 10)] = juzSet.size;
    }
    const grafik = Object.entries(byTanggal).map(([tanggal, juz]) => ({ tanggal, juz }));

    res.json({
      relasi: link.relasi,
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