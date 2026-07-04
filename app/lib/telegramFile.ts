import path from 'path';

export async function downloadTelegramFile(
  fileId: string,
  timeoutMs: number = 5000
): Promise<{ buffer: Buffer; mimeType: string }> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    throw new Error('TELEGRAM_BOT_TOKEN is not configured');
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const getFileUrl = `https://api.telegram.org/bot${token}/getFile?file_id=${fileId}`;
    const response = await fetch(getFileUrl, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`Telegram API getFile Error: HTTP ${response.status}`);
    }

    const json = await response.json();
    if (!json.ok || !json.result) {
      throw new Error(`Telegram API getFile Failed: ${json.description || 'Unknown error'}`);
    }

    const { file_size, file_path } = json.result;

    // Check size limit: 5MB
    if (file_size && file_size > 5 * 1024 * 1024) {
      throw new Error('File size exceeds 5MB limit');
    }

    if (!file_path) {
      throw new Error('No file path returned from Telegram');
    }

    // Determine mimeType
    const ext = path.extname(file_path).toLowerCase();
    let mimeType = 'application/octet-stream';
    if (ext === '.png') {
      mimeType = 'image/png';
    } else if (ext === '.jpg' || ext === '.jpeg') {
      mimeType = 'image/jpeg';
    } else if (ext === '.webp') {
      mimeType = 'image/webp';
    } else {
      throw new Error(`Unsupported file extension: ${ext}`);
    }

    // Now download the binary file
    const downloadUrl = `https://api.telegram.org/file/bot${token}/${file_path}`;
    const fileResponse = await fetch(downloadUrl, { signal: controller.signal });
    if (!fileResponse.ok) {
      throw new Error(`Telegram API File Download Error: HTTP ${fileResponse.status}`);
    }

    const arrayBuffer = await fileResponse.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    return { buffer, mimeType };
  } catch (error: any) {
    if (error.name === 'AbortError') {
      throw new Error('Telegram file download timed out');
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}
