# Leadroom — Autonomous SDR / Founder-Led Sales Agent

A founder-led sales intelligence system that researches niche markets, scores ICP fit with cited evidence, drafts personalized outreach, requires human approval before sending, and learns which signals correlate with replies and wins.

## Quick Start

```bash
npm install
npm run db:migrate
npm run db:seed
npm run dev
```

Login: `admin@agency.com` / `admin123`

## The Workflow

1. **Define your Offer** — What do you sell? What pain do you solve?
2. **Build your ICP** — What signals indicate a good fit? What disqualifiers?
3. **Create a Market** — Connect your Offer and ICP to define a target segment.
4. **Import Prospects** — Add companies to research and score.
5. **Command Center** — Review scored, evidence-backed prospects.
6. **Generate Outreach** — AI drafts personalized messages citing exact evidence.
7. **Approve or Reject** — Every draft requires human review.
8. **Track Outcomes** — Log replies, meetings, and wins.
9. **Learning Loop** — The system suggests ICP improvements based on outcomes.

## Technology Stack

- **Frontend Framework**: Next.js 15 (App Router, React 19)
- **Styling**: Tailwind CSS
- **Database & Persistence**: Cloudflare D1 (SQLite)
- **ORM**: Drizzle ORM
- **Workflows & Background Jobs**: Cloudflare Workflows
- **Testing Suite**: Native Node.js Test Runner (`node --test` + `tsx`)

## Core Tenets

1. **Explainable Scoring**: All prospect prioritization scores use clear, visible weights rather than opaque AI inferences.
2. **Traceable Evidence**: Every AI-generated claim links to source citations with confidence markers.
3. **No Automatic Outreach**: Live outreach is never dispatched autonomously; every action passes through an approval step.
4. **Resilient Data Models**: System accepts partial data and preserves human edits from being overwritten.

## Product Surfaces

- **Command Center** (`/`): Sortable prospect table with metrics bar
- **Prospects** (`/prospects`): Evidence panels, fit scoring, outreach state machine
- **Markets** (`/markets`): Target market configuration linked to offers and ICPs
- **Pipeline** (`/pipeline`): Kanban board by SDR stage (New → Won/Lost)
- **Research Queue** (`/research`): Expandable task tracking with retry
- **Approvals Queue** (`/approvals`): Review and approve/reject outreach drafts
- **Learning Inbox** (`/learning`): ICP optimization suggestions from outcome analysis

## Design System

See `DESIGN.md` for the full design system spec.
