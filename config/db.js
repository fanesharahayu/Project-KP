require('dotenv').config();
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { ensureSeeded } = require('../scripts/seed');

function resolveDbPath() {
  // Bisa dioverride, mis. DB_PATH=/data/tahfidz.db di VPS
  if (process.env.DB_PATH) return process.env.DB_PATH;
  // Vercel (serverless): filesystem read-only kecuali /tmp.
  // DB dibuat ulang + auto-seed setiap cold start (mode demo).
  if (process.env.VERCEL) return path.join('/tmp', 'tahfidz.db');
  return path.join(__dirname, '..', 'tahfidz.db');
}

const dbPath = resolveDbPath();
const db = new sqlite3.Database(dbPath);

// Dijalankan sekali; query() menunggu ini selesai dulu.
// Idempoten: jika tabel/data sudah ada, tidak diapa-apakan.
const ready = ensureSeeded(db).catch((e) => {
  console.error('Gagal inisialisasi database:', e.message);
});

function query(sql, params = []) {
  return new Promise((resolve, reject) => {
    ready.then(() => {
      const trimmed = sql.trim().toUpperCase();
      if (trimmed.startsWith('INSERT')) {
        db.run(sql, params, function (err) {
          if (err) return reject(err);
          resolve([{ insertId: this.lastID, lastID: this.lastID, affectedRows: this.changes }, []]);
        });
      } else if (trimmed.startsWith('UPDATE') || trimmed.startsWith('DELETE')) {
        db.run(sql, params, function (err) {
          if (err) return reject(err);
          resolve([{ affectedRows: this.changes }, []]);
        });
      } else {
        db.all(sql, params, (err, rows) => {
          if (err) return reject(err);
          resolve([rows || [], []]);
        });
      }
    }, reject);
  });
}

function close() {
  return new Promise((resolve, reject) => {
    db.close((err) => (err ? reject(err) : resolve()));
  });
}

module.exports = { query, close, _raw: db };
