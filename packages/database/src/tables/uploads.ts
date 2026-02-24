import { pgTable, text, uuid, integer, timestamp } from "drizzle-orm/pg-core";
import { uploadEntityTypeEnum } from "../shared/entity-type";

/**
 * File upload metadata. Blobs live in Supabase Storage; this table tracks
 * bucket, key, filename, size, and who uploaded for listing and access control.
 * Optional entity_type + entity_id link this upload to a resource (e.g. post, comment).
 */
export const uploads = pgTable("uploads", {
  id: uuid("id").primaryKey().defaultRandom(),
  bucket: text("bucket").notNull(),
  objectKey: text("object_key").notNull(),
  filename: text("filename").notNull(),
  mimeType: text("mime_type").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  /** Supabase Auth user id (auth.users.id). */
  uploadedBy: uuid("uploaded_by"),
  /** Polymorphic attachment: type of the owning entity (e.g. post, comment). */
  entityType: uploadEntityTypeEnum("entity_type"),
  /** Id of the owning entity. */
  entityId: uuid("entity_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type Upload = typeof uploads.$inferSelect;
export type NewUpload = typeof uploads.$inferInsert;
