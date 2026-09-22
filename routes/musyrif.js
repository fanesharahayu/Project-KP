const express = require('express');
const bcrypt = require('bcryptjs');
const pool = require('../config/db');
const { requireRole } = require('../middleware/auth');
const { computeProgress } = require('../utils/helper');

const router = express.Router();
router.use(requireRole('musyrif'));

// Daftar akun wali santri yang sudah terdaftar
router.get('/walis', async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT id, nama, username, email FROM users WHERE role = 'wali' ORDER BY nama"
    );
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Relasi wali-santri untuk santri binaan
router.get('/wali-links', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT ws.id, ws.wali_user_id, ws.santri_id, ws.relasi,
              w.nama AS wali_nama, u.nama AS santri_nama, s.kelas
       FROM wali_santri ws
       JOIN santri s ON s.id = ws.santri_id
       JOIN users w ON w.id = ws.wali_user_id
       JOIN users u ON u.id = s.user_id
       WHERE s.musyrif_id = ?
       ORDER BY u.nama`,
      [req.session.user.id]
    );
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/wali-link', async (req, res) => {
  try {
    const { wali_user_id, santri_id, relasi } = req.body;
    if (!wali_user_id || !santri_id) {
      return res.status(400).json({ error: 'Wali dan santri wajib dipilih' });
    }
    const [[santri]] = await pool.query(
      'SELECT id FROM santri WHERE id = ? AND musyrif_id = ?',
      [santri_id, req.session.user.id]
    );
    if (!santri) return res.status(403).json({ error: 'Santri bukan binaan Anda' });
    await pool.query(
      'INSERT INTO wali_santri (wali_user_id, santri_id, relasi) VALUES (?, ?, ?)',
      [wali_user_id, santri_id, relasi || 'Wali Santri']
    );
    res.status(201).json({ message: 'Hubungan wali-santri dibuat' });
  } catch (e) {
    res.status(400).json({ error: 'Hubungan sudah ada atau data tidak valid' });
  }
});

router.delete('/wali-link/:id', async (req, res) => {
  try {
    const [result] = await pool.query(
      `DELETE FROM wali_santri WHERE id = ? AND santri_id IN (SELECT id FROM santri WHERE musyrif_id = ?)`,
      [req.params.id, req.session.user.id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Hubungan tidak ditemukan' });
    }
    res.json({ message: 'Hubungan dihapus' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Daftar target hafalan santri binaan
router.get('/targets', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT t.*, u.nama AS santri_nama, s.kelas
       FROM target_hafalan t
       JOIN santri s ON s.id = t.santri_id
       JOIN users u ON u.id = s.user_id
       WHERE s.musyrif_id = ?
       ORDER BY t.created_at DESC`,
      [req.session.user.id]
    );
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Buat target hafalan untuk santri binaan
router.post('/target', async (req, res) => {
  try {
    const { santri_id, target_juz, periode, tanggal_mulai, tanggal_selesai } = req.body;
    if (!santri_id || !target_juz) {
      return res.status(400).json({ error: 'Santri dan target juz wajib diisi' });
    }
    const [[santri]] = await pool.query(
      'SELECT id FROM santri WHERE id = ? AND musyrif_id = ?',
      [santri_id, req.session.user.id]
    );
    if (!santri) return res.status(403).json({ error: 'Santri bukan binaan Anda' });

    const [result] = await pool.query(
      `INSERT INTO target_hafalan (santri_id, target_juz, periode, tanggal_mulai, tanggal_selesai)
       VALUES (?, ?, ?, ?, ?)`,
      [santri_id, target_juz, periode || null, tanggal_mulai || null, tanggal_selesai || null]
    );
    await pool.query('UPDATE santri SET target_juz = ? WHERE id = ?', [target_juz, santri_id]);
    res.status(201).json({ message: 'Target hafalan disimpan', id: result.lastID });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Hapus target
router.delete('/target/:id', async (req, res) => {
  try {
    const [result] = await pool.query(
      `DELETE FROM target_hafalan WHERE id = ? AND santri_id IN (SELECT id FROM santri WHERE musyrif_id = ?)`,
      [req.params.id, req.session.user.id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Target tidak ditemukan' });
    }
    res.json({ message: 'Target dihapus' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Tambah santri baru langsung menjadi binaan musyrif ini
router.post('/santri', async (req, res) => {
  try {
    const { nama, username, email, password, nis, kelas, target_juz } = req.body;
    if (!nama || !username || !email || !password) {
      return res.status(400).json({ error: 'Nama, username, email, dan password wajib diisi' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password minimal 6 karakter' });
    }
    const [exists] = await pool.query(
      'SELECT id FROM users WHERE username = ? OR email = ?',
      [username, email]
    );
    if (exists.length > 0) {
      return res.status(400).json({ error: 'Username atau email sudah terdaftar' });
    }

    const hash = bcrypt.hashSync(password, 10);
    const [result] = await pool.query(
      'INSERT INTO users (username, email, password, nama, role) VALUES (?, ?, ?, ?, ?)',
      [username, email, hash, nama, 'santri']
    );
    const userId = result.lastID;
    await pool.query(
      'INSERT INTO santri (user_id, musyrif_id, nis, kelas, target_juz) VALUES (?, ?, ?, ?, ?)',
      [userId, req.session.user.id, nis || null, kelas || null, Number(target_juz) || 30]
    );
    res.status(201).json({ message: 'Santri berhasil ditambahkan ke binaan Anda', id: userId });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Semua riwayat setoran yang dicatat musyrif ini
router.get('/setoran', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT st.*, u.nama AS santri_nama, s.kelas, s.nis
       FROM setoran st
       JOIN santri s ON s.id = st.santri_id
       JOIN users u ON u.id = s.user_id
       WHERE st.musyrif_id = ?
       ORDER BY st.created_at DESC`,
      [req.session.user.id]
    );
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Daftar santri binaan musyrif
router.get('/santri', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT s.id AS santri_id, s.nis, s.kelas, s.target_juz, s.tanggal_bergabung,
              u.id AS user_id, u.nama, u.email
       FROM santri s
       JOIN users u ON u.id = s.user_id
       WHERE s.musyrif_id = ?
       ORDER BY u.nama`,
      [req.session.user.id]
    );
    for (const s of rows) {
      const [setoran] = await pool.query(
        'SELECT * FROM setoran WHERE santri_id = ?', [s.santri_id]
      );
      s.progress = computeProgress(setoran, s.target_juz);
      s.setoranCount = setoran.length;
    }
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Daftar santri terdaftar yang belum memiliki musyrif (untuk diambil sebagai binaan)
router.get('/santri/unassigned', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT s.id AS santri_id, s.nis, s.kelas, s.tanggal_bergabung,
              u.id AS user_id, u.nama, u.email
       FROM santri s
       JOIN users u ON u.id = s.user_id
       WHERE s.musyrif_id IS NULL
       ORDER BY u.nama`
    );
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Ambil santri terdaftar (tanpa musyrif) sebagai binaan musyrif ini
router.post('/santri/:santriId/assign', async (req, res) => {
  try {
    const santriId = Number(req.params.santriId);
    const [[santri]] = await pool.query(
      'SELECT id FROM santri WHERE id = ? AND musyrif_id IS NULL',
      [santriId]
    );
    if (!santri) return res.status(404).json({ error: 'Santri tidak ditemukan atau sudah memiliki musyrif' });
    await pool.query('UPDATE santri SET musyrif_id = ? WHERE id = ?', [req.session.user.id, santriId]);
    res.json({ message: 'Santri berhasil diangkat menjadi binaan Anda' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Detail progres satu santri
router.get('/santri/:santriId', async (req, res) => {
  try {
    const santriId = Number(req.params.santriId);
    const [[santri]] = await pool.query(
      `SELECT s.*, u.nama, u.email, mu.nama AS musyrif_nama
       FROM santri s
       JOIN users u ON u.id = s.user_id
       LEFT JOIN users mu ON mu.id = s.musyrif_id
       WHERE s.id = ? AND s.musyrif_id = ?`,
      [santriId, req.session.user.id]
    );
    if (!santri) return res.status(404).json({ error: 'Santri tidak ditemukan' });

    const [setoran] = await pool.query(
      'SELECT * FROM setoran WHERE santri_id = ? ORDER BY created_at DESC',
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

// Catat setoran hafalan
router.post('/santri/:santriId/setoran', async (req, res) => {
  try {
    const santriId = Number(req.params.santriId);
    const { juz, surah, ayat_awal, ayat_akhir, jenis, nilai, catatan } = req.body;

    const [[santri]] = await pool.query(
      'SELECT id FROM santri WHERE id = ? AND musyrif_id = ?',
      [santriId, req.session.user.id]
    );
    if (!santri) return res.status(403).json({ error: 'Santri bukan binaan Anda' });

    if (!juz || !surah) {
      return res.status(400).json({ error: 'Juz dan surah wajib diisi' });
    }
    const [result] = await pool.query(
      `INSERT INTO setoran (santri_id, musyrif_id, juz, surah, ayat_awal, ayat_akhir, jenis, nilai, catatan)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        santriId,
        req.session.user.id,
        juz,
        surah,
        ayat_awal || 0,
        ayat_akhir || 0,
        jenis || 'hafalan_baru',
        nilai || 'lancar',
        catatan || null
      ]
    );
    res.status(201).json({ message: 'Setoran berhasil dicatat' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Ubah setoran
router.put('/setoran/:id', async (req, res) => {
  try {
    const { juz, surah, ayat_awal, ayat_akhir, jenis, nilai, catatan } = req.body;
    const [result] = await pool.query(
      `UPDATE setoran SET juz = ?, surah = ?, ayat_awal = ?, ayat_akhir = ?, jenis = ?, nilai = ?, catatan = ?
       WHERE id = ? AND musyrif_id = ?`,
      [juz, surah, ayat_awal || 0, ayat_akhir || 0, jenis, nilai, catatan || null, req.params.id, req.session.user.id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Setoran tidak ditemukan' });
    }
    res.json({ message: 'Setoran diperbarui' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Hapus setoran
router.delete('/setoran/:id', async (req, res) => {
  try {
    const [result] = await pool.query(
      'DELETE FROM setoran WHERE id = ? AND musyrif_id = ?',
      [req.params.id, req.session.user.id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Setoran tidak ditemukan' });
    }
    res.json({ message: 'Setoran dihapus' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
