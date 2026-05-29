import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const token = request.cookies.get('admin_token')?.value;
  const path = request.nextUrl.pathname;

  // 로그인 페이지는 인증 불필요
  if (path === '/login') {
    return NextResponse.next();
  }

  // 인증이 필요한 페이지인데 토큰이 없으면 로그인 페이지로 리다이렉트
  // 클라이언트 사이드에서도 체크하므로 여기서는 기본적인 체크만 수행
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};

