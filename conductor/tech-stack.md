# Technology Stack

## Core Language & Runtime
- **TypeScript**: Primary programming language for type-safety and maintainability.
- **Node.js**: Server-side runtime environment.

## AI & LLM Integration
- **Direct fetch / JS SDK**: Thin `lib/ai` module for direct model invocation (dropping Genkit).
- **Gemini API / OpenRouter**: Access models directly without framework overhead.

## Data Handling & Validation
- **Zod**: Schema validation for runtime checks.

## Database & Persistence
- **Cloudflare D1**: SQLite-based database optimized for the edge.
- **Drizzle ORM**: Type-safe SQL client and migration runner.

## Development & Build Tools
- **Next.js & Wrangler**: Next.js App Router for frontend UI and Wrangler/Pages Functions for api routes.

## Testing
- **Node.js Test Runner**: Leveraging the native test runner (`node --test`).
