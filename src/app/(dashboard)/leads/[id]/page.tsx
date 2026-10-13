import { redirect } from 'next/navigation';

const WORKSPACE_VIEWS = new Set(['overview', 'research', 'outreach', 'activity']);

/**
 * Legacy route — canonical detail page is now /prospects/[id].
 * Preserves ?view= and ?channel= so old links, notifications, and
 * NBA recommendations land on the same tab.
 */
export default async function LeadDetailRedirect({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ view?: string; channel?: string }>;
}) {
  const { id } = await params;
  const { view, channel } = await searchParams;

  const next = new URLSearchParams();
  let v = view === 'audit' ? 'research' : view;
  if (!WORKSPACE_VIEWS.has(v || '')) v = undefined;
  if (v) next.set('view', v);
  if (v === 'outreach' && channel) next.set('channel', channel);

  const q = next.toString();
  redirect(`/prospects/${id}${q ? `?${q}` : ''}`);
}
