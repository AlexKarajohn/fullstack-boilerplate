/**
 * Drizzle table definitions. Add one file per table (e.g. users.ts, items.ts)
 * and export types from here. Tables are not re-exported so drizzle-kit can
 * use schema: ["./src/tables", "./src/shared"] without duplicate table registration.
 * Register new tables in packages/database/src/index.ts (schema object + exports).
 */
export type { Upload, NewUpload } from "./uploads";
