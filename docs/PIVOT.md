# Autonomous SDR / Founder-Led Sales Agent - Implementation Roadmap

## Product Definition

Build a founder-led sales operating system that uses agentic workflows to discover, research, prioritize, personalize, and manage outbound sales opportunities. The product should help a founder or small team turn a target market into a qualified, approval-ready pipeline without hiring a sales development team.

This is not an email spam bot. It is a research-first, approval-gated sales intelligence system. The product should make it obvious that the builder understands revenue workflows, founder constraints, AI reliability, data provenance, and product UX.

The user should be able to answer these questions:

- Which companies should I reach out to first?
- Why is this company a good fit?
- What pain point should I lead with?
- What evidence supports that recommendation?
- Who should I contact?
- What personalized message should I send?
- Has this lead been reviewed and approved?
- What happened after outreach?
- Which signals and ICP assumptions are producing better outcomes?

## Strategic Positioning

Do not pitch this as "AI writes cold emails." That category is crowded and low-trust.

Frame it as:

> A founder-led revenue intelligence system that turns niche markets into researched, scored, approval-ready sales opportunities.

The product should feel useful even before sending a single email. The research, prioritization, and decision support are the core. Sending is optional and should be gated.

## Relationship To Leadroom

If this project overlaps with an existing Leadroom-style system, position this roadmap as the sharper product version:

- Leadroom is the internal growth OS.
- This project is the autonomous SDR layer inside or adjacent to that OS.
- The differentiator is agentic research, ICP scoring, evidence-backed recommendations, approval workflows, and outcome learning.

The project should avoid repeating generic CRM features unless they support the agentic sales workflow.

## Target Users

Primary users:

- Startup founders doing founder-led sales
- Small agencies looking for better-fit clients
- Solo consultants selling high-ticket services
- Early B2B SaaS teams before hiring sales
- Technical founders validating markets

Secondary users:

- Recruiters evaluating product and AI engineering ability
- Founders evaluating whether the builder understands revenue
- Agencies needing a serious internal prospecting engine

## Core Product Promise

Given a market, offer, ICP, and constraints, the system researches prospects, scores fit, explains the score with evidence, drafts personalized outreach, requires human approval, tracks outcomes, and learns which signals correlate with replies or wins.

## Design Principles

1. Research quality matters more than automation volume.
2. Every recommendation must show evidence.
3. Every outbound action must be human-reviewable.
4. The system should optimize for fit, timing, and relevance, not raw lead count.
5. The user should always know why an agent made a recommendation.
6. The interface should help founders make fast prioritization decisions.
7. Personalization must be grounded in real company context.
8. Avoid dark-pattern growth hacking language.
9. Make pipeline status clear without copying a bloated enterprise CRM.
10. The product must demonstrate taste, restraint, and operational maturity.

## Information Architecture

Primary navigation:

- Command Center
- Markets
- Prospects
- Research Queue
- Recommendations
- Outreach
- Approvals
- Pipeline
- Signals
- Learning
- Settings

Recommended global layout:

- Left sidebar for navigation
- Top workspace/market selector
- Global search across companies, contacts, campaigns, and recommendations
- Notification area for ready-to-review prospects, blocked research, pending approvals, and reply events
- Main area optimized for dense lead review
- Right-side detail panel for evidence, score breakdown, and message preview

The first screen after onboarding should be the Command Center, not a marketing homepage.

## Visual Direction

The product should feel like a high-trust sales intelligence workstation. It should be calm, information-rich, and fast to scan.

Visual qualities:

- Sharp tables and split panes
- Clear score explanations
- Strong evidence hierarchy
- Compact cards only where useful
- Rich but restrained status language
- Distinct treatment for AI-generated vs human-approved content
- Polished empty states that guide setup

Avoid:

- Generic SaaS hero layouts
- Cartoon sales imagery
- Overly playful copy
- "Crush your pipeline" style language
- Purple-heavy AI assistant visuals
- Chat-first UI as the main product
- Huge cards with low information density
- One-click autonomous sending as the main promise

## Core Domain Model

Workspace:

- A company, agency, or founder workspace.
- Owns markets, offers, ICP profiles, prospects, campaigns, users, settings, and audit records.

Offer:

- What the user sells.
- Includes positioning, pain points, outcomes, proof, pricing range, constraints, and disqualifiers.

ICP Profile:

- The definition of a good-fit customer.
- Includes firmographics, technographics, pain signals, timing signals, buying triggers, disqualifiers, and priority weights.

Market:

- A segment or niche being explored.
- Examples: "D2C skincare brands in India", "Cloudflare-heavy SaaS startups", "local clinics needing AI appointment automation".

Prospect Company:

- A potential customer account.
- Includes name, website, industry, size, location, summary, source, status, score, evidence, and research artifacts.

Contact:

- A person associated with a prospect.
- Includes name, title, role fit, public source, confidence, and outreach status.

Research Task:

- A unit of agentic research.
- Examples: website analysis, pain signal extraction, competitor scan, contact discovery, personalization brief, disqualifier check.

Signal:

- A piece of evidence that affects score or prioritization.
- Examples: hiring for sales ops, outdated website, recent funding, poor SEO, manual support process, new product launch.

Recommendation:

- A suggested action created by the system.
- Examples: prioritize lead, skip lead, request more research, send outreach, change angle, follow up.

Outreach Draft:

- A proposed email, LinkedIn message, call script, or founder note.
- Must include source evidence and approval status.

Approval:

- Human decision before outreach or CRM update.
- Must include content, target, reason, risk, reviewer, decision, timestamp, and notes.

Campaign:

- A structured outreach effort for a market or ICP.
- Includes sequence, tone, constraints, target list, status, and performance.

Pipeline Opportunity:

- A prospect converted into an active sales opportunity.
- Includes stage, value estimate, next step, owner, notes, and outcome.

Outcome:

- Result of an action.
- Examples: replied, booked call, not interested, bounced, wrong person, closed won, closed lost.

Learning Record:

- A feedback artifact connecting signals, recommendations, messages, and outcomes.

Audit Event:

- Immutable record of meaningful actions, especially generated content, approvals, sending, imports, and scoring changes.

## Stage 0 - Product Contract And Demo Niche

Goal:

Define a concrete wedge and demo narrative. Avoid building a generic lead database.

Implement:

- Product brief
- Domain glossary
- Demo market
- Demo offer
- Demo ICP
- Seed prospect list
- Demo outcome history
- Clear non-goals

Recommended demo market:

- Creative agencies looking for higher-ticket local businesses
- AI automation services for agriculture or clinics
- B2B SaaS startups needing technical content engines
- Cloudflare/Next.js agencies targeting outdated business sites

Recommended demo offer:

- "AI-enabled website and workflow automation for businesses with manual lead intake."

ICP example:

- Business has visible inbound interest but poor conversion flow.
- Website shows outdated UX or weak CTA structure.
- Team appears active but operationally stretched.
- Business depends on inquiries, appointments, or client onboarding.
- Exclude very small hobby businesses, enterprise companies, or companies with no public activity.

Non-goals:

- No autonomous spam.
- No scraping private data.
- No fake contact enrichment.
- No black-box scoring.
- No sending without approval.

Acceptance criteria:

- A user can understand exactly who the product helps.
- The demo has enough specificity to feel real.
- The product has clear ethical and operational boundaries.

Agentic engineering instructions:

- Make the coding agent start with a written product map and entity map.
- Require realistic seed data with believable companies and varied fit quality.
- Make the agent generate UX states for empty, loading, failed research, low-confidence research, and approval-needed cases.

## Stage 1 - Static IA Prototype With High-Fidelity Data

Goal:

Build a realistic static product that demonstrates the full workflow before real integrations.

Implement screens:

- Command Center
- Market setup
- ICP builder
- Offer setup
- Prospects list
- Prospect detail
- Research queue
- Recommendation inbox
- Outreach draft review
- Approval queue
- Pipeline board/table
- Signal analytics
- Learning view
- Settings

Command Center:

- Market health
- Ready-to-review prospects
- Top recommended accounts
- Pending outreach approvals
- Research jobs in progress
- Recent replies or outcomes
- Score distribution
- Best-performing signals
- Blocked tasks requiring user input

Market setup:

- Market name
- Geographic scope
- Industry scope
- Company size
- Source rules
- Exclusions
- Notes

ICP builder:

- Positive signals
- Negative signals
- Disqualifiers
- Priority weights
- Example good-fit accounts
- Example bad-fit accounts
- Scoring preview

Offer setup:

- Offer name
- Target pain
- Desired outcome
- Proof points
- Constraints
- Tone
- Forbidden claims
- Call-to-action preferences

Prospects list:

- Company
- Fit score
- Confidence
- Market
- Status
- Top signal
- Last researched
- Recommended action
- Owner
- Outreach status

Prospect detail:

- Company summary
- Fit score breakdown
- Evidence panel
- Research artifacts
- Contacts
- Recommended angle
- Outreach drafts
- Approval history
- Pipeline history
- Outcome history

Research queue:

- Task type
- Prospect
- Status
- Agent
- Started at
- Duration
- Confidence
- Blocking reason
- Retry action

Recommendation inbox:

- Prioritize this company
- Skip this company
- Research more
- Draft outreach
- Follow up
- Update ICP weight
- Convert to opportunity

Outreach review:

- Draft message
- Source evidence
- Personalization notes
- Claims checklist
- Tone checklist
- Risk flags
- Approve, edit, reject, regenerate

Pipeline:

- Stage view and table view
- Next action
- Last touch
- Fit score
- Value estimate
- Outcome
- Notes

Signal analytics:

- Which signals correlate with positive outcomes
- Which signals create false positives
- Which markets produce better fit
- Which message angles perform better

Learning view:

- Outcome summaries
- Suggested ICP changes
- Suggested disqualifier changes
- Suggested offer angle changes
- Human approval required before applying changes

UX heuristics:

- A founder should be able to review a prospect in under one minute.
- The interface must show why a lead is recommended before showing the message draft.
- Evidence should be visible beside scores and messages.
- Low-confidence research must be visually distinct from high-confidence research.
- Approval should feel like a serious review step, not a nuisance modal.
- Tables should be dense, filterable, and sortable.
- Detail views should support quick comparison between prospects.

Acceptance criteria:

- The static prototype tells the complete story from market setup to approved outreach.
- The user can inspect a prospect and understand the recommendation.
- The user can reject weak AI output without breaking the workflow.
- The user can see how outcomes improve future recommendations.

Non-slop code requirements:

- Use structured mock data matching future persistence models.
- Keep scoring display logic centralized.
- Avoid hardcoding one demo prospect into many components.
- Build reusable review panels for evidence, score, and approval.
- Make status names consistent across screens.
- Include realistic long company names, missing data, failed research, and low-confidence states.

## Stage 2 - Workspace, Offer, Market, And ICP Modeling

Goal:

Implement the foundation that makes recommendations meaningful.

Implement:

- Workspace creation
- Offer creation and editing
- Market creation and editing
- ICP profile creation and editing
- Signal weighting
- Disqualifiers
- Source constraints
- Tone and outreach constraints

ICP builder details:

- Positive signals should have names, descriptions, weights, and examples.
- Negative signals should reduce score but not always disqualify.
- Disqualifiers should create hard exclusions.
- Confidence should be separate from fit score.
- Scoring should explain itself in plain language.

Example signals:

- Outdated website conversion flow
- Hiring for roles related to growth or operations
- Recent expansion announcement
- Heavy manual intake process
- Weak local SEO presence
- High-ticket service offering
- Active founder presence
- Visible content gap
- Recent funding
- Uses tools compatible with the user's service

Example disqualifiers:

- No clear commercial intent
- Too small for offer
- Already has strong in-house capability
- Enterprise procurement cycle too long
- No public contact path
- Outside geography

Acceptance criteria:

- A user can define what "good fit" means.
- Score explanations reflect ICP configuration.
- Changing signal weights changes score previews.
- Disqualifiers are visibly different from weak signals.

Agentic engineering instructions:

- Keep scoring rules inspectable and deterministic where possible.
- Do not bury score logic inside prompt text.
- Build the system so LLM research produces evidence, while deterministic scoring applies configured rules.

## Stage 3 - Prospect Ingestion And Research Queue

Goal:

Allow users to add or discover prospects and send them through structured research.

Implement ingestion methods:

- Manual company entry
- CSV import
- Website list import
- Demo source import
- Optional public search integration later

Prospect statuses:

- New
- Queued for research
- Researching
- Research complete
- Needs review
- Recommended
- Disqualified
- Outreach drafted
- Awaiting approval
- Approved
- Contacted
- Replied
- Opportunity
- Closed won
- Closed lost

Research task types:

- Website summary
- ICP fit analysis
- Pain signal extraction
- Disqualifier check
- Competitor or alternative scan
- Contact role mapping
- Personalization brief
- Message angle recommendation
- Data quality check

Research queue UX:

- Show each task as a job with status, target, and evidence output.
- Allow retrying failed research.
- Allow pausing research for a market.
- Show cost/time estimates if model calls are used.
- Show blocked tasks when required input is missing.

Acceptance criteria:

- A user can import a list of companies.
- Each company can move through research tasks.
- Failed research does not corrupt prospect state.
- Research output links back to prospect evidence.

Non-slop code requirements:

- Model research as tasks, not invisible background magic.
- Use explicit task states.
- Store raw artifacts separately from cleaned summaries.
- Keep ingestion validation separate from research execution.

## Stage 4 - Agentic Research Engine

Goal:

Build the agent workflows that turn sparse prospect data into evidence-backed sales intelligence.

Research philosophy:

- Agents gather evidence.
- Deterministic logic scores where possible.
- LLMs summarize, classify, and draft.
- Humans approve outbound actions.

Agent roles:

- Source intake agent
- Website analyst
- ICP fit analyst
- Pain signal analyst
- Contact role analyst
- Personalization strategist
- Outreach drafter
- Quality reviewer

Each agent should have:

- Clear input contract
- Clear output contract
- Allowed tools
- Failure behavior
- Confidence scoring
- Evidence requirements
- Retry policy

Research artifacts:

- Website snapshot summary
- Extracted company facts
- Pain signals
- Disqualifier findings
- Role/contact hypotheses
- Personalization brief
- Recommended angle
- Score explanation

Evidence rules:

- Every major claim must have a source or artifact reference.
- Unsupported claims should be marked as assumptions.
- Confidence should drop when evidence is weak or stale.
- Do not invent contacts, funding, customer names, or technology usage.

Acceptance criteria:

- A prospect detail page shows evidence-backed research.
- Each recommendation references specific signals.
- The system can distinguish "good fit", "bad fit", and "not enough information".
- Agent outputs are structured enough for UI display and scoring.

Agentic engineering instructions:

- Make the coding agent define structured output schemas for every research task.
- Implement validation and repair flows for malformed outputs.
- Keep prompts versioned and named.
- Add trace logs for research runs.
- Make it possible to inspect why a research task produced its result.

## Stage 5 - Fit Scoring And Prioritization

Goal:

Turn research artifacts into ranked, explainable prospect recommendations.

Implement:

- Fit score
- Confidence score
- Timing score
- Personalization strength
- Disqualification logic
- Priority tier
- Score explanation
- Ranking filters

Score components:

- ICP match
- Pain intensity
- Offer relevance
- Timing signals
- Contactability
- Budget likelihood
- Strategic value
- Disqualifier penalty
- Data confidence

Important rule:

Fit score and confidence are separate. A company can look like a great fit with low confidence, or a weak fit with high confidence.

Recommended tiers:

- Tier 1: review now
- Tier 2: research more
- Tier 3: nurture
- Disqualified: skip

Prioritization UX:

- Show score as a gateway to explanation, not as the whole answer.
- Display top positive signals and top concerns.
- Allow filtering by score, confidence, market, status, signal, and recommended action.
- Let users manually override score with a reason.
- Store overrides as learning data.

Acceptance criteria:

- A user can see exactly why a prospect ranks highly.
- Disqualified prospects show the disqualifying reason.
- Manual overrides are tracked.
- Ranking updates when research or ICP settings change.

Non-slop code requirements:

- Implement scoring as a dedicated domain service.
- Keep scoring deterministic given the same inputs.
- Store score snapshots for historical comparison.
- Avoid mixing score calculation with table rendering.

## Stage 6 - Outreach Drafting And Message Strategy

Goal:

Generate personalized, evidence-backed outreach drafts that a founder can approve, edit, or reject.

Outreach types:

- Cold email
- LinkedIn-style message
- Founder note
- Follow-up message
- Call opening script
- Proposal angle summary

Draft inputs:

- Offer
- ICP
- Prospect research
- Contact role
- Pain signals
- Proof points
- Tone constraints
- Forbidden claims
- Desired CTA

Draft output requirements:

- Subject line options
- Message body
- Personalization evidence
- Claims used
- Risk flags
- Confidence
- Suggested CTA
- Alternative angle

Message heuristics:

- Keep messages specific and short.
- Lead with the prospect's context, not generic flattery.
- Avoid unverifiable claims.
- Avoid fake familiarity.
- Avoid overpromising.
- Make the CTA low-friction.
- Match tone to the founder's offer and market.

Outreach review UX:

- Show draft and evidence side by side.
- Highlight which sentence comes from which evidence.
- Show claims checklist.
- Show forbidden-claims warnings.
- Allow inline edits.
- Allow regenerate with instruction.
- Allow approve, reject, or request more research.

Acceptance criteria:

- The user can review a draft without leaving the prospect page.
- The draft clearly cites its personalization basis.
- The user can edit before approval.
- Sending or export is impossible before approval.

Agentic engineering instructions:

- Treat drafting as a separate task after research and scoring.
- Do not let the drafter invent new evidence.
- Add a reviewer pass that checks specificity, unsupported claims, and tone.
- Store draft versions and edits.

## Stage 7 - Approval-Gated Outreach Workflow

Goal:

Make the product safe and credible by requiring human approval before outbound actions.

Implement:

- Approval queue
- Approval detail
- Approve draft
- Reject draft
- Request changes
- Regenerate with instruction
- Mark as manually sent
- Export approved message
- Optional sending integration later

Approval statuses:

- Draft
- Needs review
- Changes requested
- Approved
- Rejected
- Sent
- Failed

Approval detail should show:

- Prospect
- Contact
- Draft content
- Evidence
- Score explanation
- Risk flags
- Prior touches
- Decision actions

Risk flags:

- Weak evidence
- Overly generic message
- Unsupported claim
- Contact role uncertainty
- Tone mismatch
- Too long
- High-value prospect
- Duplicate outreach risk

Acceptance criteria:

- No outbound action can happen without approval.
- Approval decisions are audited.
- Rejected drafts can improve future generation.
- Approved drafts are locked or versioned before sending/export.

UX heuristics:

- Approval should be fast but evidence-rich.
- The system should make weak personalization obvious.
- Rejection should capture why, not just discard output.

## Stage 8 - Pipeline And Outcome Tracking

Goal:

Connect research and outreach to actual sales outcomes.

Implement:

- Pipeline stages
- Prospect conversion to opportunity
- Activity timeline
- Outcome logging
- Follow-up reminders
- Notes
- Value estimate
- Next step tracking
- Lost reason tracking

Pipeline stages:

- Researched
- Outreach approved
- Contacted
- Replied
- Meeting booked
- Proposal
- Won
- Lost
- Nurture

Outcome types:

- No response
- Positive reply
- Negative reply
- Referral
- Wrong contact
- Bounced
- Meeting booked
- Opportunity created
- Closed won
- Closed lost

Pipeline UX:

- Provide both table and board views.
- Keep fit score visible in pipeline.
- Show next action and last touch.
- Allow quick outcome updates.
- Link back to original research and message.

Acceptance criteria:

- A user can trace a won opportunity back to signals, research, and outreach.
- Outcomes can feed the learning system.
- Follow-up tasks are visible and actionable.

Non-slop code requirements:

- Do not merge prospect status and pipeline stage into one ambiguous field.
- Track outcome events explicitly.
- Keep activity timeline append-only where possible.

## Stage 9 - Learning Loop And ICP Refinement

Goal:

Use outcomes to improve prioritization and recommendations without silently changing user strategy.

Implement:

- Outcome analysis
- Signal performance summary
- False positive detection
- False negative notes
- Suggested ICP changes
- Suggested message angle changes
- Suggested disqualifier changes
- Human approval before applying changes

Learning examples:

- Prospects with "outdated website" replied more often when paired with "high-ticket service".
- Companies with no visible founder/operator contact rarely converted.
- Messages mentioning "manual lead intake" outperformed "AI automation".
- Tier 2 prospects with recent hiring signals performed better than Tier 1 prospects without timing signals.

Learning UX:

- Show recommendations as proposed changes, not automatic mutations.
- Explain the supporting data.
- Show sample prospects behind each suggestion.
- Let the user accept, reject, or snooze suggestions.

Acceptance criteria:

- Outcomes influence insights.
- ICP changes require explicit approval.
- The user can inspect why a learning recommendation exists.

Agentic engineering instructions:

- Keep analytics deterministic where possible.
- Use LLMs to summarize patterns, not to secretly rewrite scoring logic.
- Store accepted learning changes as versioned ICP updates.

## Stage 10 - Integrations And BYOK-Friendly Operation

Goal:

Make the system usable without the builder incurring major costs.

Implement:

- Bring-your-own-key provider settings for model calls
- Session-only key option for demos
- Encrypted stored key option for real use
- Cost estimate per research task
- Budget caps
- Model routing by task type
- Export workflows
- Optional CRM export
- Optional email export

Cost-control features:

- Research depth selector
- Cheap/balanced/deep modes
- Cache research artifacts
- Reuse company snapshots
- Batch queue with pause/resume
- Warn before expensive runs
- Show estimated cost before running a market batch

BYOK UX:

- Explain which tasks use model calls.
- Let users test provider connection.
- Show provider health.
- Never make API keys appear in logs.
- Allow deleting provider credentials.

Acceptance criteria:

- The product can run with user-provided model keys.
- The user can estimate cost before batch research.
- Cached artifacts reduce repeated work.
- Demo mode works with seeded data even without keys.

## Stage 11 - Trust, Compliance, And Ethical Boundaries

Goal:

Make the system founder-safe and reputationally sane.

Implement:

- Do-not-contact list
- Duplicate detection
- Contact source tracking
- Outreach frequency limits
- Approval history
- Claims policy
- Forbidden topics/claims
- Data deletion
- Exportable audit log

Trust heuristics:

- Do not suggest deceptive personalization.
- Do not invent relationships.
- Do not imply the founder reviewed something they did not.
- Do not use private or sensitive data sources.
- Do not encourage high-volume spray-and-pray outreach.

Acceptance criteria:

- The system can explain where prospect data came from.
- Users can suppress companies and contacts.
- Outreach drafts are constrained by claims policy.
- Audit logs show who approved what and when.

## Stage 12 - Demo Narrative And Portfolio Polish

Goal:

Turn the project into a highly credible portfolio artifact.

Implement:

- Seeded demo workspace
- One demo offer
- Two demo markets
- Twenty realistic prospects
- Mixed research quality
- Mixed scores
- Several pending approvals
- Several outcome records
- Learning suggestions
- Public read-only demo mode
- Architecture write-up
- Product case study

Demo script:

1. Show Command Center with prospects ready for review.
2. Open a high-scoring prospect.
3. Inspect score breakdown and evidence.
4. Open the personalization brief.
5. Review an outreach draft beside cited evidence.
6. Reject a weak sentence and regenerate with instruction.
7. Approve the final draft.
8. Move prospect into pipeline.
9. Log a reply outcome.
10. Show how outcomes create ICP learning suggestions.

README should explain:

- Product problem
- Why it is not a spam bot
- Domain model
- Agent research workflow
- Scoring system
- Approval workflow
- Learning loop
- BYOK/cost strategy
- Ethical boundaries
- Future roadmap

Resume-ready description:

> Built an approval-gated founder-led sales agent that researches niche markets, scores ICP fit with evidence, drafts personalized outreach, tracks pipeline outcomes, and learns which signals improve reply and conversion rates.

## UI Quality Bar

Every major screen must satisfy these checks:

- Can a founder make a prioritization decision quickly?
- Is every score explained?
- Is every recommendation tied to evidence?
- Are weak-confidence outputs clearly marked?
- Can the user approve, edit, reject, or request more research from the same context?
- Does the pipeline connect back to research and outreach?
- Are empty states useful for first-time setup?
- Are tables dense but readable?
- Are long company names, URLs, and messages handled gracefully?
- Are approval and sending states impossible to confuse?

Avoid:

- "AI generated this lead" without evidence
- Generic cold email templates
- Single-score black boxes
- Over-automated sending
- Fake contact data
- Empty charts
- Bloated CRM screens unrelated to the agentic workflow
- Chatbot UI as the primary interface

## Code Quality Bar

The implementation should prove production judgment.

Required qualities:

- Domain-first naming
- Explicit lifecycle states for prospects, tasks, drafts, approvals, and opportunities
- Clear separation between research agents, scoring logic, drafting logic, approval workflow, and pipeline state
- Structured outputs for all AI tasks
- Validation for generated research and drafts
- Centralized score calculation
- Versioned ICP and offer configuration
- Immutable approval history
- Cost-aware task execution
- Deterministic seed data
- Inspectable agent traces

Avoid:

- One giant `Lead` object with every field shoved into it
- Prompt-only scoring
- Outreach sending inside draft generation
- Research results that cannot be traced to sources
- Hardcoded demo data spread through UI components
- Business rules hidden in button handlers
- Ambiguous statuses like `done` when the domain needs specificity
- Using LLMs where deterministic logic is more reliable

## Suggested Build Order For Agentic Coding

1. Product brief, demo niche, and domain model
2. Static IA prototype with realistic seed data
3. Workspace, offer, market, and ICP setup
4. Prospect ingestion and research queue
5. Agentic research engine
6. Fit scoring and prioritization
7. Outreach drafting
8. Approval workflow
9. Pipeline and outcome tracking
10. Learning loop
11. BYOK and cost controls
12. Trust controls and portfolio polish

The coding agent should complete each stage with visible UI, realistic data, and working state transitions before moving forward. The product should always remain review-first, evidence-first, and founder-safe.
