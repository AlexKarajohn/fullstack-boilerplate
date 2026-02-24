import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { uploads } from "../tables/uploads";

export const selectUploadSchema = createSelectSchema(uploads);
export const insertUploadSchema = createInsertSchema(uploads);
export const updateUploadSchema = insertUploadSchema.partial();
