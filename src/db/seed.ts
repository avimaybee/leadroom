import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import crypto from 'node:crypto';
import { hashPassword } from '../lib/auth';

async function seed() {
  const dbDir = path.resolve('.wrangler/state/v3/d1/miniflare-D1DatabaseObject');

  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  const files = fs.readdirSync(dbDir);
  const sqliteFile = files.find((f) => f.endsWith('.sqlite')) || 'local-db.sqlite';
  const dbPath = path.join(dbDir, sqliteFile);

  console.log('Seeding database at:', dbPath);
  const db = new Database(dbPath);

  // Check if workspaces table exists
  const hasWorkspaces = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='workspaces'")
    .get();

  if (!hasWorkspaces) {
    console.error('Error: tables do not exist. Please generate and apply migrations first:');
    console.error('  npm run db:generate && npm run db:migrate');
    process.exit(1);
  }

  const workspaceCount = (db.prepare('SELECT count(*) as count FROM workspaces').get() as any).count;

  if (workspaceCount > 0) {
    console.log('Database already contains data. Seeding skipped.');
    return;
  }

  const now = new Date();
  const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
  const oneHourAgo = new Date(now.getTime() - 1 * 60 * 60 * 1000);

  // ── 1. Admin user ──
  let userId: string = crypto.randomUUID();
  const existingUser = db.prepare('SELECT id FROM users WHERE email = ?').get('admin@agency.com') as { id: string } | undefined;
  if (existingUser) {
    userId = existingUser.id;
  } else {
    const hashedPassword = await hashPassword('admin123');
    db.prepare('INSERT INTO users (id, name, email, password) VALUES (?, ?, ?, ?)').run(
      userId, 'Default Admin', 'admin@agency.com', hashedPassword
    );
  }

  // ── 2. Workspace ──
  const wsId = 'workspace-default';
  db.prepare('INSERT INTO workspaces (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)').run(
    wsId, 'GrowthOS Agency', now.getTime(), now.getTime()
  );

  // ── 3. Offer ──
  const offerId = 'offer-001';
  db.prepare(
    'INSERT INTO offers (id, workspace_id, name, target_pain, desired_outcome, proof_points, forbidden_claims, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(
    offerId,
    wsId,
    'AI Website & Workflow Automation',
    'Manual lead intake and outdated website conversion flows waste time and lose revenue.',
    'Automated lead qualification, modern website experience, 3x conversion rate.',
    JSON.stringify([
      'Increased conversion 4x for a D2C skincare brand',
      'Automated 200+ weekly manual lead follow-ups for a local clinic',
      'Reduced manual data entry by 15 hours/week for a B2B SaaS startup',
    ]),
    JSON.stringify([
      'We guarantee specific results',
      'We are cheaper than hiring in-house',
      'We replace your existing team',
    ]),
    now.getTime(),
    now.getTime()
  );

  // ── 4. ICP Profile ──
  const icpId = 'icp-001';
  db.prepare(
    'INSERT INTO icp_profiles (id, workspace_id, name, positive_signals, negative_signals, disqualifiers, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(
    icpId,
    wsId,
    'Growth-Stage B2B with Outdated Web Presence',
    JSON.stringify([
      { name: 'Outdated website UX', weight: 30, description: 'Site looks 5+ years old, poor mobile, weak CTAs' },
      { name: 'Manual intake process', weight: 25, description: 'Lead intake or scheduling is manual, no automation' },
      { name: 'Hiring for growth/ops roles', weight: 20, description: 'Actively hiring sales, marketing, or operations' },
      { name: 'High-ticket service', weight: 15, description: 'Service priced $5k+, indicating budget for improvements' },
      { name: 'Weak local SEO', weight: 10, description: 'Poor local search ranking, missing Google Business' },
    ]),
    JSON.stringify([
      { name: 'Uses competing software', weight: 15, description: 'Already using a similar automation tool' },
      { name: 'Very small team (<5)', weight: 10, description: 'May lack budget or decision-making authority' },
    ]),
    JSON.stringify([
      'No clear commercial intent',
      'Enterprise (500+ employees)',
      'No public website or contact path',
      'Outside target geography',
    ]),
    now.getTime(),
    now.getTime()
  );

  // ── 5. Market ──
  const marketId = 'market-001';
  db.prepare(
    'INSERT INTO markets (id, workspace_id, name, icp_profile_id, offer_id, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(
    marketId, wsId, 'D2C & Local Service Businesses', icpId, offerId, 'active', now.getTime(), now.getTime()
  );

  // ── 6. Prospects ──
  interface ProspectSeed {
    id: string;
    name: string;
    company: string;
    website: string;
    stage: string;
    fitScore: number | null;
    confidenceScore: number | null;
    priorityTier: string | null;
    disqualifiedReason: string | null;
    fitReasoning: string | null;
  }

  const prospects: ProspectSeed[] = [
    { id: 'prospect-001', name: 'Sarah Chen', company: 'Brightwood Dental', website: 'https://brightwooddental.com', stage: 'Researched', fitScore: 88, confidenceScore: 92, priorityTier: 'tier1', disqualifiedReason: null, fitReasoning: JSON.stringify({ matchedSignals: [{ name: 'Outdated website UX', weight: 30, matchStrength: 'strong' }, { name: 'Manual intake process', weight: 25, matchStrength: 'strong' }] }) },
    { id: 'prospect-002', name: 'Marcus Webb', company: 'GreenLeaf Analytics', website: 'https://greenleafanalytics.io', stage: 'Outreach Drafted', fitScore: 76, confidenceScore: 85, priorityTier: 'tier1', disqualifiedReason: null, fitReasoning: JSON.stringify({ matchedSignals: [{ name: 'Manual intake process', weight: 25, matchStrength: 'strong' }, { name: 'Hiring for growth/ops roles', weight: 20, matchStrength: 'partial' }] }) },
    { id: 'prospect-003', name: 'Dr. Lisa Park', company: 'Metro Medical Group', website: 'https://metromedicalgroup.com', stage: 'Researched', fitScore: 45, confidenceScore: 90, priorityTier: 'tier2', disqualifiedReason: null, fitReasoning: JSON.stringify({ matchedSignals: [{ name: 'Weak local SEO', weight: 10, matchStrength: 'strong' }] }) },
    { id: 'prospect-004', name: 'James Wheeler', company: 'Peak Performance Coaching', website: 'https://peakperformancecoaching.com', stage: 'Awaiting Approval', fitScore: 92, confidenceScore: 65, priorityTier: 'tier1', disqualifiedReason: null, fitReasoning: JSON.stringify({ matchedSignals: [{ name: 'Outdated website UX', weight: 30, matchStrength: 'strong' }, { name: 'High-ticket service', weight: 15, matchStrength: 'strong' }, { name: 'Manual intake process', weight: 25, matchStrength: 'partial' }] }) },
    { id: 'prospect-005', name: 'Tom Harrison', company: 'Hudson River Logistics', website: 'https://hudsonlogistics.com', stage: 'Researched', fitScore: 22, confidenceScore: 95, priorityTier: 'tier3', disqualifiedReason: null, fitReasoning: JSON.stringify({ matchedSignals: [{ name: 'Manual intake process', weight: 25, matchStrength: 'weak' }] }) },
    { id: 'prospect-006', name: 'Amanda Reyes', company: 'Apex Consulting Group', website: 'https://apexconsulting.com', stage: 'In Research', fitScore: null, confidenceScore: null, priorityTier: null, disqualifiedReason: null, fitReasoning: null },
    { id: 'prospect-007', name: 'Dr. Michael Torres', company: 'Northside Family Clinic', website: 'https://northsidefamilyclinic.com', stage: 'Researched', fitScore: 81, confidenceScore: 40, priorityTier: 'tier1', disqualifiedReason: null, fitReasoning: JSON.stringify({ matchedSignals: [{ name: 'Outdated website UX', weight: 30, matchStrength: 'strong' }, { name: 'Manual intake process', weight: 25, matchStrength: 'strong' }, { name: 'Weak local SEO', weight: 10, matchStrength: 'strong' }] }) },
    { id: 'prospect-008', name: 'Elena Kovalenko', company: 'Quantum Data Systems', website: 'https://quantumdatasys.com', stage: 'Researched', fitScore: 0, confidenceScore: 88, priorityTier: 'disqualified', disqualifiedReason: 'Enterprise (500+ employees)', fitReasoning: JSON.stringify({ disqualified: true, reason: 'Enterprise (500+ employees)' }) },
    { id: 'prospect-009', name: 'David Okonkwo', company: 'Horizon Environmental', website: 'https://horizonenv.com', stage: 'Contacted', fitScore: 68, confidenceScore: 78, priorityTier: 'tier2', disqualifiedReason: null, fitReasoning: JSON.stringify({ matchedSignals: [{ name: 'Outdated website UX', weight: 30, matchStrength: 'partial' }, { name: 'Manual intake process', weight: 25, matchStrength: 'weak' }] }) },
    { id: 'prospect-010', name: 'Rachel Kim', company: 'ClearView Analytics', website: 'https://clearviewanalytics.com', stage: 'Meeting Booked', fitScore: 72, confidenceScore: 82, priorityTier: 'tier1', disqualifiedReason: null, fitReasoning: JSON.stringify({ matchedSignals: [{ name: 'Manual intake process', weight: 25, matchStrength: 'strong' }, { name: 'Hiring for growth/ops roles', weight: 20, matchStrength: 'strong' }] }) },
    { id: 'prospect-011', name: 'Robert Gallagher', company: 'Silver Oak Winery', website: 'https://silveroakwinery.com', stage: 'New', fitScore: null, confidenceScore: null, priorityTier: null, disqualifiedReason: null, fitReasoning: null },
    { id: 'prospect-012', name: 'Jennifer Walsh', company: 'Pacific NW Logistics', website: 'https://pacificnwlogistics.com', stage: 'Lost', fitScore: 35, confidenceScore: 70, priorityTier: 'tier3', disqualifiedReason: null, fitReasoning: JSON.stringify({ matchedSignals: [{ name: 'Manual intake process', weight: 25, matchStrength: 'weak' }] }) },
  ];

  for (const p of prospects) {
    db.prepare(
      `INSERT INTO prospects (id, name, company, website, stage, fit_score, confidence_score, priority_tier, disqualified_reason, fit_reasoning, owner_id, workspace_id, market_id, status, created_at, updated_at, stage_updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Active', ?, ?, ?)`
    ).run(
      p.id, p.name, p.company, p.website, p.stage,
      p.fitScore, p.confidenceScore, p.priorityTier, p.disqualifiedReason, p.fitReasoning,
      userId, wsId, marketId,
      now.getTime(), now.getTime(), now.getTime()
    );
  }

  // ── 7. Research Tasks ──
  const researchedIds = ['prospect-001', 'prospect-002', 'prospect-003', 'prospect-004', 'prospect-005', 'prospect-007', 'prospect-008', 'prospect-009', 'prospect-010', 'prospect-012'];
  for (const pid of researchedIds) {
    const taskId = crypto.randomUUID();
    db.prepare(
      `INSERT INTO research_tasks (id, prospect_id, task_type, status, confidence, extracted_signals, raw_artifacts, started_at, completed_at, created_at, updated_at)
       VALUES (?, ?, 'WEBSITE_ANALYST', 'COMPLETED', ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      taskId, pid, 85 + Math.floor(Math.random() * 10),
      JSON.stringify([{ name: 'Outdated website UX', matchStrength: 'strong', evidenceQuote: 'Site appears to use an older template with poor mobile responsiveness.' }]),
      JSON.stringify({ summary: 'Website appears outdated with limited mobile optimization.' }),
      twoHoursAgo.getTime(), oneHourAgo.getTime(), twoHoursAgo.getTime(), oneHourAgo.getTime()
    );
  }

  // Add a RUNNING task for prospect-006
  const runningTaskId = crypto.randomUUID();
  db.prepare(
    `INSERT INTO research_tasks (id, prospect_id, task_type, status, started_at, created_at, updated_at)
     VALUES (?, ?, 'WEBSITE_ANALYST', 'RUNNING', ?, ?, ?)`
  ).run(runningTaskId, 'prospect-006', now.getTime(), now.getTime(), now.getTime());

  // ── 8. Research Snapshots ──
  for (const pid of researchedIds) {
    const ssId = crypto.randomUUID();
    db.prepare(
      `INSERT INTO research_snapshots (id, lead_id, company_summary, confidence_level, origin, created_at, updated_at)
       VALUES (?, ?, ?, 'HIGH', 'AI_GENERATED', ?, ?)`
    ).run(
      ssId, pid,
      `${pid} is a company in the professional services space with opportunities for digital transformation.`,
      now.getTime(), now.getTime()
    );
  }

  // ── 9. Outreach Drafts ──
  const draftData: { id: string; leadId: string; channel: string; status: string; subject: string; body: string; citedEvidence: any; riskFlags: string[] }[] = [
    { id: 'draft-001', leadId: 'prospect-001', channel: 'EMAIL', status: 'DRAFT', subject: 'Quick thought on Brightwood Dental\'s website', body: `Hi Sarah,\n\nI was looking at Brightwood Dental's site and noticed the patient intake process still seems to be phone-based. We've helped similar practices automate this — cutting response time from hours to seconds.\n\nWould you be open to a quick 10-minute chat about it?\n\nBest,\nDefault Admin`, citedEvidence: [{ sentence: 'Manual intake process identified.', evidenceQuote: 'Contact page shows phone-only booking.', sourceUrl: 'https://brightwooddental.com/contact' }], riskFlags: ['Contact name inferred from LinkedIn — may not be accurate'] },
    { id: 'draft-002', leadId: 'prospect-002', channel: 'EMAIL', status: 'DRAFT', subject: 'Idea for GreenLeaf Analytics', body: `Hi Marcus,\n\nI noticed GreenLeaf is expanding your ops team based on recent job postings. We specialize in automating the lead-to-client workflow so your new hires can focus on high-value work instead of manual data entry.\n\nWorth a conversation?\n\nBest,\nDefault Admin`, citedEvidence: [{ sentence: 'Hiring for growth/ops roles detected.', evidenceQuote: 'GreenLeaf is hiring a Sales Operations Manager and a Marketing Coordinator.', sourceUrl: 'https://greenleafanalytics.io/careers' }], riskFlags: [] },
    { id: 'draft-003', leadId: 'prospect-004', channel: 'EMAIL', status: 'DRAFT', subject: 'Thought on Peak Performance\'s site', body: `Hi James,\n\nPeak Performance Coaching offers high-ticket programs, but your website's current design doesn't fully convey the premium experience. We've redesigned similar coaching sites and seen conversion improvements of 3-4x.\n\nWould love to share some ideas.\n\nBest,\nDefault Admin`, citedEvidence: [{ sentence: 'High-ticket service with outdated site.', evidenceQuote: 'Programs priced at $5k+ but site uses generic template.', sourceUrl: 'https://peakperformancecoaching.com/pricing' }], riskFlags: ['Confidence score is moderate (65) — data may be incomplete'] },
    { id: 'draft-004', leadId: 'prospect-009', channel: 'EMAIL', status: 'APPROVED', subject: 'Horizon Environmental — website opportunity', body: `Hi David,\n\nI came across Horizon Environmental's website and noticed the project inquiry process could be streamlined. We build automated intake systems for environmental consulting firms.\n\nLet me know if you'd like to see how it works.\n\nBest,\nDefault Admin`, citedEvidence: [{ sentence: 'Manual inquiry process.', evidenceQuote: 'Contact page requires manual form fill, no auto-response.', sourceUrl: 'https://horizonenv.com/contact' }], riskFlags: [] },
    { id: 'draft-005', leadId: 'prospect-010', channel: 'EMAIL', status: 'SENT', subject: 'ClearView Analytics — automation idea', body: `Hi Rachel,\n\nClearView Analytics seems to be growing — I noticed the hiring push for operations. We help analytics firms automate client onboarding and reporting workflows.\n\nWould you have 15 minutes next week?\n\nBest,\nDefault Admin`, citedEvidence: [{ sentence: 'Growth hiring detected.', evidenceQuote: 'Multiple operations roles posted on LinkedIn.', sourceUrl: 'https://linkedin.com/company/clearview-analytics' }], riskFlags: [] },
    { id: 'draft-006', leadId: 'prospect-012', channel: 'EMAIL', status: 'SENT', subject: 'Pacific NW Logistics follow-up', body: `Hi Jennifer,\n\nWe previously discussed automating Pacific NW's lead intake process. Just checking in to see if the timing is better now.\n\nHappy to do a quick call.\n\nBest,\nDefault Admin`, citedEvidence: [{ sentence: 'Previous conversation noted.', evidenceQuote: 'Manual dispatch process identified as pain point.', sourceUrl: 'https://pacificnwlogistics.com' }], riskFlags: [] },
  ];

  for (const d of draftData) {
    db.prepare(
      `INSERT INTO outreach_drafts (id, lead_id, channel, subject, body, status, origin, cited_evidence, risk_flags, created_by_user_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 'AI_GENERATED', ?, ?, ?, ?, ?)`
    ).run(
      d.id, d.leadId, d.channel, d.subject, d.body, d.status,
      JSON.stringify(d.citedEvidence), JSON.stringify(d.riskFlags),
      userId, now.getTime(), now.getTime()
    );
  }

  // ── 10. Outcomes ──
  const outcomeData: { id: string; prospectId: string; draftId: string; type: string; notes: string | null }[] = [
    { id: crypto.randomUUID(), prospectId: 'prospect-009', draftId: 'draft-004', type: 'REPLIED', notes: 'Interested, asked for case studies' },
    { id: crypto.randomUUID(), prospectId: 'prospect-010', draftId: 'draft-005', type: 'MEETING_BOOKED', notes: 'Demo scheduled for next Thursday' },
    { id: crypto.randomUUID(), prospectId: 'prospect-012', draftId: 'draft-006', type: 'LOST', notes: 'Chose competitor solution' },
  ];

  for (const o of outcomeData) {
    db.prepare(
      `INSERT INTO outcomes (id, prospect_id, outreach_draft_id, outcome_type, notes, logged_by_user_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(o.id, o.prospectId, o.draftId, o.type, o.notes, userId, now.getTime());
  }

  // ── 11. Learning Suggestions ──
  const suggestionData = [
    {
      id: 'suggestion-001',
      workspaceId: wsId,
      suggestedChange: JSON.stringify({
        type: 'increase_weight',
        target: 'Outdated website UX',
        currentValue: 30,
        suggestedValue: 35,
        reason: 'Signal appears in 83% of positive outcomes (5 of 6). Outdated UX strongly correlates with reply rates.',
      }),
      supportingEvidence: JSON.stringify({
        totalOutcomes: 6,
        positiveOutcomes: 5,
        negativeOutcomes: 1,
        signalAppearanceRate: 83,
        sampleProspectIds: ['prospect-001', 'prospect-009', 'prospect-010'],
      }),
    },
    {
      id: 'suggestion-002',
      workspaceId: wsId,
      suggestedChange: JSON.stringify({
        type: 'make_negative',
        target: 'Very small team (<5)',
        currentValue: 10,
        suggestedValue: undefined,
        reason: 'Teams under 5 people show 0% positive outcome rate across 4 prospects. Consider moving to negative signals.',
      }),
      supportingEvidence: JSON.stringify({
        totalOutcomes: 6,
        positiveOutcomes: 0,
        negativeOutcomes: 2,
        signalAppearanceRate: 67,
        sampleProspectIds: ['prospect-005', 'prospect-012'],
      }),
    },
  ];

  for (const s of suggestionData) {
    db.prepare(
      `INSERT INTO learning_suggestions (id, workspace_id, suggested_change, supporting_evidence, status, created_at)
       VALUES (?, ?, ?, ?, 'PENDING', ?)`
    ).run(s.id, s.workspaceId, s.suggestedChange, s.supportingEvidence, now.getTime());
  }

  console.log('Successfully seeded full demo data:');
  console.log('  Email:    admin@agency.com');
  console.log('  Password: admin123');
  console.log('  1 workspace, 1 offer, 1 ICP, 1 market');
  console.log('  12 prospects (varied stages, scores, and states)');
  console.log('  12 research tasks (11 completed, 1 running)');
  console.log('  6 outreach drafts (3 DRAFT, 1 APPROVED, 2 SENT)');
  console.log('  3 outcomes (REPLIED, MEETING_BOOKED, LOST)');
  console.log('  2 pending learning suggestions');
}

seed().catch((err) => {
  console.error('Failed to seed:', err);
  process.exit(1);
});
