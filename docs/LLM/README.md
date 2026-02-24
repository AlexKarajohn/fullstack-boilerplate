# LLM: Repo overview

This document is for AI assistants (LLMs) working in this codebase.

## Monorepo layout

- **apps/** — Applications. `web-app` is an empty placeholder; `server` is the Express API.
- **packages/** — Shared packages. Only `database` exists: Drizzle schema, migrations, Zod schemas, Supabase auth helpers.

## Important facts

- **Frontend:** `apps/web-app` is intentionally empty. The user chooses the FE stack per project (React, Next, Vite, Vue, etc.). Do not assume a framework or add FE boilerplate unless the user asks.
- **Server:** No resource endpoints by default. Only `GET /health`. Add routes using the constructors in `apps/server/src/services/constructors/` (see server LLM docs).
- **Database:** Empty schema by default. No tables. Add tables in `packages/database/src/tables/`, then run `db:generate` and `db:migrate` from that package.

## Where to change what

- **Add a table / migration:** `packages/database` — see `packages/database/docs/LLM/README.md`.
- **Add API routes / CRUD:** `apps/server` — see `apps/server/docs/LLM/README.md` and `constructors.md`.
- **Add frontend:** `apps/web-app` — user brings their own stack.

## Before editing a package

Read the LLM doc in that package first: `packages/database/docs/LLM/README.md`, `apps/server/docs/LLM/README.md`, and `apps/server/docs/LLM/constructors.md` for the server constructors.
