import { getLogger } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { AuthService } from '@/services/auth';
import { getDb } from '@/db';
import { checkRateLimit } from '@/lib/rate-limit';
import { z } from 'zod';

const log = getLogger('LoginAPI');

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const rateCheck = await checkRateLimit(`login:${ip}`, 10, 15 * 60 * 1000);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: 'Too many login attempts. Try again later.' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil((rateCheck.reset - Date.now()) / 1000)) } },
      );
    }

    const rawBody = await request.json();
    const parsed = loginSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    }
    const { email, password } = parsed.data;
    const db = getDb();
    const authService = new AuthService(db);

    const result = await authService.login(email, password);

    if (!result) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    const response = NextResponse.json({ success: true, user: result.user });
    const isSecure = request.url.startsWith('https://');
    response.headers.append(
      'Set-Cookie',
      `__Secure-session=${result.session}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=86400`
    );

    return response;
  } catch (error: unknown) {
    log.error('Login error', error);
    return NextResponse.json({ error: 'An internal error occurred' }, { status: 500 });
  }
}
