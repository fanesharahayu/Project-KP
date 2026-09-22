// Lihat isi database tahfidz.db dari terminal
// Cara pakai:
//   node lihat-db.js                 -> tampilkan semua tabel (ringkasan)
//   node lihat-db.js users           -> tampilkan isi tabel users saja
//   node lihat-db.js setoran --all   -> tampilkan semua baris (tanpa LIMIT 50)
const path = require('path');
const Database = require('better-sqlite3');

const dbPath = process.env.DB_PATH || path.join(__dirname, 'tahfidz.db');
const argTable = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : null;
const showAll = process.argv.includes('--all');
const LIMIT = showAll ? 1000 : 50;

let db;
try {
  db = new Database(dbPath, { readonly: true });
} catch (e) {
  console.error('Gagal buka database:', dbPath);
  console.error(e.message);
  process.exit(1);
}

const tables = db
  .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
  .all()
  .map((r) => r.name);

if (tables.length === 0) {
  console.log('Database kosong (tidak ada tabel). Path:', dbPath);
  process.exit(0);
}

console.log('Database:', dbPath);
console.log('Tabel:', tables.join(', '));
console.log('='.repeat(60));

const targetTables = argTable ? [argTable] : tables;

for (const t of targetTables) {
  if (!tables.includes(t)) {
    console.log(`\n[!] Tabel "${t}" tidak ada. Pilih dari: ${tables.join(', ')}`);
    continue;
  }
  const count = db.prepare(`SELECT COUNT(*) AS c FROM "${t}"`).get().c;
  console.log(`\n## ${t} (${count} baris${count > LIMIT ? `, tampil ${LIMIT}` : ''})`);
  if (count === 0) continue;

  let rows = db.prepare(`SELECT * FROM "${t}" LIMIT ${LIMIT}`).all();

  // Samarkan password hash biar tabel rapi
  if (t === 'users') {
    rows = rows.map((r) => ({
      ...r,
      password: r.password ? String(r.password).slice(0, 15) + '...' : r.password,
    }));
  }

  console.table(rows);
}

db.close();
