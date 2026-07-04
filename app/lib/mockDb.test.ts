import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mockDb } from './mockDb';
import fs from 'fs';
import path from 'path';

const DB_FILE = path.join(process.cwd(), 'data', 'mock_db.json');

describe('mockDb', () => {
  beforeEach(() => {
    // Backup DB file if exists
    if (fs.existsSync(DB_FILE)) {
      fs.renameSync(DB_FILE, DB_FILE + '.bak');
    }
  });

  afterEach(() => {
    // Restore backup
    if (fs.existsSync(DB_FILE)) {
      fs.unlinkSync(DB_FILE);
    }
    if (fs.existsSync(DB_FILE + '.bak')) {
      fs.renameSync(DB_FILE + '.bak', DB_FILE);
    }
  });

  it('should add and retrieve transactions for a user', () => {
    const user = 'test_user_1';
    mockDb.addTransaction(user, {
      tipe: 'Pemasukan',
      nominal: 1000000,
      deskripsi: 'Gaji awal',
      tanggal: '2026-07-01 10:00:00'
    });

    mockDb.addTransaction(user, {
      tipe: 'Pengeluaran',
      nominal: 150000,
      deskripsi: 'Belanja sayur',
      tanggal: '2026-07-02 12:00:00'
    });

    const result = mockDb.getTransactions(user);
    expect(result.total).toBe(2);
    expect(result.transactions[0].deskripsi).toBe('Belanja sayur'); // Sorted descending by date
    expect(result.transactions[1].nominal).toBe(1000000);

    const stats = mockDb.getStats(user);
    expect(stats.totalPemasukan).toBe(1000000);
    expect(stats.totalPengeluaran).toBe(150000);
    expect(stats.saldo).toBe(850000);
  });

  it('should filter transactions by date range', () => {
    const user = 'test_user_2';
    mockDb.addTransaction(user, { tipe: 'Pemasukan', nominal: 100, deskripsi: 'A', tanggal: '2026-07-01 12:00:00' });
    mockDb.addTransaction(user, { tipe: 'Pengeluaran', nominal: 50, deskripsi: 'B', tanggal: '2026-07-02 12:00:00' });
    mockDb.addTransaction(user, { tipe: 'Pengeluaran', nominal: 30, deskripsi: 'C', tanggal: '2026-07-03 12:00:00' });

    const filter1 = mockDb.getTransactions(user, { startDate: '2026-07-02', endDate: '2026-07-02' });
    expect(filter1.total).toBe(1);
    expect(filter1.transactions[0].deskripsi).toBe('B');

    const filter2 = mockDb.getTransactions(user, { startDate: '2026-07-02' });
    expect(filter2.total).toBe(2); // B and C
  });

  it('should map telegram chat IDs to usernames', () => {
    mockDb.linkTelegramChat('987654', 'john_doe');
    expect(mockDb.getTelegramUsername('987654')).toBe('john_doe');
    expect(mockDb.getTelegramUsername('111111')).toBeNull();
  });

  it('should check if a sheet exists and if a username is taken by another ChatID', () => {
    expect(mockDb.checkSheetExists('budi')).toBe(false);
    
    mockDb.linkTelegramChat('12345', 'budi');
    expect(mockDb.checkSheetExists('budi')).toBe(true);

    expect(mockDb.isUsernameTaken('budi', '12345')).toBe(false); // same ChatID
    expect(mockDb.isUsernameTaken('budi', '67890')).toBe(true);  // different ChatID
    expect(mockDb.isUsernameTaken('unknown_user', '67890')).toBe(false);
  });
});
