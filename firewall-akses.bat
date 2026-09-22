@echo off
rem ============================================
rem  Buka akses port 3000 di Windows Firewall
rem  agar bisa diakses dari perangkat lain
rem  (HP/santri) di jaringan yang sama
rem ============================================
echo Membuka akses port 3000 di Windows Firewall...
netsh advfirewall firewall delete rule name="Tahfidz Monitor" >nul 2>&1
netsh advfirewall firewall add rule name="Tahfidz Monitor" dir=in action=allow protocol=TCP localport=3000
echo.
echo Selesai. Jalankan server (start.bat) lalu akses dari perangkat lain
echo melalui:
echo   http://192.168.10.2:3000
echo atau IP lain yang terlihat di konsol server.
pause