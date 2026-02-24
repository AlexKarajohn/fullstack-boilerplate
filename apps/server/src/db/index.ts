import * as dotenv from "dotenv";
import path from "path";
import {
  getDrizzleClient,
  getSupabaseAuthClient as getSupabaseAuthClientFromDb,
} from "@repo/database";

dotenv.config();
// In monorepo, root .env.local (from npm run dev) may exist; load it so SUPABASE_* are set when running from apps/server
dotenv.config({ path: path.resolve(process.cwd(), "../../.env.local") });

// Drizzle needs a Postgres URL (postgresql://...). DATABASE_URL is set by sync-env-local; otherwise SUPABASE_URL may be a Postgres URL.
const connectionString =
  process.env.DATABASE_URL ||
  (process.env.SUPABASE_URL?.startsWith("postgresql://")
    ? process.env.SUPABASE_URL
    : undefined);
if (!connectionString) {
  throw new Error(
    "DATABASE_URL or SUPABASE_URL (postgresql://...) is not set. For local dev run 'npm run dev' from the repo root so .env.local gets DATABASE_URL."
  );
}

export const db = getDrizzleClient(connectionString);

export function getSupabaseAuthClient() {
  const raw =
    process.env.SUPABASE_AUTH_URL ??
    (process.env.SUPABASE_URL?.startsWith("https://")
      ? process.env.SUPABASE_URL
      : undefined);
  if (!raw) {
    throw new Error(
      "Set SUPABASE_AUTH_URL to your Supabase API URL with key in it, e.g. https://:YOUR_SERVICE_ROLE_KEY@project-ref.supabase.co"
    );
  }
  return getSupabaseAuthClientFromDb(raw);
}
