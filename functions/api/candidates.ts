import { drizzle } from 'drizzle-orm/d1';
import { DiscoveryService } from '../../src/services/discovery';
import { CreateCandidateLeadSchema } from '../../src/db/models/discovery';

interface Env {
  DB: D1Database;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  try {
    const url = new URL(context.request.url);
    const scopeId = url.searchParams.get('scopeId');
    if (!scopeId) {
      return new Response(JSON.stringify({ success: false, error: 'scopeId parameter is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const db = drizzle(context.env.DB);
    const service = new DiscoveryService(db);
    const candidates = await service.listCandidatesByScope(scopeId);
    return new Response(JSON.stringify({ success: true, data: candidates }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const body = await context.request.json();
    const parsed = CreateCandidateLeadSchema.safeParse(body);
    if (!parsed.success) {
      return new Response(JSON.stringify({ success: false, error: parsed.error.format() }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const db = drizzle(context.env.DB);
    const service = new DiscoveryService(db);

    const id = crypto.randomUUID();
    const candidate = await service.createCandidateLead(id, parsed.data);

    return new Response(JSON.stringify({ success: true, data: candidate }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
