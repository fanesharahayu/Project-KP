require('dotenv').config();
const express = require('express');
const session = require('express-session');
const path = require('path');

const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const musyrifRoutes = require('./routes/musyrif');
const santriRoutes = require('./routes/santri');
const waliRoutes = require('./routes/wali');

const app = express();
const PORT = process.env.PORT || 3000;

app.locals.roleNames = {
  admin: 'Admin',
  musyrif: 'Musyrif',
  santri: 'Santri',
  wali: 'Wali Santri'
};

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  session({
    secret: process.env.SESSION_SECRET || 'rahasia_sesi',
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, maxAge: 1000 * 60 * 60 * 8 }
  })
);

app.use(express.static(path.join(__dirname, 'public')));

app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/musyrif', musyrifRoutes);
app.use('/api/santri', santriRoutes);
app.use('/api/wali', waliRoutes);

app.get('/', (req, res) => {
  res.redirect('/pages/login.html');
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Terjadi kesalahan pada server' });
});

// Diekspor agar bisa dipakai sebagai Vercel Serverless Function (lihat api/index.js).
// Server hanya listen saat file dijalankan langsung (hosting Node.js / VPS),
// bukan saat di-require oleh function Vercel.
module.exports = app;

if (require.main === module) {
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Sistem monitoring tahfidz berjalan di http://localhost:${PORT}`);
  console.log('Dapat diakses dari perangkat lain di jaringan:');
  try {
    const os = require('os');
    const nets = os.networkInterfaces();
    const ips = [];
    for (const name of Object.keys(nets)) {
      for (const net of nets[name]) {
        if (net.family === 'IPv4' && !net.internal) ips.push(net.address);
      }
    }
    ips.forEach((ip) => console.log(`  http://${ip}:${PORT}`));
  } catch (e) { /* ignore */ }
});
}