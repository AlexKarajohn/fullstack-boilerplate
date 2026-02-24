import { pgEnum } from "drizzle-orm/pg-core";

/**
 * Entity types that an upload can be attached to (polymorphic attachment).
 * Add new values here and run db:generate + migrate to update the DB enum.
 */
export const UPLOAD_ENTITY_TYPES = ["post", "comment", "profile"] as const;

export type UploadEntityType = (typeof UPLOAD_ENTITY_TYPES)[number];

/** PostgreSQL enum for uploads.entity_type. Keep in sync with UPLOAD_ENTITY_TYPES. */
export const uploadEntityTypeEnum = pgEnum("upload_entity_type", UPLOAD_ENTITY_TYPES);
