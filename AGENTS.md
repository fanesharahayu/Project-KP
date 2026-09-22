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
