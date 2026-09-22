require('dotenv').config();
const Database = require('better-sqlite3');
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
const db = new Database(dbPath);

// Dijalankan sekali; query() menunggu ini selesai dulu.
// Idempoten: jika tabel/data sudah ada, tidak diapa-apakan.
const ready = ensureSeeded(db).catch((e) => {
  console.error('Gagal inisialisasi database:', e.message);
});

// Kontrak sama seperti sebelumnya: resolve [rows|info, []] ala mysql2,
// agar routes tidak perlu diubah.
async function query(sql, params = []) {
  await ready;
  const trimmed = sql.trim().toUpperCase();
  if (trimmed.startsWith('INSERT')) {
    const info = db.prepare(sql).run(...params);
    const lastID = Number(info.lastInsertRowid);
    return [{ insertId: lastID, lastID, affectedRows: info.changes }, []];
  }
  if (trimmed.startsWith('UPDATE') || trimmed.startsWith('DELETE')) {
    const info = db.prepare(sql).run(...params);
    return [{ affectedRows: info.changes }, []];
  }
  const rows = db.prepare(sql).all(...params);
  return [rows || [], []];
}

function close() {
  return Promise.resolve().then(() => db.close());
}

module.exports = { query, close, _raw: db };
