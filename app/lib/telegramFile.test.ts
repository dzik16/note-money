import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { downloadTelegramFile } from './telegramFile';

const originalEnv = process.env;

describe('Telegram File Downloader Unit Tests', () => {
  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  it('should throw error if TELEGRAM_BOT_TOKEN is missing', async () => {
    delete process.env.TELEGRAM_BOT_TOKEN;
    await expect(downloadTelegramFile('mock_file_id')).rejects.toThrow('TELEGRAM_BOT_TOKEN is not configured');
  });

  it('AC 2.2: should throw error if file size exceeds 5MB limit', async () => {
    process.env.TELEGRAM_BOT_TOKEN = 'mock_token';
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        ok: true,
        result: {
          file_id: 'large_file',
          file_size: 6 * 1024 * 1024, // 6MB
          file_path: 'photos/large.jpg'
        }
      })
    } as any);

    await expect(downloadTelegramFile('large_file')).rejects.toThrow('File size exceeds 5MB limit');
  });

  it('should map extensions to correct mimeTypes and return buffer on download success', async () => {
    process.env.TELEGRAM_BOT_TOKEN = 'mock_token';
    const mockBinary = new Uint8Array([71, 73, 70, 56]); // GIF header or dummy bytes
    
    const fetchMock = vi.spyOn(global, 'fetch');
    
    // First call for getFile, Second call for download
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        ok: true,
        result: {
          file_id: 'test_file',
          file_size: 1024,
          file_path: 'documents/photo.png'
        }
      })
    } as any).mockResolvedValueOnce({
      ok: true,
      arrayBuffer: async () => mockBinary.buffer
    } as any);

    const result = await downloadTelegramFile('test_file');
    expect(result.mimeType).toBe('image/png');
    expect(result.buffer).toBeInstanceOf(Buffer);
    expect(result.buffer.length).toBe(4);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('should throw error for unsupported extensions', async () => {
    process.env.TELEGRAM_BOT_TOKEN = 'mock_token';
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        ok: true,
        result: {
          file_id: 'unsupported_file',
          file_size: 1024,
          file_path: 'documents/text.pdf'
        }
      })
    } as any);

    await expect(downloadTelegramFile('unsupported_file')).rejects.toThrow('Unsupported file extension: .pdf');
  });

  it('should throw timeout error if fetch gets aborted', async () => {
    process.env.TELEGRAM_BOT_TOKEN = 'mock_token';
    vi.spyOn(global, 'fetch').mockRejectedValue({
      name: 'AbortError'
    });

    await expect(downloadTelegramFile('timeout_file', 50)).rejects.toThrow('Telegram file download timed out');
  });
});
