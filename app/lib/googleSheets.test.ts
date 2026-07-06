import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { googleSheets } from './googleSheets';
import { mockDb } from './mockDb';
import fs from 'fs';
import path from 'path';

const DB_FILE = path.join(process.cwd(), 'data', 'mock_db.json');

describe('googleSheets', () => {
  beforeEach(() => {
    if (fs.existsSync(DB_FILE)) {
      fs.renameSync(DB_FILE, DB_FILE + '.bak');
    }
  });

  afterEach(() => {
    if (fs.existsSync(DB_FILE)) {
      fs.unlinkSync(DB_FILE);
    }
    if (fs.existsSync(DB_FILE + '.bak')) {
      fs.renameSync(DB_FILE + '.bak', DB_FILE);
    }
  });

  it('should fallback to mockDb and forward filter parameter correctly', async () => {
    process.env.USE_MOCK_DB = 'true';
    const user = 'test_user_sheets_fallback';
    mockDb.addTransaction(user, { tipe: 'Pemasukan', nominal: 1000, deskripsi: 'A', tanggal: '2026-01-15 10:00:00' });
    mockDb.addTransaction(user, { tipe: 'Pengeluaran', nominal: 200, deskripsi: 'B', tanggal: '2026-01-20 12:00:00' });

    // When calling googleSheets.getStats with harian, it should return daily items (2 items)
    const statsDaily = await googleSheets.getStats(user, 'harian');
    process.env.USE_MOCK_DB = 'false';
    expect(statsDaily.isFallback).toBe(true);
    expect(statsDaily.chartData.length).toBe(2); // 2026-01-15 and 2026-01-20
    expect(statsDaily.chartData[0].date).toBe('2026-01-15');
  });
});
