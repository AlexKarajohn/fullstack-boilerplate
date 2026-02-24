CREATE TYPE "upload_entity_type" AS ENUM('post', 'comment', 'profile');--> statement-breakpoint
CREATE TABLE "uploads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"bucket" text NOT NULL,
	"object_key" text NOT NULL,
	"filename" text NOT NULL,
	"mime_type" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"uploaded_by" uuid,
	"entity_type" "upload_entity_type",
	"entity_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
