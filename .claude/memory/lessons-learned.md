## 2026-07-04 - Telegram Strict Registration & PWA Support

- [DISCOVERY] Utilitas Mac bawaan `sips` dapat mengubah format dan meresize ikon secara efisien (gunakan `-s format png` untuk menjamin tipe berkas PNG riil).
- [PATTERN] Memisahkan pendaftaran service worker PWA pada Wrapper Client Component menjaga root layout Next.js tetap sebagai Server Component. [stack: react]
- [PATTERN] Konfigurasi manifest dinamis melalui `app/manifest.ts` bawaan Next.js menyederhanakan deklarasi aset PWA tanpa pustaka eksternal. [stack: react]
- [ANTI-PATTERN] Mengharapkan event `beforeinstallprompt` berjalan pada iOS Safari untuk instalasi programatis PWA adalah anti-pattern; gunakan visual tooltip/panduan sebagai gantinya. [stack: react]

## 2026-07-06 - Filter Grafik Batang Tren (Harian, Bulanan, Tahunan)

- [DISCOVERY] Hoisting import ES Module mengeksekusi statis import sebelum kode inisialisasi env berjalan; gunakan `await import()` dinamis dalam skrip mandiri (scratch/script) untuk memuat modul yang bergantung pada variabel `.env`. [stack: react]
- [PATTERN] Mengelompokkan parameter error API eksternal (seperti 503, 500, 429) dalam blok penyelamatan pengujian live menghindari kegagalan uji yang tidak perlu akibat kendala jaringan eksternal. [stack: react]
- [PATTERN] Menyesuaikan format string visual sumbu grafik secara dinamis berdasarkan cakupan agregasi filter memberikan informasi visual yang bersih tanpa merusak tata letak layout. [stack: react]

## 2026-07-06 - Tooltip Interaktif Grafik Tren Transaksi

- [PATTERN] Memosisikan tooltip HTML secara absolut (`absolute`) di dalam pembungkus kontainer SVG yang relatif (`relative`) mempermudah styling visual (seperti glassmorphism) dibandingkan dengan rendering di dalam elemen SVG murni. [stack: react]
- [PATTERN] Mencegah tooltip terpotong di tepi layar (*viewport boundary collision*) dengan mendeteksi indeks elemen (misalnya kolom 0 dan kolom terakhir) secara dinamis dan menyesuaikan alignment (X offset) tooltip tersebut. [stack: react]
- [PATTERN] Mengikat event handler `onTouchStart` pada grup elemen SVG memungkinkan dukungan interaksi hover yang mulus di perangkat layar sentuh seluler. [stack: react]
