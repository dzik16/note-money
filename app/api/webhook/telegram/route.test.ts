import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { POST } from './route';
import { googleSheets } from '@/app/lib/googleSheets';
import { NextRequest } from 'next/server';

vi.mock('@/app/lib/googleSheets', () => ({
  googleSheets: {
    getTelegramUsername: vi.fn(),
    linkTelegramChat: vi.fn(),
    isUsernameTaken: vi.fn(),
    checkSheetExists: vi.fn(),
    addTransaction: vi.fn(),
  },
}));

describe('Telegram Webhook Route Handler', () => {
  let mockFetch: any;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.TELEGRAM_BOT_TOKEN = 'mock_token';
    mockFetch = vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({}),
    } as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function createMockRequest(body: any): NextRequest {
    return new NextRequest('http://localhost/api/webhook/telegram', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  it('should redirect /start and /register to /register-username instructions', async () => {
    const req = createMockRequest({
      message: {
        chat: { id: 12345 },
        text: '/start budi',
      },
    });

    const res = await POST(req);
    const data = await res.json();

    expect(data.success).toBe(true);
    expect(data.username).toBeNull();
    expect(data.reply).toContain('/register-username');
    expect(mockFetch).toHaveBeenCalled();
  });

  it('should reject /register-username with empty username parameter', async () => {
    const req = createMockRequest({
      message: {
        chat: { id: 12345 },
        text: '/register-username ',
      },
    });

    const res = await POST(req);
    const data = await res.json();

    expect(data.success).toBe(true);
    expect(data.username).toBeNull();
    expect(data.reply).toContain('Format salah');
  });

  it('should reject /register-username when username is longer than 31 characters', async () => {
    const req = createMockRequest({
      message: {
        chat: { id: 12345 },
        text: '/register-username aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      },
    });

    const res = await POST(req);
    const data = await res.json();

    expect(data.success).toBe(true);
    expect(data.username).toBeNull();
    expect(data.reply).toContain('maksimal 31 karakter');
  });

  it('should reject /register-username when username contains invalid sheet tab characters', async () => {
    const req = createMockRequest({
      message: {
        chat: { id: 12345 },
        text: '/register-username budi/test',
      },
    });

    const res = await POST(req);
    const data = await res.json();

    expect(data.success).toBe(true);
    expect(data.username).toBeNull();
    expect(data.reply).toContain('karakter khusus');
  });

  it('should reject /register-username if username is already taken by another ChatID', async () => {
    vi.mocked(googleSheets.isUsernameTaken).mockResolvedValue(true);

    const req = createMockRequest({
      message: {
        chat: { id: 12345 },
        text: '/register-username budi',
      },
    });

    const res = await POST(req);
    const data = await res.json();

    expect(data.success).toBe(true);
    expect(data.username).toBeNull();
    expect(data.reply).toContain('Username sudah digunakan');
    expect(googleSheets.isUsernameTaken).toHaveBeenCalledWith('budi', '12345');
  });

  it('should successfully link ChatID and reply success when /register-username is valid', async () => {
    vi.mocked(googleSheets.isUsernameTaken).mockResolvedValue(false);
    vi.mocked(googleSheets.linkTelegramChat).mockResolvedValue(true);

    const req = createMockRequest({
      message: {
        chat: { id: 12345 },
        text: '/register-username budi',
      },
    });

    const res = await POST(req);
    const data = await res.json();

    expect(data.success).toBe(true);
    expect(data.username).toBe('budi');
    expect(data.reply).toContain('Registrasi berhasil');
    expect(googleSheets.linkTelegramChat).toHaveBeenCalledWith('12345', 'budi');
  });

  it('should reject transaction input if the user has no registered username in DB mapping', async () => {
    vi.mocked(googleSheets.getTelegramUsername).mockResolvedValue(null);

    const req = createMockRequest({
      message: {
        chat: { id: 12345 },
        text: '50k makan siang',
      },
    });

    const res = await POST(req);
    const data = await res.json();

    expect(data.success).toBe(true);
    expect(data.username).toBeNull();
    expect(data.reply).toContain('belum terhubung');
  });

  it('should reject transaction input if username is mapped but the spreadsheet sheet tab does not exist physically', async () => {
    vi.mocked(googleSheets.getTelegramUsername).mockResolvedValue('budi');
    vi.mocked(googleSheets.checkSheetExists).mockResolvedValue(false);

    const req = createMockRequest({
      message: {
        chat: { id: 12345 },
        text: '50k makan siang',
      },
    });

    const res = await POST(req);
    const data = await res.json();

    expect(data.success).toBe(true);
    expect(data.username).toBe('budi');
    expect(data.reply).toContain('belum terdaftar');
    expect(googleSheets.checkSheetExists).toHaveBeenCalledWith('budi');
  });

  it('should successfully log transaction if username is mapped and the sheet tab exists', async () => {
    vi.mocked(googleSheets.getTelegramUsername).mockResolvedValue('budi');
    vi.mocked(googleSheets.checkSheetExists).mockResolvedValue(true);
    vi.mocked(googleSheets.addTransaction).mockResolvedValue({
      no: 1,
      tanggal: '2026-07-04 12:00:00',
      tipe: 'Pengeluaran',
      nominal: 50000,
      deskripsi: 'Makan siang',
    });

    const req = createMockRequest({
      message: {
        chat: { id: 12345 },
        text: '50k makan siang',
      },
    });

    const res = await POST(req);
    const data = await res.json();

    expect(data.success).toBe(true);
    expect(data.username).toBe('budi');
    expect(data.reply).toContain('Catatan berhasil disimpan');
    expect(googleSheets.addTransaction).toHaveBeenCalled();
  });
});
