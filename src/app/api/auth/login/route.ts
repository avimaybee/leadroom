import { NextRequest, NextResponse } from 'next/server';
import { AuthService } from '@/services/auth';
import { getDb } from '@/db';
import { z } from 'zod';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
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
    
    // Set cookie
    response.headers.append(
      'Set-Cookie',
      `session=${result.session}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=86400`
    );

    return response;
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}
