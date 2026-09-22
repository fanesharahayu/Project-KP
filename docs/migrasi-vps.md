# Panduan Persiapan Migrasi ke VPS

Panduan memindahkan aplikasi Tahfidz dari Vercel/lokal ke VPS agar
data permanen (SQLite di disk persisten + proses Node.js jalan terus).

## 1. Siapkan VPS

- Pilih paket dengan akses root/SSH, mis. **NAT VPS / VPS hostData.id**
  (lihat tutorial di `natvps.id`), atau provider lain (DigitalOcean,
  IDCloudHost, Biznet Gio, dsb).
- Spesifikasi minimal: 1 vCPU, 1 GB RAM, 10 GB disk (cukup untuk app ini).
- Siapkan (opsional tapi disarankan): **domain** yang diarahkan (record A)
  ke IP publik VPS untuk akses HTTPS yang rapi.

Checklist akses: [ ] IP VPS [ ] user + password / SSH key [ ] port SSH
bisa dihubungi [ ] (NAT VPS) port forwarding / domain sudah diatur.

## 2. Persiapan di VPS (Ubuntu/Debian)

```bash
# Update sistem + install Node.js 22, git, nginx, certbot
sudo apt update && sudo apt upgrade -y
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs git nginx certbot python3-certbot-nginx
node -v  # pastikan v22.x

# Tool proses agar app jalan terus + firewall dasar
sudo npm install -g pm2
sudo ufw allow OpenSSH && sudo ufw allow 80,443/tcp && sudo ufw enable
```

## 3. Deploy Aplikasi

```bash
# Clone repo
git clone https://github.com/fanesharahayu/Project-KP.git tahfidz
cd tahfidz
npm install --omit=dev

# Konfigurasi: JANGAN commit file ini
cp .env.example .env
nano .env   # isi SESSION_SECRET dengan string acak panjang

# Inisialisasi database SEKALI saja (data contoh ikut dibuat).
# Backup tahfidz.db lokal dulu jika berisi data asli yang mau dibawa.
npm run db:init

# Jalankan permanen dengan PM2 (auto-start saat reboot)
pm2 start server.js --name tahfidz
pm2 save && pm2 startup
pm2 status  # pastikan status online
```

Aplikasi mendengar di `http://localhost:3000` (hanya lokal VPS).

## 4. Reverse Proxy + HTTPS (Nginx)

```nginx
# /etc/nginx/sites-available/tahfidz
server {
  server_name tahfidz.contoh.id;  # ganti domain/IP Anda
  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/tahfidz /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d tahfidz.contoh.id   # HTTPS gratis (Let's Encrypt)
```

## 5. Update & Backup Rutin

```bash
cd ~/tahfidz && git pull && npm install --omit=dev && pm2 restart tahfidz
```

- **Backup DB**: salin `tahfidz.db` secara berkala
  (`cp tahfidz.db backup/tahfidz-$(date +%F).db`) atau sinkronkan keluar VPS.
- **Jangan** menimpa `tahfidz.db` produksi dengan DB lokal berisi data contoh.
- Update rutin: `sudo apt update && sudo apt upgrade -y`.

## 6. Migrasi Data dari Vercel

Catatan penting: database di Vercel bersifat sementara (di `/tmp`,
hilang tiap cold start) sehingga **tidak ada data produksi di sana**
yang perlu dimigrasi. Jika ada data di `tahfidz.db` lokal yang asli,
cukup salin file tersebut ke VPS (SCP/SFTP) sebelum `pm2 start`, dan
**lewati** `npm run db:init`.
