const express = require('express');
const bcrypt = require('bcryptjs');
const pool = require('../config/db');
const { requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(requireRole('admin'));

// ===== STATISTIK DASHBOARD =====
router.get('/stats', async (req, res) => {
  try {
    const [santri] = await pool.query(
      `SELECT s.*, u.nama, u.username, u.email, mu.nama AS musyrif_nama
       FROM santri s
       JOIN users u ON u.id = s.user_id
       LEFT JOIN users mu ON mu.id = s.musyrif_id
       ORDER BY s.kelas, u.nama`
    );
    const [setoran] = await pool.query(
      `SELECT s.id, s.santri_id, s.musyrif_id, s.juz, s.surah, s.ayat_awal, s.ayat_akhir, s.jenis, s.nilai, s.catatan, s.created_at,
              u.nama AS santri_nama, m.nama AS musyrif_nama
       FROM setoran s
       JOIN santri st ON st.id = s.santri_id
       JOIN users u ON u.id = st.user_id
       JOIN users m ON m.id = s.musyrif_id
       ORDER BY s.created_at DESC`
    );
    const [target] = await pool.query(
      `SELECT t.*, u.nama AS santri_nama
       FROM target_hafalan t
       JOIN santri s ON s.id = t.santri_id
       JOIN users u ON u.id = s.user_id
       ORDER BY t.created_at DESC`
    );
    const [users] = await pool.query('SELECT id, nama, role, username, email FROM users ORDER BY role');

    res.json({
      jumlahSantri: santri.length,
      jumlahSetoran: setoran.length,
      jumlahMusyrif: users.filter((u) => u.role === 'musyrif').length,
      jumlahWali: users.filter((u) => u.role === 'wali').length,
      santri, setoran, target, users
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ===== KELOLA USER & SANTRi =====

// Daftar user untuk dropdown
router.get('/users', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, nama, username, email, role FROM users ORDER BY role, nama'
    );
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Buat user baru (musyrif / wali)
router.post('/users', async (req, res) => {
  try {
    const { nama, username, email, password, role } = req.body;
    if (!nama || !username || !email || !password) {
      return res.status(400).json({ error: 'Semua field wajib diisi' });
    }
    if (!['admin', 'musyrif', 'santri', 'wali'].includes(role)) {
      return res.status(400).json({ error: 'Role tidak valid' });
    }
    const [exists] = await pool.query(
      'SELECT id FROM users WHERE username = ? OR email = ?', [username, email]
    );
    if (exists.length > 0) {
      return res.status(400).json({ error: 'Username atau email sudah ada' });
    }
    const hash = bcrypt.hashSync(password, 10);
    const [result] = await pool.query(
      'INSERT INTO users (username, email, password, nama, role) VALUES (?, ?, ?, ?, ?)',
      [username, email, hash, nama, role]
    );
    if (role === 'musyrif') {
      await pool.query('INSERT INTO musyrif (user_id) VALUES (?)', [result.lastID]);
    } else if (role === 'santri') {
      await pool.query('INSERT INTO santri (user_id) VALUES (?)', [result.lastID]);
    }
    res.status(201).json({ message: 'User berhasil dibuat', id: result.lastID });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Buat/Hubungkan data santri
router.post('/santri', async (req, res) => {
  try {
    const { nama, username, email, password, nis, kelas, target_juz, musyrif_id, tanggal_bergabung } = req.body;
    if (!nama || !username || !email || !password) {
      return res.status(400).json({ error: 'Field nama, username, email, password wajib diisi' });
    }
    const [exists] = await pool.query(
      'SELECT id FROM users WHERE username = ? OR email = ?', [username, email]
    );
    if (exists.length > 0) {
      return res.status(400).json({ error: 'Username atau email sudah ada' });
    }
    const hash = bcrypt.hashSync(password, 10);
    const [result] = await pool.query(
      'INSERT INTO users (username, email, password, nama, role) VALUES (?, ?, ?, ?, ?)',
      [username, email, hash, nama, 'santri']
    );
    await pool.query(
      `INSERT INTO santri (user_id, nis, kelas, target_juz, musyrif_id, tanggal_bergabung)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [result.lastID, nis || null, kelas || null, target_juz || 30, musyrif_id || null, tanggal_bergabung || null]
    );
    res.status(201).json({ message: 'Santri berhasil ditambahkan', id: result.lastID });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Ubah santri (termasuk penugasan musyrif & target)
router.put('/santri/:id', async (req, res) => {
  try {
    const santriId = Number(req.params.id);
    const { nis, kelas, target_juz, musyrif_id, tanggal_bergabung } = req.body;
    await pool.query(
      `UPDATE santri SET nis = ?, kelas = ?, target_juz = ?, musyrif_id = ?, tanggal_bergabung = ?
       WHERE id = ?`,
      [nis || null, kelas || null, target_juz || 30, musyrif_id || null, tanggal_bergabung || null, santriId]
    );
    if (req.body.nama) {
      const [santriRow] = await pool.query('SELECT user_id FROM santri WHERE id = ?', [santriId]);
      if (santriRow.length > 0) {
        await pool.query('UPDATE users SET nama = ? WHERE id = ?', [req.body.nama, santriRow[0].user_id]);
      }
    }
    res.json({ message: 'Santri berhasil diperbarui' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Hapus user (cascade ke santri/wali) 
router.delete('/users/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM users WHERE id = ?', [req.params.id]);
    res.json({ message: 'User berhasil dihapus' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ===== TARGET HAFALAN =====
router.post('/target', async (req, res) => {
  try {
    const { santri_id, target_juz, periode, tanggal_mulai, tanggal_selesai } = req.body;
    if (!santri_id || !target_juz) {
      return res.status(400).json({ error: 'Santri dan target juz wajib diisi' });
    }
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
    await pool.query('DELETE FROM target_hafalan WHERE id = ?', [req.params.id]);
    res.json({ message: 'Target dihapus' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ===== HUBUNGAN WALI =====
router.get('/wali-links', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT ws.id, ws.wali_user_id, ws.santri_id, ws.relasi
       FROM wali_santri ws
       ORDER BY ws.id`
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
    await pool.query('DELETE FROM wali_santri WHERE id = ?', [req.params.id]);
    res.json({ message: 'Hubungan dihapus' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ===== HAPUS SETORAN (admin bisa override) =====
router.delete('/setoran/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM setoran WHERE id = ?', [req.params.id]);
    res.json({ message: 'Setoran dihapus' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Admin mencatat setoran hafalan
router.post('/setoran', async (req, res) => {
  try {
    const { santri_id, musyrif_id, juz, surah, ayat_awal, ayat_akhir, jenis, nilai, catatan } = req.body;
    if (!santri_id || !musyrif_id || !juz || !surah) {
      return res.status(400).json({ error: 'Santri, musyrif, juz, dan surah wajib diisi' });
    }
    const santriRows = await pool.query('SELECT id FROM santri WHERE id = ?', [santri_id]);
    if (santriRows[0].length === 0) return res.status(404).json({ error: 'Santri tidak ditemukan' });
    const pengajarRows = await pool.query('SELECT id FROM users WHERE id = ? AND role = ?', [musyrif_id, 'musyrif']);
    if (pengajarRows[0].length === 0) return res.status(404).json({ error: 'Musyrif tidak ditemukan' });

    const [result] = await pool.query(
      `INSERT INTO setoran (santri_id, musyrif_id, juz, surah, ayat_awal, ayat_akhir, jenis, nilai, catatan)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [santri_id, musyrif_id, juz, surah, ayat_awal || 0, ayat_akhir || 0, jenis || 'hafalan_baru', nilai || 'lancar', catatan || null]
    );
    res.status(201).json({ message: 'Setoran dicatat', id: result.lastID });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Admin mengubah setoran
router.put('/setoran/:id', async (req, res) => {
  try {
    const { musyrif_id, juz, surah, ayat_awal, ayat_akhir, jenis, nilai, catatan } = req.body;
    const [result] = await pool.query(
      `UPDATE setoran SET musyrif_id = ?, juz = ?, surah = ?, ayat_awal = ?, ayat_akhir = ?, jenis = ?, nilai = ?, catatan = ?
       WHERE id = ?`,
      [musyrif_id, juz, surah, ayat_awal || 0, ayat_akhir || 0, jenis, nilai, catatan || null, req.params.id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Setoran tidak ditemukan' });
    }
    res.json({ message: 'Setoran diperbarui' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
