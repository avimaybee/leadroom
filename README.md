# Leadroom

Internal operating system for a small creative agency — lead discovery, research, website audit, scoring, outreach, and pipeline management.

> **Status**: Active development. See [Plans](./plans/README.md) for the implementation roadmap.

## Quick Start

1. Copy `.env.example` to `.env.local`
2. Edit `.env.local` with your settings
3. Run `npm install`
4. Run `npm run dev`
5. Open http://localhost:3000

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start the development server |
| `npm run build` | Build for production |
| `npm test` | Run the test suite |
| `npm run lint` | Run ESLint |
| `npm run db:generate` | Generate Drizzle migrations |
| `npm run db:migrate` | Apply local database migrations |
| `npm run db:seed` | Seed the database with test data |

## Project Structure

| Directory | Purpose |
|-----------|---------|
| `src/app/` | Pages, API routes, and client components (Next.js App Router) |
| `src/services/` | Business logic and data access layer |
| `src/db/` | Database schema, migrations, and tests |
| `src/lib/` | Shared utilities (auth, AI, scraping) |
| `src/components/` | Shared UI components |
| `src/workflows/` | Cloudflare Workflow definitions |
| `plans/` | Implementation plans and execution index |

## Key Documents

- [Implementation Plans](./plans/README.md)
- [UI-UX Overhaul Plan](./UI-UX-overhaul/PLAN.md)
- [Agent Operating Contract](AGENTS.md)
