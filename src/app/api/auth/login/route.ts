import { NextResponse } from 'next/server';
import { AuthService } from '@/services/auth';
import { drizzle } from 'drizzle-orm/d1';

export const runtime = 'edge';

export async function POST(request: Request) {
  const env = (process as any).env;
  const d1 = env.DB;
  
  if (!d1) {
    return NextResponse.json({ error: 'Database connection failed' }, { status: 500 });
  }

  const db = drizzle(d1);
  const authService = new AuthService(db);

  try {
    const { email, password } = await request.json();
    
    // For MVP/Demo: If no users exist, create an initial admin user
    // This is a temporary measure for internal-only setup
    const usersCount = await db.select().from(require('@/db/schema').users).limit(1);
    if (usersCount.length === 0 && email === 'admin@agency.com' && password === 'admin123') {
       await authService.createUser('Admin', 'admin@agency.com', 'admin123');
    }

    const result = await authService.login(email, password);

    if (!result) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    const response = NextResponse.json({ success: true, user: result.user });
    
    response.cookies.set('session', result.session, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      expires: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });

    return response;
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
