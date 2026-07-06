import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from './route';
import { googleSheets } from '@/app/lib/googleSheets';
import { NextRequest } from 'next/server';
import { cookies } from 'next/headers';

vi.mock('@/app/lib/googleSheets', () => ({
  googleSheets: {
    getStats: vi.fn(),
  },
}));

vi.mock('next/headers', () => ({
  cookies: vi.fn(),
}));

describe('GET /api/stats', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 401 if username cookie is not set', async () => {
    vi.mocked(cookies).mockResolvedValue({
      get: vi.fn(() => null),
    } as any);

    const req = new NextRequest('http://localhost/api/stats');
    const res = await GET(req);

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('Unauthorized');
  });

  it('should extract filter search parameter and forward it to googleSheets.getStats', async () => {
    vi.mocked(cookies).mockResolvedValue({
      get: vi.fn((name) => (name === 'username' ? { value: 'albi107' } : null)),
    } as any);

    vi.mocked(googleSheets.getStats).mockResolvedValue({
      totalPemasukan: 1000,
      totalPengeluaran: 500,
      saldo: 500,
      chartData: [{ date: '2026-01', pemasukan: 1000, pengeluaran: 500 }],
      isFallback: false,
    } as any);

    const req = new NextRequest('http://localhost/api/stats?filter=harian');
    const res = await GET(req);

    expect(res.status).toBe(200);
    expect(googleSheets.getStats).toHaveBeenCalledWith('albi107', 'harian');

    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.totalPemasukan).toBe(1000);
  });

  it('should default filter parameter to bulanan if query is invalid or missing', async () => {
    vi.mocked(cookies).mockResolvedValue({
      get: vi.fn((name) => (name === 'username' ? { value: 'albi107' } : null)),
    } as any);

    vi.mocked(googleSheets.getStats).mockResolvedValue({} as any);

    const req = new NextRequest('http://localhost/api/stats?filter=invalid_filter');
    await GET(req);

    expect(googleSheets.getStats).toHaveBeenCalledWith('albi107', 'bulanan');
  });
});
