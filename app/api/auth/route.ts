import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST(req: NextRequest) {
  try {
    const { username } = await req.json();
    
    if (!username || !username.trim()) {
      return NextResponse.json({ error: 'Username wajib diisi' }, { status: 400 });
    }

    const cleanUsername = username.trim().replace(/\s+/g, '_'); // sanitize spaces

    // Set cookie
    const cookieStore = await cookies();
    cookieStore.set('username', cleanUsername, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 60 * 60 * 24 * 7, // 1 week
      path: '/',
    });

    return NextResponse.json({ success: true, username: cleanUsername });
  } catch (error: any) {
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}

export async function DELETE() {
  const cookieStore = await cookies();
  cookieStore.delete('username');
  return NextResponse.json({ success: true });
}
