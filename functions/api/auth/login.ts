import { drizzle } from 'drizzle-orm/d1';
import { AuthService } from '../../../src/services/auth';

interface Env {
  DB: D1Database;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const { email, password } = await context.request.json() as any;
    const db = drizzle(context.env.DB);
    const authService = new AuthService(db);

    const result = await authService.login(email, password);

    if (!result) {
      return new Response(JSON.stringify({ error: 'Invalid credentials' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const response = new Response(JSON.stringify({ success: true, user: result.user }), {
      headers: { 'Content-Type': 'application/json' },
    });
    
    // Set cookie
    response.headers.append('Set-Cookie', `session=${result.session}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=86400`);

    return response;
  } catch (error: any) {
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
