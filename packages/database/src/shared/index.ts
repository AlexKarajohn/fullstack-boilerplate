/**
 * Shared schema pieces (enums, etc.). Type-only re-exports here so drizzle-kit
 * can use schema: ["./src/shared"] without duplicate enum registration.
 */
export type { UploadEntityType } from "./entity-type";
