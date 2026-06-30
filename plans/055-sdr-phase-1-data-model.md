# Phase 1: Data Model Realignment (Configuration Layer)

## Agent Context
**Goal**: Establish the foundational Drizzle data structures for the SDR Pivot. 
**Background**: This codebase is a Next.js (App Router) application backed by Cloudflare D1 and Drizzle ORM. 
**Current State**: The core entity is `leads` in `src/db/schema/core.ts`. We need to introduce the configuration layer (`Workspace`, `Offer`, `ICPProfile`, `Market`) and extend the `leads` table with scoring data. You are acting as the database architect.

## Step 1: Create the Strategy Schema
**File to create**: `src/db/schema/strategy.ts`
1. Import necessary Drizzle types: `import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';`
2. Define the `workspaces` table:
   ```typescript
   export const workspaces = sqliteTable('workspaces', {
     id: text('id').primaryKey(),
     name: text('name').notNull(),
     createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
     updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
   });
   ```
3. Define the `offers` table. It links to a workspace.
   ```typescript
   export const offers = sqliteTable('offers', {
     id: text('id').primaryKey(),
     workspaceId: text('workspace_id').references(() => workspaces.id).notNull(),
     name: text('name').notNull(),
     targetPain: text('target_pain').notNull(), // e.g., "Manual data entry takes 10 hours a week"
     desiredOutcome: text('desired_outcome'),   // e.g., "Automate entry and save 10 hours"
     proofPoints: text('proof_points'),         // JSON string array of case studies
     forbiddenClaims: text('forbidden_claims'), // JSON string array of things the AI cannot say
   });
   ```
4. Define the `icpProfiles` table. It links to a workspace.
   ```typescript
   export const icpProfiles = sqliteTable('icp_profiles', {
     id: text('id').primaryKey(),
     workspaceId: text('workspace_id').references(() => workspaces.id).notNull(),
     name: text('name').notNull(),
     // We store complex arrays as JSON strings in D1/SQLite
     positiveSignals: text('positive_signals'), // JSON: Array<{ name: string, weight: number }>
     negativeSignals: text('negative_signals'), // JSON: Array<{ name: string, weight: number }>
     disqualifiers: text('disqualifiers'),      // JSON: Array<string>
   });
   ```
5. Define the `markets` table. A market is the intersection of an Offer and an ICP Profile.
   ```typescript
   export const markets = sqliteTable('markets', {
     id: text('id').primaryKey(),
     workspaceId: text('workspace_id').references(() => workspaces.id).notNull(),
     name: text('name').notNull(),
     offerId: text('offer_id').references(() => offers.id).notNull(),
     icpProfileId: text('icp_profile_id').references(() => icpProfiles.id).notNull(),
     status: text('status').notNull().default('ACTIVE'), // 'ACTIVE' or 'PAUSED'
   });
   ```

## Step 2: Extend the Core `leads` Table
**File to modify**: `src/db/schema/core.ts`
1. Open the file and locate `export const leads = sqliteTable('leads', { ... })`.
2. Add the following new SDR-specific columns directly to the `leads` table definition:
   ```typescript
   marketId: text('market_id'), // Will eventually reference markets.id
   fitScore: integer('fit_score').default(0).notNull(),
   confidenceScore: integer('confidence_score').default(0).notNull(),
   priorityTier: text('priority_tier'), // Enum: 'TIER_1', 'TIER_2', 'TIER_3', 'DISQUALIFIED'
   disqualifiedReason: text('disqualified_reason'),
   ```
*(Note: We keep the table name as `leads` rather than renaming to `prospects` to avoid destructive database migrations and breaking existing API routes. Treat the word "Lead" and "Prospect" synonymously in the code).*

## Step 3: Centralize Schema Exports
**File to modify**: `src/db/schema/index.ts` (Create if it doesn't exist, or modify `src/db/index.ts` if schemas are exported there).
1. Ensure that the new `strategy.ts` file is exported alongside `core.ts` so Drizzle can discover it.
   ```typescript
   export * from './core';
   export * from './strategy';
   ```

## Step 4: Database Migrations
**Terminal Execution**:
1. Run `npm run db:generate` to invoke Drizzle Kit. 
2. Verify that a new `.sql` file appears in the `drizzle/` or `migrations/` folder. Do NOT edit this SQL file manually.

## Step 5: Update the SQLite Mock for Integration Tests
**File to modify**: `src/app/api/__tests__/routes.test.ts` and/or `src/db/__tests__/test-helpers.ts` (wherever the SQLite mock db is initialized).
1. The tests use an in-memory SQLite database (`better-sqlite3` or similar via Drizzle). If you do not create the tables here, tests will throw `SQLITE_ERROR: no such table`.
2. Find the setup block (e.g., `beforeAll` or the mock database constructor) that executes raw `CREATE TABLE` queries.
3. Append the SQL to create `workspaces`, `offers`, `icp_profiles`, and `markets`.
4. Append the new columns (`market_id`, `fit_score`, `confidence_score`, `priority_tier`, `disqualified_reason`) to the `leads` table creation script.
5. **Run tests**: Execute `npm test` and ensure all tests still pass. DO NOT proceed to Phase 2 if tests are failing.
