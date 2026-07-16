import { NextResponse, type NextRequest } from 'next/server';
import { verifySession } from './lib/auth';

function addSecurityHeaders(response: NextResponse): void {
  response.headers.set(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; connect-src 'self' https:; frame-src 'none'; object-src 'none'"
  );
  response.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === '/login' || pathname.startsWith('/api/auth')) {
    const response = NextResponse.next();
    addSecurityHeaders(response);
    return response;
  }

  const session = request.cookies.get('__Secure-session')?.value;
  const payload = await verifySession(session);

  if (!payload) {
    if (pathname.startsWith('/api')) {
      const response = NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      addSecurityHeaders(response);
      return response;
    }
    const response = NextResponse.redirect(new URL('/login', request.url));
    addSecurityHeaders(response);
    return response;
  }

  const response = NextResponse.next();
  addSecurityHeaders(response);
  return response;
}

// NOTE: The matcher pattern uses Next.js custom glob syntax (not regex).
// When deploying on Cloudflare Workers via open-next, verify that the pattern
// correctly excludes the Worker's cron route (`api/cron`) from session checks.
// Test with `wrangler deploy --dry-run` if behavior differs from local dev.
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|_next/data|favicon.ico|api/cron).*)',
  ],
};
