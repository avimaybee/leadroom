import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const response = NextResponse.json({ success: true });
  response.headers.append(
    'Set-Cookie',
    `__Secure-session=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`
  );
  return response;
}
