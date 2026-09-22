# Sistem Monitoring Tahfidz

Aplikasi web untuk memantau hafalan Al-Qur'an santri. Mendukung 4 peran:
**Admin**, **Musyrif**, **Santri**, dan **Wali Santri**.

- Admin: kelola user/santri, target hafalan, setoran, dan relasi wali-santri.
- Musyrif: kelola santri binaan, catat & nilai setoran, atur target.
- Santri: lihat progres, grafik perkembangan juz, dan riwayat setoran.
- Wali Santri: pantau perkembangan hafalan anak.

## Teknologi

- Node.js + Express 4 (backend + serve frontend statis)
- SQLite (`sqlite3`) — tanpa server database terpisah
- Session login (`express-session`), password hashing (`bcryptjs`)
- Frontend: HTML + CSS + JS vanilla (dan Chart.js untuk grafik)

## Jalankan Lokal

```bash
npm install
npm run db:init   # membuat tahfidz.db + data contoh (sekali saja)
npm start         # http://localhost:3000
```

Salin `.env.example` menjadi `.env` dan ganti `SESSION_SECRET` dengan
string acak yang panjang. Variabel opsional `DB_PATH` untuk memindahkan
lokasi file database (mis. `DB_PATH=/data/tahfidz.db`).

## Akun Demo (data contoh)

| Peran   | Username      | Password    |
| ------- | ------------- | ----------- |
| Admin   | `admin`       | `admin123`  |
| Musyrif | `ust_ahmad`   | `musyrif123`|
| Santri  | `ahmad_farhan`| `santri123` |
| Wali    | `wali_farhan` | `wali123`   |

## Struktur Folder

```
├── api/index.js        # entry point Vercel Serverless Function
├── vercel.json         # konfigurasi deploy Vercel
├── server.js           # entry point hosting Node.js / VPS
├── config/db.js        # koneksi SQLite + auto-seed
├── routes/             # API: auth, admin, musyrif, santri, wali
├── middleware/auth.js  # penjaga login & role
├── utils/helper.js     # getProfile, computeProgress
├── scripts/seed.js     # skema + data contoh (dipakai server & CLI)
├── scripts/init_db.js  # CLI: npm run db:init
├── public/             # frontend (pages, js, css, vendor)
├── docs/               # panduan (termasuk migrasi VPS)
└── database.sql        # skema MySQL (arsip, tidak dipakai aplikasi)
```

## Deploy

Aplikasi ini **dual-runtime**:

- **Hosting Node.js / VPS** (produksi, direkomendasikan): `npm start`.
  Data tersimpan permanen di file SQLite. Lihat `docs/migrasi-vps.md`.
- **Vercel** (demo): deploy otomatis dari GitHub. Karena filesystem
  serverless read-only, database memakai `/tmp` dan dibuat ulang +
  auto-seed setiap cold start — **data tidak permanen** dan session
  bisa hilang antar instance. Jangan pakai untuk data asli.

Di dashboard Vercel wajib set environment variable:
`SESSION_SECRET` = string acak yang panjang.
