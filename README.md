# Turbo repo boilerplate

Monorepo with Turborepo: empty frontend placeholder, Express server (health + uploads), Drizzle schema + migrations pipeline, and Supabase auth skeleton.

## Prerequisites

- **Docker** — Local Supabase runs on Docker. Have Docker Desktop (or OrbStack, etc.) installed and running before starting the stack. [Get Docker](https://www.docker.com/get-started).

## One-time setup

1. Clone or copy this repo to where you want your project.
2. From the repo root: `npm install`
3. **Env (hosted/prod):** Copy `.env.example` to `.env.production` and set values for your real environment (see “Running against a real (hosted) environment”).
4. **Local dev:** you can skip manual env setup — `npm run dev` will start Supabase, write URLs/keys to `.env.local`, ensure the Storage bucket exists, then start the apps.
5. When you change database schema, run `npm run db:generate` then migrate (`npm run db:migrate:local` or `npm run db:migrate:prod`).

## Local development with Supabase

Developing locally lets you test migrations, Edge Functions, and RLS without touching production. The stack runs in Docker.

1. **Install the Supabase CLI** (if not already):
   - **macOS (Homebrew):** `brew install supabase/tap/supabase`
   - **Windows/Linux (NPM):** `npm install supabase --save-dev`
2. **Start the local stack and run the app:** From the repo root run:
   ```bash
   npm run dev
   ```
   This will:
   - start the Supabase stack in Docker (first run may take a few minutes)
   - write local URLs and keys to **`.env.local`** (from `supabase status`)
   - ensure the Storage bucket exists (runs `npm run ensure-storage-bucket`)
   - start the Turbo dev pipeline with those env vars

   Local Studio is at **http://localhost:54323**.

   If you restart Supabase, you can re-run:
   - `npm run supabase:sync-env` (refresh `.env.local`)
   - `npm run ensure-storage-bucket` (create the Storage bucket if missing)

   To enable the health-check email, set **`RESEND_API_KEY`** (from [Resend](https://resend.com)) and **`RESEND_HEALTH_TO`** (recipient) in `.env.local`; the sync script does not overwrite these.
4. **Optional — sync from a cloud project:** From `packages/supabase`: `npx supabase login`, then `npx supabase link --project-ref <your-project-id>`, then `npx supabase db pull` to create a migration from your remote schema.

**Useful commands** (run from `packages/supabase`):

| Command | Description |
|--------|-------------|
| `npx supabase stop` | Stop the local stack. Use `--no-backup` to reset all local data. |
| `npx supabase status` | Show local URLs and API keys (anon, service_role). |
| `npx supabase migration new <name>` | Create a new migration in `supabase/migrations`. |
| `npx supabase db reset` | Reset local DB to match migration files. |

## Running against a real (hosted) environment

To point the app at a **Supabase cloud project** (or any real Postgres + Supabase API) instead of the local stack:

1. **Do not** run the local stack or `supabase:sync-env` for this environment. Use a normal env file (e.g. `.env`) that you control.

2. **Set these in `.env`** (or your deployment’s env):

   | Variable | Where to get it | Example |
   |----------|-----------------|--------|
   | `SUPABASE_URL` | Supabase Dashboard → Project Settings → API → **Project URL** | `https://abcdefgh.supabase.co` |
   | `SUPABASE_AUTH_URL` | Same base URL with the **service_role** key in the URL | `https://:your-service-role-key@abcdefgh.supabase.co` |
   | `DATABASE_URL` | Supabase Dashboard → Project Settings → **Database** → Connection string (URI). Use “Transaction” pooler for server apps, or “Session” if you prefer. | `postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres` |
    | `RESEND_API_KEY` | **Resend** API key for sending email. Get it from [Resend Dashboard](https://resend.com/api-keys). Required only if you want the health check to send a test email. | `re_xxxxxxxx` |
   | `RESEND_HEALTH_TO` | Email address that receives the health-check test email when `GET /health` is called. Only used when `RESEND_API_KEY` is set. | `you@example.com` |
   | `PORT` | Optional; server port. | `3001` |
   | `SUPABASE_STORAGE_BUCKET` | Storage bucket name for uploads (optional; default is `uploads`). | `uploads` |
   | `UPLOAD_MAX_FILE_BYTES` | Optional file size limit for uploads. Defaults to 10 MiB. | `10485760` |
   | `UPLOAD_ALLOWED_MIMES` | Optional allowlist for uploads. Defaults to `image/*,application/pdf`. | `image/*,application/pdf` |

   **Important:** Use the **Database** connection string for `DATABASE_URL` (Drizzle talks Postgres directly). Use the **API** URL for `SUPABASE_URL` and `SUPABASE_AUTH_URL` (Supabase JS client and auth).

   **Resend (optional):** The server’s `GET /health` endpoint can send a test email via [Resend](https://resend.com) to verify email delivery. Set both `RESEND_API_KEY` and `RESEND_HEALTH_TO` to enable this; the response includes `email: "ok"` or `"error"`. If either is unset, the health check skips email and returns `email: "skipped"`. When you run `npm run supabase:sync-env`, existing `RESEND_*` values in `.env.local` are preserved and not overwritten.

3. **Run migrations** against that database once (e.g. before first deploy or in a release step):
   ```bash
   cd packages/database
   # ensure .env has DATABASE_URL for the target DB, or:
   DATABASE_URL="postgresql://..." npm run db:migrate
   ```

4. **Start the app** without starting the local Supabase stack:
   - **Recommended:** Copy `.env.example` to **`.env.production`**, fill in your real values, then from repo root run:
     ```bash
     npm run prod
     ```
     This loads `.env.production` and runs the dev pipeline (no local Supabase).
   - Or with a different env file: `dotenv -e .env -- turbo run dev`, or run the server only: `cd apps/server && npm run dev` (with vars in `.env` or in the environment).

For production, set the same variables in your host (e.g. Vercel, Railway, or your server’s env) and run migrations as part of your deploy or release process.

### Hosted environment checklist (required to fully work)

- **Database schema**: run migrations (`npm run db:migrate:prod`) so tables (including `uploads`) exist.
- **Supabase Storage bucket**: create the bucket named by `SUPABASE_STORAGE_BUCKET` (default `uploads`) in Supabase Dashboard → **Storage**.
- **Storage access policies**:
  - Buckets are **private by default**.
  - If you want public reads, mark the bucket public or add Storage policies.
  - If you keep it private, use the API’s signed URLs (`GET /uploads/:id?signed=1`) for temporary access.
- **Auth**: any endpoints protected by `Authorization: Bearer <token>` require a valid Supabase JWT (from your client app after login).

## Structure

- **apps/web-app** — Empty folder. Add your frontend here (React, Next, Vite, Vue, etc.).
- **apps/server** — Express API. Only `GET /health` by default. Add routes and use the constructors in `src/services/constructors/`.
- **packages/database** — Drizzle schema, migrations, Zod schemas, Supabase auth helpers. No tables by default.
- **packages/supabase** — Supabase project config and CLI (local stack, migrations, Edge Functions). Run `supabase start` from here.

## Database scripts (from repo root)

All commands below are run from the **repo root**. They use `.env.local` for local and `.env.production` for prod (via the `:local` / `:prod` suffix).

| Script | Description |
|--------|-------------|
| `npm run db:generate` | Generate migration files from schema (no DB connection). |
| `npm run db:migrate:local` | Run migrations against local DB (uses `.env.local` → `DATABASE_URL`). |
| `npm run db:migrate:prod` | Run migrations against prod DB (uses `.env.production`). |
| `npm run db:reset:local` | Reset local DB to match migrations (Supabase `db reset`; only for local). |
| `npm run db:studio:local` | Open Drizzle Studio against local DB. |
| `npm run db:studio:prod` | Open Drizzle Studio against prod DB. |

Only migrations are used for schema changes (no `db:push`, to avoid dropping tables). There is no `db:reset:prod`; resetting a remote DB is destructive and should be done manually if ever needed.

## Adding tables and API

1. In `packages/database`: add a table in `src/tables/`, add relations in `src/tables/relations.ts`, add Zod schemas in `src/schemas/`, export from `src/index.ts`. Run `npm run db:generate` then `npm run db:migrate:local` (or `:prod`).
2. In `apps/server`: create a `TableDataService` for the table, use `createTableEndpoints(service, options)` from `src/services/constructors/table-endpoints.ts`, mount the router in `src/routes/index.ts`. Protect with `requireAuth` as needed.

## File uploads (Supabase Storage) — reference only

The repo includes **reference code** for a file upload service (Supabase Storage + **`uploads`** table) in a single Markdown file. Endpoints are **not mounted**; the code is for LLMs and developers to copy when implementing uploads. See **[apps/server/src/services/uploads-reference.md](apps/server/src/services/uploads-reference.md)** for the full route and service code; **[docs/uploads-reference.md](docs/uploads-reference.md)** points to that file.

- **Database:** `packages/database` has an `uploads` table (bucket, object_key, filename, mime_type, size_bytes, uploaded_by, created_at). Run `npm run db:generate` and `npm run db:migrate:local` (or `:prod`) so the table exists.
- **Storage bucket (required):**
  - **Local dev**: `npm run dev` runs `npm run ensure-storage-bucket` automatically. You can also run it manually:
    ```bash
    npm run ensure-storage-bucket
    ```
  - **Hosted/prod**: create the bucket named `uploads` (or the value of `SUPABASE_STORAGE_BUCKET`) in Supabase Dashboard → **Storage**.

  For public read access, set the bucket to public; otherwise use `?signed=1` on `GET /uploads/:id` to get a temporary signed URL.
- **Env (optional):** `SUPABASE_STORAGE_BUCKET` (default `uploads`), `UPLOAD_MAX_FILE_BYTES` (default 10 MiB), `UPLOAD_ALLOWED_MIMES` (default `image/*,application/pdf`). Same `SUPABASE_AUTH_URL` used for auth is used for Storage.
- **Routes:**  
  - `POST /uploads` — multipart/form-data, field `file`; requires `Authorization: Bearer <token>`.  
  - `GET /uploads` — list; optional `?mine=1` to filter by current user, `?limit=N`.  
  - `GET /uploads/:id` — one record; optional `?signed=1` for a signed URL.  
  - `DELETE /uploads/:id` — delete file and record; requires auth (only uploader can delete).
- **Using uploads as attachments on other resources:** See **[docs/uploads-as-attachments.md](docs/uploads-as-attachments.md)** for how to attach uploads to CRUD resources (e.g. a post table with photos): schema options, API shape, and create/read/update/delete flows.

## Bruno (API collection)

Open `packages/bruno` in [Bruno](https://www.usebruno.com/).

- **Environment**: use `local` (base URL `http://localhost:3001`)
- **Uploads request**: `uploads/Upload File` sends `POST /uploads` as multipart form-data (`file`)
- **Auth token**: set `token` in the Bruno environment to a valid Supabase JWT if you’re testing auth-protected routes

## LLM / AI assistants

See **docs/LLM/README.md** in this repo and in each package for structure and how to work within it.
