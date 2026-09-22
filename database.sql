-- =============================================
-- SISTEM MONITORING HAFALAN AL-QUR'AN (TAHFIDZ)
-- Schema database
-- =============================================

CREATE DATABASE IF NOT EXISTS tahfidz_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE tahfidz_db;

-- ---------- TABEL USERS ----------
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(50) NOT NULL UNIQUE,
  email VARCHAR(100) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  nama VARCHAR(100) NOT NULL,
  role ENUM('admin','musyrif','santri','wali') NOT NULL DEFAULT 'santri',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ---------- TABEL SANTRi ----------
CREATE TABLE IF NOT EXISTS santri (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL UNIQUE,
  musyrif_id INT NULL,
  nis VARCHAR(20) NULL UNIQUE,
  kelas VARCHAR(50) NULL,
  target_juz INT NOT NULL DEFAULT 30 COMMENT 'Total target hafalan dalam juz',
  tanggal_bergabung DATE NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (musyrif_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ---------- TABEL MUSYRIF ----------
CREATE TABLE IF NOT EXISTS musyrif (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL UNIQUE,
  spesialisasi VARCHAR(100) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------- TABEL WALI SANTRi ----------
CREATE TABLE IF NOT EXISTS wali_santri (
  id INT AUTO_INCREMENT PRIMARY KEY,
  wali_user_id INT NOT NULL,
  santri_id INT NOT NULL,
  relasi VARCHAR(50) NULL DEFAULT 'Wali Santri',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_wali_santri (wali_user_id, santri_id),
  FOREIGN KEY (wali_user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (santri_id) REFERENCES santri(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------- TABEL TARGET HAFALAN ----------
CREATE TABLE IF NOT EXISTS target_hafalan (
  id INT AUTO_INCREMENT PRIMARY KEY,
  santri_id INT NOT NULL,
  target_juz INT NOT NULL DEFAULT 1 COMMENT 'Target juz untuk periode ini',
  periode VARCHAR(50) NULL COMMENT 'Misal: 2025-2026 Semester Ganjil',
  tanggal_mulai DATE NULL,
  tanggal_selesai DATE NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (santri_id) REFERENCES santri(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------- TABEL SETORAN ----------
CREATE TABLE IF NOT EXISTS setoran (
  id INT AUTO_INCREMENT PRIMARY KEY,
  santri_id INT NOT NULL,
  musyrif_id INT NOT NULL COMMENT 'user_id musyrif yang menilai',
  juz INT NOT NULL,
  surah VARCHAR(50) NULL,
  ayat_awal INT NULL DEFAULT 0,
  ayat_akhir INT NULL DEFAULT 0,
  jenis ENUM('hafalan_baru','tambahan','murajaah') NOT NULL DEFAULT 'hafalan_baru',
  nilai ENUM('lancar','cukup_lancar','perlu_ulang') NOT NULL DEFAULT 'lancar',
  catatan TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_santri_tanggal (santri_id, created_at),
  FOREIGN KEY (santri_id) REFERENCES santri(id) ON DELETE CASCADE,
  FOREIGN KEY (musyrif_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;