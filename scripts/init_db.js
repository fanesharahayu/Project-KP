require('dotenv').config();
const path = require('path');
const { initDatabase } = require('./seed');

// CLI: npm run db:init
// Membuat tabel + data contoh jika database masih kosong.
const dbPath = process.env.DB_PATH || path.join(__dirname, '..', 'tahfidz.db');

async function main() {
  console.log('Membuat tabel...');
  const seeded = await initDatabase(dbPath);
  console.log('Tabel berhasil dibuat.');
  if (seeded) {
    console.log('Selesai. Data contoh berhasil dibuat.');
  } else {
    console.log('Data pengguna sudah ada, lewati seeding.');
    console.log('Selesai.');
  }
}

main().catch((e) => {
  console.error('Gagal inisialisasi database:', e.message);
  process.exit(1);
});
