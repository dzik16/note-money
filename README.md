# NoteMoney - Money Tracker using Next.js & Google Sheets

Website pencatatan uang personal / multi-user berbasis Next.js yang menggunakan Google Sheets (Spreadsheet) sebagai media penyimpanan data transaksi dan mendukung input transaksi otomatis melalui chat Telegram Bot.

---

## Fitur Utama

- **Login Sederhana**: Masuk cukup dengan memasukkan username Anda. Sistem secara otomatis membuat tab khusus dengan nama username Anda di Spreadsheet.
- **Pencatatan Transaksi**: Catat pemasukan dan pengeluaran secara langsung dari dashboard web.
- **Riwayat Transaksi**: Tabel transaksi yang dilengkapi dengan pagination dan filter berdasarkan rentang tanggal.
- **Statistik & Grafik Visual**: Grafik perkembangan keuangan harian yang interaktif dan detail saldo, pemasukan, serta pengeluaran bersih.
- **Integrasi Telegram Bot (Natural Language Parsing)**: Catat keuangan Anda semudah berkirim chat, contoh: `300rb jajan` atau `nabung 1.5jt` via bot Telegram.
- **Simulator Chat Bot Terintegrasi**: Lakukan uji coba parser chat bot langsung dari dashboard web tanpa harus membuat bot asli terlebih dahulu.
- **Penyimpanan Fallback Lokal**: Otomatis beralih ke database JSON lokal (`data/mock_db.json`) jika Google Sheets belum terhubung, membuat sistem langsung bisa dijalankan secara instan.

---

## Cara Menjalankan Project

### 1. Kloning dan Install Dependensi
```bash
npm install
```

### 2. Jalankan Dev Server
```bash
npm run dev
```
Buka [http://localhost:3000](http://localhost:3000) pada browser Anda.

---

## Konfigurasi Kredensial (Opsional)

Ubah berkas `.env` di root project dengan format berikut:

```env
GOOGLE_CREDENTIALS=credentials/nama-file-credentials.json
SPREADSHEET_ID=ID_SPREADSHEET_ANDA
TELEGRAM_BOT_TOKEN=TOKEN_BOT_TELEGRAM_ANDA
```

### A. Setup Google Sheets (Penyimpanan Utama)
1. Pergi ke [Google Cloud Console](https://console.cloud.google.com/).
2. Buat Project Baru, lalu aktifkan **Google Sheets API**.
3. Buka menu **IAM & Admin** > **Service Accounts**, buat akun baru dan unduh kunci berbentuk file **JSON**.
4. Pindahkan file JSON tersebut ke dalam direktori `credentials/` di dalam project Anda.
5. Buat sebuah Google Spreadsheet baru, salin kode ID-nya dari URL (misalnya `https://docs.google.com/spreadsheets/d/ID_DI_SINI/edit`).
6. **PENTING:** Bagikan akses edit Google Spreadsheet tersebut ke email Service Account Anda (yang tertera di dalam file JSON sebagai `client_email`) dengan peran sebagai **Editor**.

### B. Setup Telegram Bot (Catat via Chat)
1. Cari bot `@BotFather` di Telegram dan buat bot baru dengan mengetik `/newbot`.
2. Salin token API bot yang diberikan, lalu masukkan ke `TELEGRAM_BOT_TOKEN` di berkas `.env`.
3. Jalankan `ngrok` untuk membuat tunnel ke server lokal Anda:
   ```bash
   ngrok http 3000
   ```
4. Salin URL HTTPS yang dihasilkan oleh ngrok (misalnya `https://xxxx.ngrok-free.app`), lalu daftarkan webhook bot Anda dengan mengakses URL berikut di browser Anda:
   ```text
   https://api.telegram.org/bot<TOKEN_BOT_ANDA>/setWebhook?url=https://<DOMAIN_NGROK_ANDA>/api/webhook/telegram
   ```
5. Buka bot Telegram Anda, kirimkan perintah `/start <username_anda>` untuk menghubungkannya, lalu mulailah mencatat!

