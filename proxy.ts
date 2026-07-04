import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function proxy(request: NextRequest) {
  const username = request.cookies.get('username')?.value;
  const { pathname } = request.nextUrl;

  // Protect /dashboard
  if (pathname.startsWith('/dashboard') && !username) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  // Redirect logged-in user from login page (/) to /dashboard
  if (pathname === '/' && username) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/', '/dashboard/:path*'],
};
