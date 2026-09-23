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

// GET /api/auth/santri - daftar santri (butuh login; dulu untuk form registrasi wali publik)
router.get('/santri', requireAuth, async (req, res) => {
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

// POST /api/auth/register - DINONAKTIFKAN. Akun hanya dibuat admin
// via POST /api/admin/santri, POST /api/admin/users, POST /api/admin/wali-link.
router.post('/register', (req, res) => {
  return res.status(403).json({ error: 'Registrasi mandiri dinonaktifkan. Hubungi admin untuk dibuatkan akun.' });
});

// POST /api/auth/change-password - ganti password sendiri (harus login)
// Alur: admin buat akun + password sementara (kirim via WA) -> user login -> ganti di sini.
router.post('/change-password', requireAuth, async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    if (!oldPassword || !newPassword) {
      return res.status(400).json({ error: 'Password lama dan baru wajib diisi' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'Password baru minimal 6 karakter' });
    }
    const [rows] = await pool.query('SELECT password FROM users WHERE id = ?', [req.session.user.id]);
    if (!rows[0] || !bcrypt.compareSync(oldPassword, rows[0].password)) {
      return res.status(401).json({ error: 'Password lama salah' });
    }
    const hash = bcrypt.hashSync(newPassword, 10);
    await pool.query('UPDATE users SET password = ? WHERE id = ?', [hash, req.session.user.id]);
    res.json({ message: 'Password berhasil diganti' });
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