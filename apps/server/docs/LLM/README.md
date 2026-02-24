# LLM: Server package

This document is for AI assistants working in `apps/server`.

## Structure

- **src/routes/** — Express routers. Mount them in `src/routes/index.ts`. By default only `GET /health` exists; no resource routers.
- **src/db/** — DB client (`db` from `getDrizzleClient`) and `getSupabaseAuthClient()` for server-side auth. Env: `SUPABASE_URL`, `SUPABASE_AUTH_URL`.
- **src/services/** — Business logic. **src/services/constructors/** contains generic building blocks: `TableDataService` and `createTableEndpoints`. Use these to add CRUD for a table without writing boilerplate. See `docs/LLM/constructors.md`.
- **src/middlewares/** — `requireAuth` validates Bearer token and sets `req.auth.supabaseUser`. Add role/team middlewares when you have app-user tables.
- **src/types/** — Express augmentation for `req.auth`.

## Adding a new CRUD resource

1. **In `packages/database`:** Add the table in `src/tables/`, add to schema and relations, add Zod schemas in `src/schemas/`. Run `db:generate` and `db:migrate`.
2. **In this server:**
   - Create a `TableDataService`: `new TableDataService(db, myTable, { searchFields: [...], ... })` (or use `createTableDataService`). Optionally put it in `src/services/data/<resource>.ts` or define inline where you create the router.
   - Call `createTableEndpoints(service, { schemas: { selectSchema, insertSchema, updateSchema }, resourceName, ... })` with schemas from `@repo/database`.
   - Create an Express Router: `router.get("/:id", endpoints.getById.validator, endpoints.getById.handler)`, same for search, post create, patch update, delete. Mount the router in `src/routes/index.ts` (e.g. `app.use("/items", itemsRouter)`).
3. Protect routes with `requireAuth` (and optional role/team middlewares) as needed.

## Auth

- `requireAuth` only sets `req.auth.supabaseUser`. When you add app-user/role/team tables, extend the middleware to load app user and attach `req.auth.appUser`, `req.auth.allowedTeamIds`, etc.
- No auth routes in this boilerplate (no sign-in/sign-up endpoints). Add them when you need them.

## Middlewares

- Attach data to `req` and call `next()`, or send an error response (401, 403, 400). Follow the same pattern as `requireAuth` for new middlewares.
