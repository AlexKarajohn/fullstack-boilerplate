import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import { relations } from "./tables/relations";
import { uploads } from "./tables/uploads";

const schema = { uploads };
// Relations empty until we add related tables; cast so Drizzle accepts.
export function getDrizzleClient(connectionString: string) {
  return drizzle(connectionString, { schema, relations } as any);
}

/** Returns true if the database is reachable (e.g. for health checks). */
export async function checkDatabaseConnection(connectionString: string): Promise<boolean> {
  const client = getDrizzleClient(connectionString);
  try {
    await client.execute(sql`SELECT 1`);
    return true;
  } catch {
    return false;
  }
}

export { getSupabase } from "./supabase-factory";
export { getSupabaseAuthClient, parseSupabaseAuthUrl } from "./supabase-auth";
export { uploads } from "./tables/uploads";
export type { Upload, NewUpload } from "./tables";
export { uploadEntityTypeEnum, UPLOAD_ENTITY_TYPES } from "./shared/entity-type";
export type { UploadEntityType } from "./shared";
export type { Database } from "./database.types";
