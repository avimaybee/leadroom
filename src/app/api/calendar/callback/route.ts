import { getDb } from '@/db';
import { CalendarService } from '@/services/calendar';
import { redirect } from 'next/navigation';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');

  if (!code || !state) {
    return Response.json({ error: 'Missing code or state parameter' }, { status: 400 });
  }

  const db = getDb();
  const calendarService = new CalendarService(db);
  const result = await calendarService.exchangeCode(code, state);

  if (result.error) {
    return Response.json({ error: result.error }, { status: 400 });
  }

  redirect('/settings/integrations?calendar=connected');
}
