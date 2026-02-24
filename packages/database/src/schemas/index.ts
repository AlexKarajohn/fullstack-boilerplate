/**
 * Zod schemas for validation (createInsertSchema / createSelectSchema from drizzle-zod).
 * Add one file per table when you add tables, and export from here.
 */
export {
  selectUploadSchema,
  insertUploadSchema,
  updateUploadSchema,
} from "./uploads";
