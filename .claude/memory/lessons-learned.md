## 2026-07-04 - Telegram Strict Registration & PWA Support

- [DISCOVERY] Utilitas Mac bawaan `sips` dapat mengubah format dan meresize ikon secara efisien (gunakan `-s format png` untuk menjamin tipe berkas PNG riil).
- [PATTERN] Memisahkan pendaftaran service worker PWA pada Wrapper Client Component menjaga root layout Next.js tetap sebagai Server Component. [stack: react]
- [PATTERN] Konfigurasi manifest dinamis melalui `app/manifest.ts` bawaan Next.js menyederhanakan deklarasi aset PWA tanpa pustaka eksternal. [stack: react]
- [ANTI-PATTERN] Mengharapkan event `beforeinstallprompt` berjalan pada iOS Safari untuk instalasi programatis PWA adalah anti-pattern; gunakan visual tooltip/panduan sebagai gantinya. [stack: react]
