// Modul bersama: skema + seed database SQLite.
// Dipakai oleh:
//  - config/db.js  -> auto-seed saat server menyala (penting untuk Vercel,
//                     karena /tmp kosong setiap cold start)
//  - scripts/init_db.js -> CLI `npm run db:init` untuk hosting Node.js / VPS
const bcrypt = require('bcryptjs');
const sqlite3 = require('sqlite3').verbose();

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    nama TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'santri' CHECK(role IN ('admin','musyrif','santri','wali')),
    created_at TEXT DEFAULT (datetime('now','localtime'))
  )`,
  `CREATE TABLE IF NOT EXISTS santri (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL UNIQUE,
    musyrif_id INTEGER NULL,
    nis TEXT NULL UNIQUE,
    kelas TEXT NULL,
    target_juz INTEGER NOT NULL DEFAULT 30,
    tanggal_bergabung TEXT NULL,
    created_at TEXT DEFAULT (datetime('now','localtime')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (musyrif_id) REFERENCES users(id) ON DELETE SET NULL
  )`,
  `CREATE TABLE IF NOT EXISTS musyrif (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL UNIQUE,
    spesialisasi TEXT NULL,
    created_at TEXT DEFAULT (datetime('now','localtime')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS wali_santri (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    wali_user_id INTEGER NOT NULL,
    santri_id INTEGER NOT NULL,
    relasi TEXT NULL DEFAULT 'Wali Santri',
    created_at TEXT DEFAULT (datetime('now','localtime')),
    UNIQUE(wali_user_id, santri_id),
    FOREIGN KEY (wali_user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (santri_id) REFERENCES santri(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS target_hafalan (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    santri_id INTEGER NOT NULL,
    target_juz INTEGER NOT NULL DEFAULT 1,
    periode TEXT NULL,
    tanggal_mulai TEXT NULL,
    tanggal_selesai TEXT NULL,
    created_at TEXT DEFAULT (datetime('now','localtime')),
    FOREIGN KEY (santri_id) REFERENCES santri(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS setoran (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    santri_id INTEGER NOT NULL,
    musyrif_id INTEGER NOT NULL,
    juz INTEGER NOT NULL,
    surah TEXT NULL,
    ayat_awal INTEGER NULL DEFAULT 0,
    ayat_akhir INTEGER NULL DEFAULT 0,
    jenis TEXT NOT NULL DEFAULT 'hafalan_baru' CHECK(jenis IN ('hafalan_baru','tambahan','murajaah')),
    nilai TEXT NOT NULL DEFAULT 'lancar' CHECK(nilai IN ('lancar','cukup_lancar','perlu_ulang')),
    catatan TEXT NULL,
    created_at TEXT DEFAULT (datetime('now','localtime')),
    FOREIGN KEY (santri_id) REFERENCES santri(id) ON DELETE CASCADE,
    FOREIGN KEY (musyrif_id) REFERENCES users(id) ON DELETE CASCADE
  )`
];

function run(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) return reject(err);
      resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

function get(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) return reject(err);
      resolve(row);
    });
  });
}

function all(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows || []);
    });
  });
}

async function ensureSchema(db) {
  for (const sql of SCHEMA) {
    await run(db, sql);
  }
}

async function seedIfEmpty(db) {
  const existing = await get(db, 'SELECT COUNT(*) AS total FROM users');
  if (existing.total > 0) return false;

  const hash = (p) => bcrypt.hashSync(p, 10);

  // ===== ADMIN =====
  await run(db,
    'INSERT INTO users (username, email, password, nama, role) VALUES (?, ?, ?, ?, ?)',
    ['admin', 'admin@pesantren.id', hash('admin123'), 'Administrator', 'admin']
  );

  // ===== MUSYRIF =====
  await run(db,
    'INSERT INTO users (username, email, password, nama, role) VALUES (?, ?, ?, ?, ?)',
    ['ust_ahmad', 'ahmad@pesantren.id', hash('musyrif123'), 'Ust. Ahmad Fauzi, Lc.', 'musyrif']
  );
  await run(db,
    'INSERT INTO users (username, email, password, nama, role) VALUES (?, ?, ?, ?, ?)',
    ['ust_abdullah', 'abdullah@pesantren.id', hash('musyrif123'), 'Ust. Abdullah Hakim', 'musyrif']
  );

  const musyrifFull = await all(db, "SELECT id, username FROM users WHERE role = 'musyrif'");
  const ahmadId = musyrifFull.find((m) => m.username === 'ust_ahmad').id;
  const abdullahId = musyrifFull.find((m) => m.username === 'ust_abdullah').id;

  await run(db, 'INSERT INTO musyrif (user_id, spesialisasi) VALUES (?, ?)', [ahmadId, 'Tahfidz Putra']);
  await run(db, 'INSERT INTO musyrif (user_id, spesialisasi) VALUES (?, ?)', [abdullahId, 'Tahfidz Putra']);

  // ===== SANTRI =====
  const santriData = [
    ['ahmad_farhan', 'farhan@pesantren.id', hash('santri123'), 'Ahmad Farhan'],
    ['muhammad_rizki', 'rizki@pesantren.id', hash('santri123'), 'Muhammad Rizki'],
    ['abdul_aziz', 'aziz@pesantren.id', hash('santri123'), 'Abdul Aziz']
  ];
  for (const s of santriData) {
    await run(db, 'INSERT INTO users (username, email, password, nama, role) VALUES (?, ?, ?, ?, ?)', [...s, 'santri']);
  }

  const santriUsers = await all(db, "SELECT id, username FROM users WHERE role = 'santri'");
  const umap = Object.fromEntries(santriUsers.map((s) => [s.username, s.id]));

  await run(db, 'INSERT INTO santri (user_id, musyrif_id, nis, kelas, target_juz, tanggal_bergabung) VALUES (?, ?, ?, ?, ?, ?)',
    [umap['ahmad_farhan'], ahmadId, '10', 'X-A', 10, '2025-07-14']);
  await run(db, 'INSERT INTO santri (user_id, musyrif_id, nis, kelas, target_juz, tanggal_bergabung) VALUES (?, ?, ?, ?, ?, ?)',
    [umap['muhammad_rizki'], ahmadId, '11', 'X-A', 10, '2025-07-14']);
  await run(db, 'INSERT INTO santri (user_id, musyrif_id, nis, kelas, target_juz, tanggal_bergabung) VALUES (?, ?, ?, ?, ?, ?)',
    [umap['abdul_aziz'], abdullahId, '12', 'X-B', 5, '2025-07-14']);

  // ===== WALI SANTRI =====
  await run(db, 'INSERT INTO users (username, email, password, nama, role) VALUES (?, ?, ?, ?, ?)',
    ['wali_farhan', 'walifarhan@gmail.com', hash('wali123'), 'H. Bambang Setiawan', 'wali']);
  await run(db, 'INSERT INTO users (username, email, password, nama, role) VALUES (?, ?, ?, ?, ?)',
    ['wali_rizki', 'walirizki@gmail.com', hash('wali123'), 'Hj. Siti Rahma', 'wali']);

  const waliUsers = await all(db, "SELECT id, username FROM users WHERE role = 'wali'");
  const wmap = Object.fromEntries(waliUsers.map((w) => [w.username, w.id]));

  const santriRows = await all(db, 'SELECT id, user_id FROM santri');
  const srmap = Object.fromEntries(santriRows.map((s) => [s.user_id, s.id]));

  await run(db, 'INSERT INTO wali_santri (wali_user_id, santri_id, relasi) VALUES (?, ?, ?)',
    [wmap['wali_farhan'], srmap[umap['ahmad_farhan']], 'Ayah']);
  await run(db, 'INSERT INTO wali_santri (wali_user_id, santri_id, relasi) VALUES (?, ?, ?)',
    [wmap['wali_rizki'], srmap[umap['muhammad_rizki']], 'Ibu']);

  // ===== TARGET HAFALAN =====
  await run(db, 'INSERT INTO target_hafalan (santri_id, target_juz, periode, tanggal_mulai, tanggal_selesai) VALUES (?, ?, ?, ?, ?)',
    [srmap[umap['ahmad_farhan']], 4, '2025-2026 Semester Ganjil', '2025-07-14', '2025-12-20']);
  await run(db, 'INSERT INTO target_hafalan (santri_id, target_juz, periode, tanggal_mulai, tanggal_selesai) VALUES (?, ?, ?, ?, ?)',
    [srmap[umap['muhammad_rizki']], 3, '2025-2026 Semester Ganjil', '2025-07-14', '2025-12-20']);
  await run(db, 'INSERT INTO target_hafalan (santri_id, target_juz, periode, tanggal_mulai, tanggal_selesai) VALUES (?, ?, ?, ?, ?)',
    [srmap[umap['abdul_aziz']], 2, '2025-2026 Semester Ganjil', '2025-07-14', '2025-12-20']);

  // ===== SETORAN CONTOH =====
  const setoranData = [
    [srmap[umap['ahmad_farhan']], ahmadId, 1, 'Al-Fatihah', 1, 7, 'hafalan_baru', 'lancar', 'Setoran awal'],
    [srmap[umap['ahmad_farhan']], ahmadId, 1, 'Al-Baqarah', 1, 20, 'hafalan_baru', 'lancar', ''],
    [srmap[umap['ahmad_farhan']], ahmadId, 1, 'Al-Baqarah', 21, 40, 'tambahan', 'cukup_lancar', 'Perlu murajaah ayat 30-35'],
    [srmap[umap['ahmad_farhan']], ahmadId, 1, 'Al-Baqarah', 1, 40, 'murajaah', 'lancar', 'Murajaah juz 1'],
    [srmap[umap['muhammad_rizki']], ahmadId, 1, 'Al-Fatihah', 1, 7, 'hafalan_baru', 'lancar', ''],
    [srmap[umap['muhammad_rizki']], ahmadId, 1, 'Al-Baqarah', 1, 15, 'hafalan_baru', 'cukup_lancar', 'Ulangi ayat 10-15'],
    [srmap[umap['abdul_aziz']], abdullahId, 30, "An-Naba'", 1, 40, 'hafalan_baru', 'lancar', 'Juz 30 lengkap'],
    [srmap[umap['abdul_aziz']], abdullahId, 30, "An-Nazi'at", 1, 40, 'tambahan', 'lancar', '']
  ];
  for (const s of setoranData) {
    await run(db, 'INSERT INTO setoran (santri_id, musyrif_id, juz, surah, ayat_awal, ayat_akhir, jenis, nilai, catatan) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', s);
  }

  return true;
}

// Dipakai server (config/db.js): siapkan koneksi yang sudah terbuka.
// Idempoten: aman dipanggil tiap cold start.
async function ensureSeeded(db) {
  await run(db, 'PRAGMA journal_mode = WAL');
  await run(db, 'PRAGMA foreign_keys = ON');
  await ensureSchema(db);
  return seedIfEmpty(db);
}

// Dipakai CLI (scripts/init_db.js): buka DB dari path, siapkan, tutup.
async function initDatabase(dbPath) {
  const db = new sqlite3.Database(dbPath);
  try {
    const seeded = await ensureSeeded(db);
    return seeded;
  } finally {
    await new Promise((resolve) => db.close(() => resolve()));
  }
}

module.exports = { SCHEMA, ensureSchema, seedIfEmpty, ensureSeeded, initDatabase };
