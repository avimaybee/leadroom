import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const response = NextResponse.json({ success: true });
  const isSecure = request.url.startsWith('https://');
  response.headers.append(
    'Set-Cookie',
    `session=; HttpOnly; ${isSecure ? 'Secure; ' : ''}SameSite=Lax; Path=/; Max-Age=0`
  );
  return response;
}
