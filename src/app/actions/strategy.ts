'use server';

import { getDb } from '@/db';
import { revalidatePath } from 'next/cache';
import { getUserId } from '@/lib/auth';
import { workspaces, offers, icpProfiles, markets } from '@/db/schema/strategy';
import { eq, sql, and } from 'drizzle-orm';
import { z } from 'zod';
import { withLogging } from '@/lib/actions/with-logging';
import { generateOfferAndICPFromDescription } from '@/lib/ai';

const SignalDefSchema = z.object({
  name: z.string().min(1),
  weight: z.number().int().min(1).max(10),
  description: z.string().min(1),
});

const OfferSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  targetPain: z.string().optional(),
  desiredOutcome: z.string().optional(),
  proofPoints: z.array(z.string()).optional(),
  forbiddenClaims: z.array(z.string()).optional(),
});

const ICPSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  positiveSignals: z.array(SignalDefSchema).optional(),
  negativeSignals: z.array(SignalDefSchema).optional(),
  disqualifiers: z.array(z.string()).optional(),
});

const MarketSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  icpProfileId: z.string().optional(),
  offerId: z.string().optional(),
  status: z.enum(['active', 'paused']).optional(),
});

export async function getOrCreateWorkspaceAction() {
  const userId = await getUserId();
  if (!userId) return { error: 'Unauthorized' };

  const db = getDb();
  const existing = await db.select().from(workspaces).where(eq(workspaces.id, userId)).limit(1);

  if (existing.length > 0) {
    return { success: true, workspace: existing[0] };
  }

  const now = new Date();
  await db.insert(workspaces).values({ id: userId, name: `${userId}'s Workspace`, createdAt: now, updatedAt: now });
  const [ws] = await db.select().from(workspaces).where(eq(workspaces.id, userId)).limit(1);
  return { success: true, workspace: ws };
}

export async function listOffersAction() {
  const userId = await getUserId();
  if (!userId) return { error: 'Unauthorized' };

  const db = getDb();
  const ws = await getOrCreateWorkspaceAction();
  if (!ws.success || !ws.workspace) return { error: 'No workspace' };

  const rows = await db.select().from(offers).where(eq(offers.workspaceId, ws.workspace.id));
  return { success: true, offers: rows };
}

export async function getOfferAction(offerId: string) {
  const userId = await getUserId();
  if (!userId) return { error: 'Unauthorized' };

  const db = getDb();
  const ws = await getOrCreateWorkspaceAction();
  if (!ws.success || !ws.workspace) return { error: 'No workspace' };

  const [row] = await db.select().from(offers).where(and(eq(offers.id, offerId), eq(offers.workspaceId, ws.workspace.id))).limit(1);
  if (!row) return { error: 'Offer not found' };
  return { success: true, offer: row };
}

async function saveOfferActionImpl(prev: any, form: FormData) {
  const userId = await getUserId();
  if (!userId) return { error: 'Unauthorized' };

  const db = getDb();
  const ws = await getOrCreateWorkspaceAction();
  if (!ws.success || !ws.workspace) return { error: 'No workspace' };

  const raw: Record<string, unknown> = {
    name: form.get('name'),
    targetPain: form.get('targetPain') || '',
    desiredOutcome: form.get('desiredOutcome') || '',
  };

  const proofsRaw = form.get('proofPoints');
  const claimsRaw = form.get('forbiddenClaims');
  if (typeof proofsRaw === 'string') raw.proofPoints = proofsRaw ? JSON.parse(proofsRaw) : [];
  if (typeof claimsRaw === 'string') raw.forbiddenClaims = claimsRaw ? JSON.parse(claimsRaw) : [];

  const validated = OfferSchema.safeParse(raw);
  if (!validated.success) {
    return { error: 'Validation failed', issues: validated.error.format() };
  }

  const offerId = form.get('id') as string || crypto.randomUUID();
  const now = new Date();
  const data = {
    name: validated.data.name,
    targetPain: validated.data.targetPain || null,
    desiredOutcome: validated.data.desiredOutcome || null,
    proofPoints: validated.data.proofPoints ? JSON.stringify(validated.data.proofPoints) : null,
    forbiddenClaims: validated.data.forbiddenClaims ? JSON.stringify(validated.data.forbiddenClaims) : null,
    updatedAt: now,
  };

  if (form.get('id')) {
    await db.update(offers).set(data).where(and(eq(offers.id, offerId), eq(offers.workspaceId, ws.workspace.id)));
  } else {
    await db.insert(offers).values({ id: offerId, workspaceId: ws.workspace.id, ...data, createdAt: now });
  }

  revalidatePath('/personalisation/offer');
  return { success: true, offerId };
}

export const saveOfferAction = withLogging('saveOfferAction', saveOfferActionImpl);

export async function listICPProfilesAction() {
  const userId = await getUserId();
  if (!userId) return { error: 'Unauthorized' };

  const db = getDb();
  const ws = await getOrCreateWorkspaceAction();
  if (!ws.success || !ws.workspace) return { error: 'No workspace' };

  const rows = await db.select().from(icpProfiles).where(eq(icpProfiles.workspaceId, ws.workspace.id));
  return { success: true, profiles: rows };
}

export async function getICPProfileAction(icpId: string) {
  const userId = await getUserId();
  if (!userId) return { error: 'Unauthorized' };

  const db = getDb();
  const ws = await getOrCreateWorkspaceAction();
  if (!ws.success || !ws.workspace) return { error: 'No workspace' };

  const [row] = await db.select().from(icpProfiles).where(and(eq(icpProfiles.id, icpId), eq(icpProfiles.workspaceId, ws.workspace.id))).limit(1);
  if (!row) return { error: 'ICP profile not found' };
  return { success: true, profile: row };
}

async function saveICPProfileActionImpl(prev: any, form: FormData) {
  const userId = await getUserId();
  if (!userId) return { error: 'Unauthorized' };

  const db = getDb();
  const ws = await getOrCreateWorkspaceAction();
  if (!ws.success || !ws.workspace) return { error: 'No workspace' };

  const raw: Record<string, unknown> = {
    name: form.get('name'),
  };

  const posRaw = form.get('positiveSignals');
  const negRaw = form.get('negativeSignals');
  const disqRaw = form.get('disqualifiers');
  if (typeof posRaw === 'string') raw.positiveSignals = posRaw ? JSON.parse(posRaw) : [];
  if (typeof negRaw === 'string') raw.negativeSignals = negRaw ? JSON.parse(negRaw) : [];
  if (typeof disqRaw === 'string') raw.disqualifiers = disqRaw ? JSON.parse(disqRaw) : [];

  const validated = ICPSchema.safeParse(raw);
  if (!validated.success) {
    return { error: 'Validation failed', issues: validated.error.format() };
  }

  const icpId = form.get('id') as string || crypto.randomUUID();
  const now = new Date();
  const data = {
    name: validated.data.name,
    positiveSignals: validated.data.positiveSignals ? JSON.stringify(validated.data.positiveSignals) : null,
    negativeSignals: validated.data.negativeSignals ? JSON.stringify(validated.data.negativeSignals) : null,
    disqualifiers: validated.data.disqualifiers ? JSON.stringify(validated.data.disqualifiers) : null,
    updatedAt: now,
  };

  if (form.get('id')) {
    await db.update(icpProfiles).set(data).where(and(eq(icpProfiles.id, icpId), eq(icpProfiles.workspaceId, ws.workspace.id)));
  } else {
    await db.insert(icpProfiles).values({ id: icpId, workspaceId: ws.workspace.id, ...data, createdAt: now });
  }

  revalidatePath('/personalisation/icp');
  return { success: true, icpId };
}

export const saveICPProfileAction = withLogging('saveICPProfileAction', saveICPProfileActionImpl);

export async function listMarketsAction() {
  const userId = await getUserId();
  if (!userId) return { error: 'Unauthorized' };

  const db = getDb();
  const ws = await getOrCreateWorkspaceAction();
  if (!ws.success || !ws.workspace) return { error: 'No workspace' };

  const rows = await db
    .select({
      id: markets.id,
      name: markets.name,
      workspaceId: markets.workspaceId,
      icpProfileId: markets.icpProfileId,
      offerId: markets.offerId,
      status: markets.status,
      createdAt: markets.createdAt,
      updatedAt: markets.updatedAt,
      offerName: offers.name,
      icpName: icpProfiles.name,
    })
    .from(markets)
    .leftJoin(offers, eq(markets.offerId, offers.id))
    .leftJoin(icpProfiles, eq(markets.icpProfileId, icpProfiles.id))
    .where(eq(markets.workspaceId, ws.workspace.id));
  return { success: true, markets: rows };
}

export async function getMarketAction(marketId: string) {
  const userId = await getUserId();
  if (!userId) return { error: 'Unauthorized' };

  const db = getDb();
  const ws = await getOrCreateWorkspaceAction();
  if (!ws.success || !ws.workspace) return { error: 'No workspace' };

  const [row] = await db.select().from(markets).where(and(eq(markets.id, marketId), eq(markets.workspaceId, ws.workspace.id))).limit(1);
  if (!row) return { error: 'Market not found' };
  return { success: true, market: row };
}

async function saveMarketActionImpl(prev: any, form: FormData) {
  const userId = await getUserId();
  if (!userId) return { error: 'Unauthorized' };

  const db = getDb();
  const ws = await getOrCreateWorkspaceAction();
  if (!ws.success || !ws.workspace) return { error: 'No workspace' };

  const raw: Record<string, unknown> = {
    name: form.get('name'),
    icpProfileId: form.get('icpProfileId') || undefined,
    offerId: form.get('offerId') || undefined,
    status: form.get('status') || 'active',
  };

  const validated = MarketSchema.safeParse(raw);
  if (!validated.success) {
    return { error: 'Validation failed', issues: validated.error.format() };
  }

  const marketId = form.get('id') as string || crypto.randomUUID();
  const now = new Date();
  const data = {
    name: validated.data.name,
    icpProfileId: validated.data.icpProfileId || null,
    offerId: validated.data.offerId || null,
    status: validated.data.status || 'active',
    updatedAt: now,
  };

  if (form.get('id')) {
    await db.update(markets).set(data).where(and(eq(markets.id, marketId), eq(markets.workspaceId, ws.workspace.id)));
  } else {
    await db.insert(markets).values({ id: marketId, workspaceId: ws.workspace.id, ...data, createdAt: now });
  }

  revalidatePath('/settings/market');
  return { success: true, marketId };
}

export const saveMarketAction = withLogging('saveMarketAction', saveMarketActionImpl);

async function deleteMarketActionImpl(marketId: string) {
  const userId = await getUserId();
  if (!userId) return { error: 'Unauthorized' };

  const db = getDb();
  const ws = await getOrCreateWorkspaceAction();
  if (!ws.success || !ws.workspace) return { error: 'No workspace' };

  await db.delete(markets).where(and(eq(markets.id, marketId), eq(markets.workspaceId, ws.workspace.id)));
  revalidatePath('/settings/market');
  return { success: true };
}

export const deleteMarketAction = withLogging('deleteMarketAction', deleteMarketActionImpl);

export const createMarketWithWizardAction = withLogging(
  'createMarketWithWizardAction',
  async (prev: any, form: FormData) => {
    const userId = await getUserId();
    if (!userId) return { error: 'Unauthorized' };

    const db = getDb();
    const ws = await getOrCreateWorkspaceAction();
    if (!ws.success || !ws.workspace) return { error: 'No workspace' };

    const marketName = form.get('marketName') as string;
    const offerDescription = form.get('offerDescription') as string;
    const icpDescription = form.get('icpDescription') as string;

    if (!marketName || !offerDescription || !icpDescription) {
      return { error: 'All fields are required.' };
    }

    try {
      // 1. Generate Offer and ICP structures via AI
      const aiResult = await generateOfferAndICPFromDescription(
        db,
        marketName,
        offerDescription,
        icpDescription,
        userId
      );

      const offerId = crypto.randomUUID();
      const icpId = crypto.randomUUID();
      const marketId = crypto.randomUUID();
      const now = new Date();

      // 2. Insert Offer
      await db.insert(offers).values({
        id: offerId,
        workspaceId: ws.workspace.id,
        name: aiResult.offer.name,
        targetPain: aiResult.offer.targetPain,
        desiredOutcome: aiResult.offer.desiredOutcome,
        proofPoints: JSON.stringify(aiResult.offer.proofPoints),
        forbiddenClaims: JSON.stringify(aiResult.offer.forbiddenClaims),
        createdAt: now,
        updatedAt: now,
      });

      // 3. Insert ICP Profile
      await db.insert(icpProfiles).values({
        id: icpId,
        workspaceId: ws.workspace.id,
        name: aiResult.icp.name,
        positiveSignals: JSON.stringify(aiResult.icp.positiveSignals),
        negativeSignals: JSON.stringify(aiResult.icp.negativeSignals),
        disqualifiers: JSON.stringify(aiResult.icp.disqualifiers),
        createdAt: now,
        updatedAt: now,
      });

      // 4. Insert Market linking both
      await db.insert(markets).values({
        id: marketId,
        workspaceId: ws.workspace.id,
        name: marketName,
        offerId,
        icpProfileId: icpId,
        status: 'active',
        createdAt: now,
        updatedAt: now,
      });

      revalidatePath('/markets');
      return { success: true, marketId };
    } catch (err: any) {
      return { error: `Failed to create market: ${err.message}` };
    }
  }
);
