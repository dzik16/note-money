import { NextRequest, NextResponse } from 'next/server';
import { googleSheets } from '@/app/lib/googleSheets';
import { parseMessage } from '@/app/lib/parser';

async function sendTelegramMessage(chatId: string, text: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.log(`[Mock Bot Reply to ${chatId}]:\n${text}`);
    return;
  }
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: text,
      }),
    });
  } catch (error) {
    console.error('Error sending Telegram message:', error);
  }
}

export async function POST(req: NextRequest) {
  let replyText = '';
  let chatId = '';

  try {
    const body = await req.json();
    const message = body.message;

    if (!message || !message.chat || !message.chat.id) {
      return NextResponse.json({ success: false, error: 'No message context found' }, { status: 200 });
    }

    chatId = String(message.chat.id);
    const text = (message.text || '').trim();

    // 1. Look up username linked to this chatId
    const username = await googleSheets.getTelegramUsername(chatId);

    // 2. Check for register command: /start [username] or /register [username]
    const startMatch = text.match(/^\/(?:start|register)\s+(\S+)/i);

    if (startMatch) {
      const requestedUsername = startMatch[1].trim().toLowerCase().replace(/\s+/g, '_');
      await googleSheets.linkTelegramChat(chatId, requestedUsername);
      replyText = `Registrasi berhasil! 🎉\n\nAkun Telegram Anda sekarang terhubung dengan username: *${requestedUsername}*.\n\nAnda dapat mulai mencatat keuangan Anda dengan mengirimkan chat berupa nominal dan catatan, contoh:\n• 50rb makan siang\n• nabung 1jt\n• Cash 300rb\n• gaji 5.5jt`;
      
      await sendTelegramMessage(chatId, replyText);
      return NextResponse.json({ success: true, reply: replyText, username: requestedUsername });
    }

    // 3. Resolve username dynamically if prefix keyword is provided, or fallback to registered username
    const caption = (message.caption || '').trim();
    const photo = message.photo;
    const document = message.document;
    const isImageAttachment = !!(photo || (document && document.mime_type && document.mime_type.startsWith('image/')));

    const routingText = isImageAttachment ? caption : text;

    const words = routingText.split(/\s+/);
    const firstWord = words[0];
    const restText = words.slice(1).join(' ').trim();

    let resolvedUsername = username;
    let targetParseText = routingText;

    const transactionKeywords = [
      'nabung', 'gaji', 'cash', 'bayar', 'beli', 'jual', 'saham', 'crypto', 'toko',
      'rp', 'usd', 'idr', 'pemasukan', 'pengeluaran', 'income', 'expense', 'transfer', 'tarik'
    ];

    if (firstWord && /^[a-zA-Z][a-zA-Z0-9_-]{2,19}$/.test(firstWord) && !transactionKeywords.includes(firstWord.toLowerCase())) {
      const parsedRest = parseMessage(restText);
      if (isImageAttachment || parsedRest) {
        resolvedUsername = firstWord.toLowerCase();
        targetParseText = restText;
      }
    }

    // 4. If no username resolved (not registered and no valid keyword prefix routing)
    if (!resolvedUsername) {
      replyText = `Halo! Akun Telegram Anda belum terhubung ke sistem. ⚠️\n\nSilakan ketik \`/start <username>\` untuk menghubungkan akun Anda.\n\nContoh: \`/start budi\``;
      await sendTelegramMessage(chatId, replyText);
      return NextResponse.json({ success: true, reply: replyText, username: null });
    }

    if (isImageAttachment) {
      // Extract file_id
      let fileId = '';
      if (photo && photo.length > 0) {
        let selectedPhoto = photo[photo.length - 1];
        for (let i = photo.length - 1; i >= 0; i--) {
          if (photo[i].file_size && photo[i].file_size < 5 * 1024 * 1024) {
            selectedPhoto = photo[i];
            break;
          }
        }
        fileId = selectedPhoto.file_id;
      } else if (document) {
        fileId = document.file_id;
      }

      if (!fileId) {
        replyText = `Gagal memproses gambar. Berkas gambar tidak dapat ditemukan. ❌`;
        await sendTelegramMessage(chatId, replyText);
        return NextResponse.json({ success: true, reply: replyText, username: resolvedUsername });
      }

      // Download and parse image
      let parsed: { tipe: 'Pemasukan' | 'Pengeluaran'; nominal: number; deskripsi: string } | null = null;
      try {
        const { downloadTelegramFile } = await import('@/app/lib/telegramFile');
        const { parseImageWithGemini } = await import('@/app/lib/geminiVision');

        const { buffer, mimeType } = await downloadTelegramFile(fileId, 5000);
        parsed = await parseImageWithGemini(buffer, mimeType, targetParseText || undefined, 6000);
      } catch (err: any) {
        console.error('[Gemini Vision Error]', err.message || err);
        replyText = `Gagal membaca bukti transfer. ❌\n\nDetail: ${err.message || 'Terjadi kesalahan internal'}\n\nSilakan ketik nominal dan catatan secara manual.`;
        await sendTelegramMessage(chatId, replyText);
        return NextResponse.json({ success: true, reply: replyText, username: resolvedUsername });
      }

      if (!parsed) {
        replyText = `Gambar dideteksi bukan merupakan bukti transfer keuangan. ⚠️`;
        await sendTelegramMessage(chatId, replyText);
        return NextResponse.json({ success: true, reply: replyText, username: resolvedUsername });
      }

      // Save transaction
      const saved = await googleSheets.addTransaction(resolvedUsername, {
        tipe: parsed.tipe,
        nominal: parsed.nominal,
        deskripsi: parsed.deskripsi,
      });

      const formattedNominal = new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0,
      }).format(parsed.nominal);

      replyText = `Catatan berhasil disimpan! 📝 (dari Bukti Transfer)\n\n• *Username:* ${resolvedUsername}\n• *Tipe:* ${parsed.tipe}\n• *Nominal:* ${formattedNominal}\n• *Deskripsi:* ${parsed.deskripsi}${saved.isFallback ? '\n\n⚠️ _Catatan: Disimpan di database lokal (Sheets belum terhubung)_' : ''}`;

      await sendTelegramMessage(chatId, replyText);
      return NextResponse.json({
        success: true,
        reply: replyText,
        username: resolvedUsername,
        transaction: saved,
      });
    } else {
      // 5. Parse using Gemini with local regex fallback (for TEXT messages)
      let parsed: { tipe: 'Pemasukan' | 'Pengeluaran'; nominal: number; deskripsi: string } | null = null;
      let geminiError = false;

      try {
        const { parseMessageWithGemini } = await import('@/app/lib/gemini');
        parsed = await parseMessageWithGemini(targetParseText, 2000);
      } catch (err: any) {
        geminiError = true;
        console.error('[Gemini Fallback]', err.message || err);
        parsed = parseMessage(targetParseText);
      }

      // 6. Handle non-transaction greeting
      if (!parsed && !geminiError) {
        replyText = `Halo! Saya adalah bot pencatat uang personal NoteMoney. 🤖\n\nKirimkan pesan berisi nominal dan keterangan untuk mulai mencatat (misal: "kemarin abis 20 rebu buat jajan bakso").`;
        await sendTelegramMessage(chatId, replyText);
        return NextResponse.json({ success: true, reply: replyText, username: resolvedUsername });
      }

      // 7. Parse failure fallback
      if (!parsed) {
        replyText = `Format pesan tidak dikenali. ❌\n\nKirimkan nominal beserta keterangan, contoh:\n• 150rb beli kado\n• nabung 1jt\n• 50000 makan siang\n\nAtau ganti username dengan ketik:\n\`/start <username_baru>\``;
        await sendTelegramMessage(chatId, replyText);
        return NextResponse.json({ success: true, reply: replyText, username: resolvedUsername });
      }

      // 8. Save transaction
      const saved = await googleSheets.addTransaction(resolvedUsername, {
        tipe: parsed.tipe,
        nominal: parsed.nominal,
        deskripsi: parsed.deskripsi,
      });

      const formattedNominal = new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0,
      }).format(parsed.nominal);

      replyText = `Catatan berhasil disimpan! 📝\n\n• *Username:* ${resolvedUsername}\n• *Tipe:* ${parsed.tipe}\n• *Nominal:* ${formattedNominal}\n• *Deskripsi:* ${parsed.deskripsi}${saved.isFallback ? '\n\n⚠️ _Catatan: Disimpan di database lokal (Sheets belum terhubung)_' : ''}`;

      await sendTelegramMessage(chatId, replyText);
      return NextResponse.json({
        success: true,
        reply: replyText,
        username: resolvedUsername,
        transaction: saved,
      });
    }

  } catch (error: any) {
    console.error('Telegram webhook error:', error);
    if (chatId) {
      try {
        await sendTelegramMessage(chatId, 'Terjadi kesalahan internal saat memproses transaksi Anda.');
      } catch (e) {}
    }
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 200 });
  }
}
