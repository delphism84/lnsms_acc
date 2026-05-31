import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { isStoreSiteHost, platformSiteOrigin } from '@/src/lib/siteMode';

export function middleware(request: NextRequest) {
  const host = request.headers.get('host')?.split(':')[0]?.toLowerCase() ?? '';
  const path = request.nextUrl.pathname;

  if (isStoreSiteHost(host) && path.startsWith('/platform')) {
    const url = new URL(path + request.nextUrl.search, platformSiteOrigin());
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
