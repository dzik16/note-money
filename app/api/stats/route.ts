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

    const stats = await googleSheets.getStats(username);

    return NextResponse.json({
      success: true,
      ...stats,
    });
  } catch (error: any) {
    console.error('Error fetching stats:', error);
    return NextResponse.json({ error: 'Gagal mengambil data statistik' }, { status: 500 });
  }
}
