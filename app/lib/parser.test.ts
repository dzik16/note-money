import { describe, it, expect } from 'vitest';
import { parseMessage } from './parser';

describe('parseMessage', () => {
  it('should parse simple amounts with descriptions (default to Pengeluaran)', () => {
    expect(parseMessage('300rb jajan')).toEqual({
      nominal: 300000,
      tipe: 'Pengeluaran',
      deskripsi: 'Jajan'
    });

    expect(parseMessage('Cash 300rb')).toEqual({
      nominal: 300000,
      tipe: 'Pengeluaran',
      deskripsi: 'Cash'
    });

    expect(parseMessage('50000 makan siang')).toEqual({
      nominal: 50000,
      tipe: 'Pengeluaran',
      deskripsi: 'Makan siang'
    });

    expect(parseMessage('beli kado 150.000')).toEqual({
      nominal: 150000,
      tipe: 'Pengeluaran',
      deskripsi: 'Beli kado'
    });
  });

  it('should detect Pemasukan based on keywords', () => {
    expect(parseMessage('nabung 1jt')).toEqual({
      nominal: 1000000,
      tipe: 'Pemasukan',
      deskripsi: 'Nabung'
    });

    expect(parseMessage('gaji bulanan 5.5jt')).toEqual({
      nominal: 5500000,
      tipe: 'Pemasukan',
      deskripsi: 'Gaji bulanan'
    });

    expect(parseMessage('dapat bonus 200k')).toEqual({
      nominal: 200000,
      tipe: 'Pemasukan',
      deskripsi: 'Dapat bonus'
    });
  });

  it('should parse decimal values with multipliers', () => {
    expect(parseMessage('1.5jt beli ban')).toEqual({
      nominal: 1500000,
      tipe: 'Pengeluaran',
      deskripsi: 'Beli ban'
    });

    expect(parseMessage('gaji 2,5jt')).toEqual({
      nominal: 2500000,
      tipe: 'Pemasukan',
      deskripsi: 'Gaji'
    });
  });

  it('should handle currency prefix Rp', () => {
    expect(parseMessage('rp 20.000 parkir')).toEqual({
      nominal: 20000,
      tipe: 'Pengeluaran',
      deskripsi: 'Parkir'
    });
  });

  it('should fallback description if missing', () => {
    expect(parseMessage('50000')).toEqual({
      nominal: 50000,
      tipe: 'Pengeluaran',
      deskripsi: 'Transaksi Bot'
    });
  });

  it('should return null for invalid inputs', () => {
    expect(parseMessage('')).toBeNull();
    expect(parseMessage('hanya teks saja')).toBeNull();
  });
});
