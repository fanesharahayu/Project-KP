require('dotenv').config();
const bcrypt = require('bcryptjs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const dbPath = path.join(__dirname, '..', 'tahfidz.db');
const db = new sqlite3.Database(dbPath);

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) return reject(err);
      resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows || []);
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) return reject(err);
      resolve(row);
    });
  });
}

async function main() {
  db.serialize(() => {
    db.run('PRAGMA journal_mode = WAL');
    db.run('PRAGMA foreign_keys = ON');
  });

  console.log('Membuat tabel...');

  await run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    nama TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'santri' CHECK(role IN ('admin','musyrif','santri','wali')),
    created_at TEXT DEFAULT (datetime('now','localtime'))
  )`);

  await run(`CREATE TABLE IF NOT EXISTS santri (
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
  )`);

  await run(`CREATE TABLE IF NOT EXISTS musyrif (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL UNIQUE,
    spesialisasi TEXT NULL,
    created_at TEXT DEFAULT (datetime('now','localtime')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`);

  await run(`CREATE TABLE IF NOT EXISTS wali_santri (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    wali_user_id INTEGER NOT NULL,
    santri_id INTEGER NOT NULL,
    relasi TEXT NULL DEFAULT 'Wali Santri',
    created_at TEXT DEFAULT (datetime('now','localtime')),
    UNIQUE(wali_user_id, santri_id),
    FOREIGN KEY (wali_user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (santri_id) REFERENCES santri(id) ON DELETE CASCADE
  )`);

  await run(`CREATE TABLE IF NOT EXISTS target_hafalan (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    santri_id INTEGER NOT NULL,
    target_juz INTEGER NOT NULL DEFAULT 1,
    periode TEXT NULL,
    tanggal_mulai TEXT NULL,
    tanggal_selesai TEXT NULL,
    created_at TEXT DEFAULT (datetime('now','localtime')),
    FOREIGN KEY (santri_id) REFERENCES santri(id) ON DELETE CASCADE
  )`);

  await run(`CREATE TABLE IF NOT EXISTS setoran (
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
  )`);

  console.log('Tabel berhasil dibuat.');

  const existing = await get('SELECT COUNT(*) AS total FROM users');
  if (existing.total > 0) {
    console.log('Data pengguna sudah ada, lewati seeding.');
    db.close();
    console.log('Selesai.');
    return;
  }

  console.log('Menyisipkan data contoh...');
  const hash = (p) => bcrypt.hashSync(p, 10);

  // ===== ADMIN =====
  await run(
    'INSERT INTO users (username, email, password, nama, role) VALUES (?, ?, ?, ?, ?)',
    ['admin', 'admin@pesantren.id', hash('admin123'), 'Administrator', 'admin']
  );

  // ===== MUSYRIF =====
  await run(
    'INSERT INTO users (username, email, password, nama, role) VALUES (?, ?, ?, ?, ?)',
    ['ust_ahmad', 'ahmad@pesantren.id', hash('musyrif123'), 'Ust. Ahmad Fauzi, Lc.', 'musyrif']
  );
  await run(
    'INSERT INTO users (username, email, password, nama, role) VALUES (?, ?, ?, ?, ?)',
    ['ust_abdullah', 'abdullah@pesantren.id', hash('musyrif123'), 'Ust. Abdullah Hakim', 'musyrif']
  );

  const musyrifFull = await all("SELECT id, username FROM users WHERE role = 'musyrif'");
  const ahmadId = musyrifFull.find((m) => m.username === 'ust_ahmad').id;
  const abdullahId = musyrifFull.find((m) => m.username === 'ust_abdullah').id;

  await run('INSERT INTO musyrif (user_id, spesialisasi) VALUES (?, ?)', [ahmadId, 'Tahfidz Putra']);
  await run('INSERT INTO musyrif (user_id, spesialisasi) VALUES (?, ?)', [abdullahId, 'Tahfidz Putra']);

  // ===== SANTRI =====
  const santriData = [
    ['ahmad_farhan', 'farhan@pesantren.id', hash('santri123'), 'Ahmad Farhan'],
    ['muhammad_rizki', 'rizki@pesantren.id', hash('santri123'), 'Muhammad Rizki'],
    ['abdul_aziz', 'aziz@pesantren.id', hash('santri123'), 'Abdul Aziz']
  ];
  for (const s of santriData) {
    await run('INSERT INTO users (username, email, password, nama, role) VALUES (?, ?, ?, ?, ?)', [...s, 'santri']);
  }

  const santriUsers = await all("SELECT id, username FROM users WHERE role = 'santri'");
  const umap = Object.fromEntries(santriUsers.map((s) => [s.username, s.id]));

  await run('INSERT INTO santri (user_id, musyrif_id, nis, kelas, target_juz, tanggal_bergabung) VALUES (?, ?, ?, ?, ?, ?)',
    [umap['ahmad_farhan'], ahmadId, '10', 'X-A', 10, '2025-07-14']);
  await run('INSERT INTO santri (user_id, musyrif_id, nis, kelas, target_juz, tanggal_bergabung) VALUES (?, ?, ?, ?, ?, ?)',
    [umap['muhammad_rizki'], ahmadId, '11', 'X-A', 10, '2025-07-14']);
  await run('INSERT INTO santri (user_id, musyrif_id, nis, kelas, target_juz, tanggal_bergabung) VALUES (?, ?, ?, ?, ?, ?)',
    [umap['abdul_aziz'], abdullahId, '12', 'X-B', 5, '2025-07-14']);

  // ===== WALI SANTRI =====
  await run('INSERT INTO users (username, email, password, nama, role) VALUES (?, ?, ?, ?, ?)',
    ['wali_farhan', 'walifarhan@gmail.com', hash('wali123'), 'H. Bambang Setiawan', 'wali']);
  await run('INSERT INTO users (username, email, password, nama, role) VALUES (?, ?, ?, ?, ?)',
    ['wali_rizki', 'walirizki@gmail.com', hash('wali123'), 'Hj. Siti Rahma', 'wali']);

  const waliUsers = await all("SELECT id, username FROM users WHERE role = 'wali'");
  const wmap = Object.fromEntries(waliUsers.map((w) => [w.username, w.id]));

  const santriRows = await all('SELECT id, user_id FROM santri');
  const srmap = Object.fromEntries(santriRows.map((s) => [s.user_id, s.id]));

  await run('INSERT INTO wali_santri (wali_user_id, santri_id, relasi) VALUES (?, ?, ?)',
    [wmap['wali_farhan'], srmap[umap['ahmad_farhan']], 'Ayah']);
  await run('INSERT INTO wali_santri (wali_user_id, santri_id, relasi) VALUES (?, ?, ?)',
    [wmap['wali_rizki'], srmap[umap['muhammad_rizki']], 'Ibu']);

  // ===== TARGET HAFALAN =====
  await run('INSERT INTO target_hafalan (santri_id, target_juz, periode, tanggal_mulai, tanggal_selesai) VALUES (?, ?, ?, ?, ?)',
    [srmap[umap['ahmad_farhan']], 4, '2025-2026 Semester Ganjil', '2025-07-14', '2025-12-20']);
  await run('INSERT INTO target_hafalan (santri_id, target_juz, periode, tanggal_mulai, tanggal_selesai) VALUES (?, ?, ?, ?, ?)',
    [srmap[umap['muhammad_rizki']], 3, '2025-2026 Semester Ganjil', '2025-07-14', '2025-12-20']);
  await run('INSERT INTO target_hafalan (santri_id, target_juz, periode, tanggal_mulai, tanggal_selesai) VALUES (?, ?, ?, ?, ?)',
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
    await run('INSERT INTO setoran (santri_id, musyrif_id, juz, surah, ayat_awal, ayat_akhir, jenis, nilai, catatan) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', s);
  }

  db.close();
  console.log('Selesai. Data contoh berhasil dibuat.');
}

main().catch((e) => {
  console.error('Gagal inisialisasi database:', e.message);
  process.exit(1);
});
