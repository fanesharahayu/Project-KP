const express = require('express');
const bcrypt = require('bcryptjs');
const pool = require('../config/db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { getProfile } = require('../utils/helper');

const router = express.Router();

// GET /api/auth/me - sessia saat ini
router.get('/me', requireAuth, async (req, res) => {
  try {
    const profile = await getProfile(req.session.user);
    res.json({ user: { ...req.session.user, ...profile } });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username dan password wajib diisi' });
    }

    const [rows] = await pool.query(
      'SELECT id, username, email, password, nama, role FROM users WHERE username = ? OR email = ?',
      [username, username]
    );
    const user = rows[0];
    if (!user || !bcrypt.compareSync(password, user.password)) {
      return res.status(401).json({ error: 'Username atau password salah' });
    }

    req.session.user = {
      id: user.id,
      username: user.username,
      nama: user.nama,
      email: user.email,
      role: user.role
    };

    res.json({
      message: 'Login berhasil',
      user: req.session.user,
      redirect: redirectPath(user.role)
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/auth/santri - daftar santri untuk form registrasi wali
router.get('/santri', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT s.id AS santri_id, u.nama, s.nis, s.kelas
       FROM santri s
       JOIN users u ON u.id = s.user_id
       ORDER BY u.nama`
    );
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/auth/register - pendaftaran santri & wali
router.post('/register', async (req, res) => {
  try {
    const { nama, username, email, password, role, nis, kelas, spesialisasi, relasi, santri_id } = req.body;
    if (!nama || !username || !email || !password) {
      return res.status(400).json({ error: 'Semua field wajib diisi' });
    }
    const validRoles = ['musyrif', 'santri', 'wali'];
    const userRole = validRoles.includes(role) ? role : 'santri';
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
      [username, email, hash, nama, userRole]
    );
    const userId = result.lastID;

    if (userRole === 'santri') {
      await pool.query(
        'INSERT INTO santri (user_id, musyrif_id, nis, kelas) VALUES (?, ?, ?, ?)',
        [userId, null, nis || null, kelas || null]
      );
    } else if (userRole === 'musyrif') {
      await pool.query(
        'INSERT INTO musyrif (user_id, spesialisasi) VALUES (?, ?)',
        [userId, spesialisasi || null]
      );
    } else if (userRole === 'wali' && santri_id) {
      await pool.query(
        'INSERT INTO wali_santri (wali_user_id, santri_id, relasi) VALUES (?, ?, ?)',
        [userId, santri_id, relasi || 'Wali Santri']
      );
    }

    res.status(201).json({
      message: 'Registrasi berhasil. Silakan login.',
      userId,
      redirect: '/pages/login.html'
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.json({ message: 'Logout berhasil' });
  });
});

function redirectPath(role) {
  switch (role) {
    case 'admin':
      return '/pages/admin/dashboard.html';
    case 'musyrif':
      return '/pages/musyrif/dashboard.html';
    case 'santri':
      return '/pages/santri/dashboard.html';
    case 'wali':
      return '/pages/wali/dashboard.html';
    default:
      return '/pages/login.html';
  }
}

module.exports = router;