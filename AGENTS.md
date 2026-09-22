# AGENTS.md — Memori Projek

## File Rahasia (PENTING — JANGAN DIHAPUS)
- Lokasi: `D:\!!! PENTING JAGAN DIHAPUS !!.txt`
- Isi: GitHub token, session secret, dan kredensial lain (API token, dsb).
- Aturan:
  - JANGAN PERNAH menghapus file ini.
  - JANGAN PERNAH commit/upload file ini ke Git atau ke mana pun.
  - Setiap token/kredensial baru WAJIB dicatat di file ini.

## Projek: Tahfidz Monitoring
- Stack: Node.js + Express + SQLite (`sqlite3`), session `express-session`.
- Entry point: `server.js` (port via `process.env.PORT`, default 3000).
- Repo GitHub: `fanesharahayu/Project-KP` (private), branch `main`.
- DB lokal: `tahfidz.db` (dibuat otomatis via `scripts/init_db.js` / `database.sql`).
- File `.env`, `*.db`, `cookie*.txt`, `node_modules/` sudah di-`.gitignore`.

## Deploy Dual-Runtime (perubahan 2026-09-22)
- Hosting Node.js/VPS: `server.js` listen seperti biasa (`npm start`).
- Vercel: `api/index.js` me-require `server.js` (export app, listen hanya
  jika `require.main === module`); routing di `vercel.json`.
- DB: `config/db.js` pakai `DB_PATH` jika ada, `/tmp/tahfidz.db` jika
  `process.env.VERCEL`, selain itu `./tahfidz.db`. Auto-seed idempoten
  via `scripts/seed.js` (dipakai juga oleh `npm run db:init`).
- Driver DB = `better-sqlite3` (bukan `sqlite3`): binary native `sqlite3`
  crash di serverless Vercel (FUNCTION_INVOCATION_FAILED).
- Batasan Vercel (mode demo): data di `/tmp` tidak permanen, session
  in-memory bisa hilang antar instance. Produksi = VPS (lihat `docs/`).
- Node dipin `22.x` di `package.json` (engines) agar prebuild cocok.
- `vercel.json`: `includeFiles` HARUS string (`"public/**"`); bentuk array
  membuat build Vercel langsung gagal (pelajaran 2026-09-22).
- Env wajib di dashboard Vercel: `SESSION_SECRET` (string acak panjang).
- Docs: `README.md` (umum), `docs/migrasi-vps.md` (panduan pindah ke VPS).
