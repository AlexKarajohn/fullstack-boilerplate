# LLM: Server constructors (table service and endpoints)

This document explains the generic table CRUD building blocks in `src/services/constructors/`. Use them to add new resources without writing repetitive handler code.

## TableDataService (`table-service.ts`)

Generic CRUD + search over a single Drizzle table.

- **Constructor:** `new TableDataService(db, table, config)` or `createTableDataService(db, table, config)`.
- **Arguments:**
  - `db` — Drizzle client from `src/db` (`db`).
  - `table` — The Drizzle table (from `@repo/database`).
  - `config` (optional):
    - `idColumn` — Primary key column name (default `"id"`).
    - `searchFields` — Array of columns to search with `q` (ilike).
    - `searchLimit` — Max rows for search (default 50).
    - `teamIdColumn` — If set, all methods are scoped by `teamId` (e.g. for `/teams/:teamId/players`).
    - `playerIdColumn` — If set, all methods are scoped by `playerId` (e.g. for nested player resources).

- **Methods:**
  - `getById(id, teamId?, playerId?, tx?)` — One row or null.
  - `search({ q, limit, teamId?, playerId?, allowedIds? }, tx?)` — List with total; `allowedIds` filters by id list (for authz).
  - `create(data, teamId?, playerId?, tx?)` — Insert; scoping columns are set from params when provided.
  - `update(id, teamId?, playerId?, data, tx?)` — Partial update.
  - `delete(id, teamId?, playerId?, tx?)` — Delete and return deleted row or null.

Create one service instance per table/resource.

## createTableEndpoints (`table-endpoints.ts`)

Builds Express validator + handler pairs for getById, search, create, update, delete using a `TableDataService`.

- **Signature:** `createTableEndpoints(service, options)` → `{ getById, search, create, update, delete }`, each with `.validator` and `.handler`.

- **Options:**
  - `schemas` — From `@repo/database` Zod:
    - `selectSchema` — Must have `id` and support `.pick({ id: true })` (for params).
    - `insertSchema` — Request body for create.
    - `updateSchema` — Optional; for PATCH body (defaults to `insertSchema.partial()` if safe).
  - `resourceName` — String for `Content-Range` header (e.g. `"players"`).
  - `searchLimit` — Default 50.
  - `getTeamIdFromRequest(req)` — Optional; return `req.params.teamId` (or similar) for team-scoped resources.
  - `getPlayerIdFromRequest(req)` — Optional; for player-scoped resources.
  - `getAllowedIdsFromRequest(req)` — Optional; return e.g. `req.auth?.allowedTeamIds` so search only returns rows whose id is in that list (authz).

- **Wiring to Express:**
  - `router.get("/:id", endpoints.getById.validator, endpoints.getById.handler)`
  - `router.get("/", endpoints.search.validator, endpoints.search.handler)`
  - `router.post("/", endpoints.create.validator, endpoints.create.handler)`
  - `router.patch("/:id", endpoints.update.validator, endpoints.update.handler)`
  - `router.delete("/:id", endpoints.delete.validator, endpoints.delete.handler)`

Always use the **validator** before the **handler** so request params/body are validated. Schemas must come from `@repo/database` (selectSchema with `id`, insertSchema, updateSchema or partial).
