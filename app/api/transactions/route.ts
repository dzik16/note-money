import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { googleSheets } from '@/app/lib/googleSheets';

export async function GET(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const username = cookieStore.get('username')?.value;

    if (!username) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1') || 1;
    const limit = parseInt(searchParams.get('limit') || '10') || 10;
    const startDate = searchParams.get('startDate') || undefined;
    const endDate = searchParams.get('endDate') || undefined;

    const result = await googleSheets.getTransactions(username, {
      page,
      limit,
      startDate,
      endDate,
    });

    return NextResponse.json({
      success: true,
      ...result,
      username,
      page,
      limit,
    });
  } catch (error: any) {
    console.error('Error fetching transactions:', error);
    return NextResponse.json({ error: 'Gagal mengambil data transaksi' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const username = cookieStore.get('username')?.value;

    if (!username) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { tipe, nominal, deskripsi, tanggal } = await req.json();

    if (!tipe || !['Pemasukan', 'Pengeluaran'].includes(tipe)) {
      return NextResponse.json({ error: 'Tipe transaksi tidak valid' }, { status: 400 });
    }

    const amount = parseFloat(nominal);
    if (isNaN(amount) || amount <= 0) {
      return NextResponse.json({ error: 'Nominal harus lebih besar dari 0' }, { status: 400 });
    }

    if (!deskripsi || !deskripsi.trim()) {
      return NextResponse.json({ error: 'Deskripsi wajib diisi' }, { status: 400 });
    }

    const result = await googleSheets.addTransaction(username, {
      tipe,
      nominal: amount,
      deskripsi: deskripsi.trim(),
      tanggal: tanggal || undefined,
    });

    return NextResponse.json({
      success: true,
      transaction: result,
      isFallback: result.isFallback,
    });
  } catch (error: any) {
    console.error('Error adding transaction:', error);
    return NextResponse.json({ error: 'Gagal menyimpan transaksi' }, { status: 500 });
  }
}
