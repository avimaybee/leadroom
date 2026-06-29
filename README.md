# Leadroom

Leadroom is a dedicated, internal-first operating system built for small creative agencies to manage growth, discover potential clients, research them deeply, perform digital presence audits, and draft highly personalized outreach.

Unlike generic CRMs or mass-mailing bots, Leadroom enforces a strict **human-in-the-loop** workflow: the system gathers evidence and calculates transparent priority scores, but final outreach and execution always require human review and approval.

---

## Key Product Surfaces

* **Overview Dashboard**: Triage candidate leads and prioritize follow-ups using Next-Best-Action recommendations.
* **Lead List**: Filter, search, and manage candidate leads and active prospects.
* **Lead Detail Workspace**: Single pane of glass for notes, task history, stakeholder details, and stage transitions.
* **Research Snapshot**: Interactive panel containing public evidence, scraped content, and metadata logs.
* **Digital Presence Audit**: Semi-automated website performance, branding, and messaging evaluation tool.
* **Outreach Assistant**: A draft generator for tailored emails and call prep scripts (featuring clear fallback modes if AI is unconfigured).

---

## Technology Stack

* **Frontend Framework**: Next.js 15 (App Router, React 19)
* **Styling**: Tailwind CSS
* **Database & Persistence**: Cloudflare D1 (SQLite)
* **ORM**: Drizzle ORM
* **Workflows & Background Jobs**: Cloudflare Workflows
* **Testing Suite**: Native Node.js Test Runner (`node --test` + `tsx`)

---

## Core Tenets

1. **Explainable Scoring**: All lead prioritization scores are calculated using clear, visible weights rather than opaque AI inferences.
2. **Traceable Evidence**: Inferred research and enrichment metrics are presented with clear confidence markers (`LOW` / `MEDIUM` / `HIGH`) and linked to source citations.
3. **No Automatic Outreach**: Live outreach must never be dispatched autonomously; every action must pass through an approval step.
4. **Resilient Data Models**: System accepts partial, messy business data (e.g., missing phone numbers or emails) and preserves human edits from being overwritten by AI updates.

---

## Quick Start

### 1. Prerequisite Checklist
* Install **Node.js** (v20+ LTS recommended)
* Clone the repository

### 2. Configuration Setup
Create a `.env.local` configuration file based on the example template:
```bash
cp .env.example .env.local
```
Configure your credentials (e.g., Google Calendar credentials, AI provider keys) in `.env.local` as needed.

### 3. Dependency Installation
Install the required packages:
```bash
npm install
```

### 4. Database Setup
Initialize your local database schema, apply migrations, and seed seed-level data:
```bash
# Generate Drizzle migration SQL files
npm run db:generate

# Apply migrations to the local SQLite database
npm run db:migrate

# Seed database with test leads, configurations, and tasks
npm run db:seed
```

### 5. Running the Application
Launch the local Next.js development server:
```bash
npm run dev
```
Open **[http://localhost:3000](http://localhost:3000)** in your browser.

---

## CLI Reference

| Script | Command | Purpose |
|:---|:---|:---|
| `npm run dev` | `next dev` | Launches the Next.js development server |
| `npm run build` | `next build` | Compiles the production build |
| `npm test` | `node --import tsx --test src/**/*.test.ts` | Runs all integration and unit tests |
| `npm run lint` | `next lint` | Analyzes code for ESLint errors |
| `npm run db:generate` | `drizzle-kit generate` | Compiles schema changes into SQL migration files |
| `npm run db:migrate` | `wrangler d1 migrations apply leadroom --local` | Executes pending D1 migrations |
| `npm run db:seed` | `node --import tsx src/db/seed.ts` | Seeds the local database with initial configurations |

---

## Directory Structure

```text
leadroom/
├── migrations/          # SQLite database migration files
├── plans/               # Roadmaps and implementation documentation
├── src/
│   ├── app/             # Next.js App Router (pages, actions, API routes)
│   ├── components/      # Shared client and server UI components
│   ├── db/              # Drizzle client, seeds, and schema definitions
│   │   └── __tests__/   # Business logic integration & unit tests
│   ├── lib/             # Shared libraries (auth, AI orchestrator, scraper)
│   ├── services/        # Service-layer modules (domain business logic)
│   └── workflows/       # Cloudflare Workflow implementations
└── wrangler.json        # Cloudflare configuration details
```

---

## Key Project Documents

* **[Agent Operating Contract](file:///d:/vs%20code/leadroom/AGENTS.md)** — Core guidelines, non-negotiable rules, and stage-by-stage progression specifications.
* **[Product Requirements Document](file:///d:/vs%20code/leadroom/docs/PRD.md)** — Core scope, user stories, and feature details.
* **[Architecture Specifications](file:///d:/vs%20code/leadroom/docs/ARCHITECTURE.md)** — Data flow, modular layout, and persistent layers.
* **[Data Models](file:///d:/vs%20code/leadroom/docs/DATA_MODEL.md)** — Tabular representations of schemas and indices.
* **[Implementation Plans](file:///d:/vs%20code/leadroom/plans/README.md)** — Feature milestones and stage checklists.
