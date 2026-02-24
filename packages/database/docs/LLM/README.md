# LLM: Database package

This document is for AI assistants working in `packages/database`.

## Structure

- **src/tables/** — Drizzle table definitions. One file per table (e.g. `users.ts`, `items.ts`). Export tables from `src/tables/index.ts`. Drizzle-kit reads this folder for `db:generate`.
- **src/tables/relations.ts** — Drizzle relations between tables. Add `relations()` definitions here when you have multiple related tables.
- **src/schemas/** — Zod schemas for validation. Use `createInsertSchema` / `createSelectSchema` from `drizzle-zod` on your tables. Export from `src/schemas/index.ts`. The server uses these for request validation.
- **src/index.ts** — Exports `getDrizzleClient(connectionString)`, the `schema` object (must include all tables), and Supabase helpers: `getSupabase`, `getSupabaseAuthClient`, `parseSupabaseAuthUrl`.
- **drizzle/** — Generated migrations. Do not edit by hand. Created when you run `db:generate`.
- **drizzle.config.ts** — Drizzle-kit config: `schema: "./src/tables"`, `out: "./drizzle"`, dialect `postgresql`. DB URL from `SUPABASE_URL`.

## Adding a table

1. Create `src/tables/<name>.ts` with your `pgTable(...)` definition (e.g. id, timestamps, columns).
2. Export the table from `src/tables/index.ts` (e.g. `export { myTable } from "./my-table";`).
3. In `src/index.ts`, import the table and add it to the `schema` object: `const schema = { myTable, ... };`.
4. If the table has relations to others, add them in `src/tables/relations.ts`.
5. Add Zod schemas in `src/schemas/<name>.ts` (e.g. `createInsertSchema(myTable)`, `createSelectSchema(myTable)`) and export from `src/schemas/index.ts`.
6. From package root run: `npm run db:generate`, then `npm run db:migrate`.

## Migrations

- Always generate after schema changes: `npm run db:generate` (from `packages/database`).
- Apply migrations: `npm run db:migrate`.
- Do not edit files in `drizzle/` manually.

## Auth

- `getSupabaseAuthClient(authUrl)` and `parseSupabaseAuthUrl(envUrl)` are for server-side auth only (token verification). This package does not contain app-specific auth logic (e.g. sign-up flows); that lives in the server.

## Bruno (API collection)

- **packages/bruno** — Bruno API collection for the monorepo server. Open the folder in [Bruno](https://www.usebruno.com/) to run requests. Currently includes only the **health** endpoint: `GET /health` (use the `local` environment; default base URL `http://localhost:3001`).
