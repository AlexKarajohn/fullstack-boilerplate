# File uploads — reference implementation (Supabase Storage)

Reference code for LLMs and developers: implement an uploads API using Supabase Storage and an `uploads` table. **No live endpoints are mounted**; copy or adapt the code below into your routes and services.

## Enable in the app

1. Create `apps/server/src/services/upload-service.ts` and `apps/server/src/routes/uploads.ts` from the code blocks below.
2. In `apps/server/src/routes/index.ts`:  
   `import { uploadsRouter } from "./uploads";` then `app.use("/uploads", uploadsRouter);`
3. Ensure the `uploads` table and Storage bucket exist (see README).

## Dependencies

- **DB**: `packages/database` — `uploads` table, `uploadEntityTypeEnum` in `src/tables/uploads.ts` and `src/shared/entity-type.ts`. Run `db:generate` and `db:migrate`.
- **Env**: `SUPABASE_AUTH_URL` (API URL with service role key), `SUPABASE_STORAGE_BUCKET` (default `uploads`), optional `UPLOAD_MAX_FILE_BYTES`, `UPLOAD_ALLOWED_MIMES`.

---

## Routes: `routes/uploads.ts`

```ts
/// <reference path="../types/express.d.ts" />
import { Router, Request, Response } from "express";
import multer from "multer";
import { requireAuth, optionalAuth } from "../middlewares/requireAuth";
import {
  uploadFile,
  listUploads,
  getUploadById,
  getSignedUrl,
  deleteUpload,
} from "../services/upload-service";

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: Number(process.env.UPLOAD_MAX_FILE_BYTES) || 10 * 1024 * 1024, // 10 MiB
  },
});

/** POST /uploads — multipart/form-data, field "file". Optional auth sets uploadedBy. */
router.post(
  "/",
  optionalAuth,
  upload.single("file"),
  async (req: Request, res: Response) => {
    const file = req.file;
    if (!file) {
      return res
        .status(400)
        .json({ error: "No file uploaded; use multipart field 'file'" });
    }
    try {
      const userId = req.auth?.supabaseUser?.id ?? null;
      const result = await uploadFile({
        buffer: file.buffer,
        filename: file.originalname,
        mimeType: file.mimetype,
        uploadedBy: userId,
      });
      return res.status(201).json(result);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Upload failed";
      return res.status(400).json({ error: message });
    }
  },
);

/** GET /uploads — list; optional ?mine=1 & ?limit=N */
router.get("/", optionalAuth, async (req: Request, res: Response) => {
  try {
    const limit = req.query.limit ? Math.min(Number(req.query.limit), 100) : 50;
    const mine = req.query.mine === "1" || req.query.mine === "true";
    const uploadedBy =
      mine && req.auth?.supabaseUser ? req.auth.supabaseUser.id : undefined;
    const data = await listUploads({
      limit,
      uploadedBy: uploadedBy ?? undefined,
    });
    return res.json(data);
  } catch {
    return res.status(500).json({ error: "Failed to list uploads" });
  }
});

/** GET /uploads/:id — one record; optional ?signed=1 for signed URL */
router.get("/:id", optionalAuth, async (req: Request, res: Response) => {
  const id =
    typeof req.params.id === "string" ? req.params.id : req.params.id?.[0];
  if (!id) return res.status(400).json({ error: "Missing id" });
  try {
    const row = await getUploadById(id);
    if (!row) return res.status(404).json({ error: "Not found" });
    const payload: Record<string, unknown> = { ...row };
    if (req.query.signed === "1" || req.query.signed === "true") {
      payload.signedUrl = await getSignedUrl(row.objectKey);
    }
    return res.json(payload);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to get upload";
    return res.status(500).json({ error: message });
  }
});

/** DELETE /uploads/:id — delete storage + DB; requireAuth, uploader-only if desired */
router.delete("/:id", requireAuth, async (req: Request, res: Response) => {
  const id =
    typeof req.params.id === "string" ? req.params.id : req.params.id?.[0];
  if (!id) return res.status(400).json({ error: "Missing id" });
  const userId = req.auth?.supabaseUser?.id;
  try {
    const deleted = await deleteUpload(id, {
      requireUploadedBy: userId ?? undefined,
    });
    if (!deleted)
      return res.status(404).json({ error: "Not found or not allowed" });
    return res.json({ message: "Deleted" });
  } catch {
    return res.status(500).json({ error: "Delete failed" });
  }
});

export const uploadsRouter = router;
```

---

## Service: `services/upload-service.ts`

```ts
import type { Upload } from "@repo/database";
import { desc, eq } from "drizzle-orm";
import { db } from "../db";
import { getSupabaseAuthClient } from "../db";
import { uploads } from "@repo/database";

const BUCKET = process.env.SUPABASE_STORAGE_BUCKET ?? "uploads";
const MAX_FILE_BYTES = Number(process.env.UPLOAD_MAX_FILE_BYTES) || 10 * 1024 * 1024; // 10 MiB
const ALLOWED_MIMES = (process.env.UPLOAD_ALLOWED_MIMES ?? "image/*,application/pdf").split(",").map((s) => s.trim());

function isAllowedMime(mime: string): boolean {
  if (ALLOWED_MIMES.includes(mime)) return true;
  return ALLOWED_MIMES.some((pattern) => {
    if (pattern.endsWith("/*")) return mime.startsWith(pattern.slice(0, -1));
    return mime === pattern;
  });
}

function getCauseMessage(err: Error, seen = new Set<Error>()): string {
  if (!err || seen.has(err)) return "";
  seen.add(err);
  const cause = (err as Error & { cause?: Error }).cause;
  if (cause) return getCauseMessage(cause, seen) || cause.message || "";
  return "";
}

export interface UploadResult {
  id: string;
  bucket: string;
  objectKey: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  uploadedBy: string | null;
  createdAt: Date;
  url?: string;
}

export async function uploadFile(params: {
  buffer: Buffer;
  filename: string;
  mimeType: string;
  uploadedBy: string | null;
}): Promise<UploadResult> {
  const { buffer, filename, mimeType, uploadedBy } = params;
  if (buffer.length > MAX_FILE_BYTES) {
    throw new Error(`File too large (max ${MAX_FILE_BYTES} bytes)`);
  }
  if (!isAllowedMime(mimeType)) {
    throw new Error(`Disallowed MIME type: ${mimeType}`);
  }
  const supabase = getSupabaseAuthClient();
  const ext = filename.includes(".") ? filename.slice(filename.lastIndexOf(".")) : "";
  const objectKey = `${Date.now()}-${crypto.randomUUID()}${ext}`;

  const { data: storageData, error: storageError } = await supabase.storage
    .from(BUCKET)
    .upload(objectKey, buffer, { contentType: mimeType, upsert: false });

  if (storageError) {
    const causeMsg = getCauseMessage(storageError as Error);
    const isFetchFailed = storageError.message === "fetch failed";
    const localHint = isFetchFailed
      ? ` For local Supabase: SUPABASE_AUTH_URL=http://:SERVICE_ROLE_KEY@127.0.0.1:54321, run \`supabase start\`, and create bucket "${BUCKET}" in Studio (http://127.0.0.1:54323).`
      : "";
    const hint = isFetchFailed
      ? `${localHint}${causeMsg ? ` Cause: ${causeMsg}` : ""}`
      : causeMsg ? ` ${causeMsg}` : "";
    throw new Error(`Storage upload failed: ${storageError.message}.${hint}`);
  }

  const [row] = await db
    .insert(uploads)
    .values({
      bucket: BUCKET,
      objectKey: storageData.path,
      filename,
      mimeType,
      sizeBytes: buffer.length,
      uploadedBy: uploadedBy ?? null,
    })
    .returning();

  if (!row) throw new Error("Failed to save upload record");
  const result: UploadResult = {
    id: row.id,
    bucket: row.bucket,
    objectKey: row.objectKey,
    filename: row.filename,
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes,
    uploadedBy: row.uploadedBy,
    createdAt: row.createdAt,
  };
  const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(storageData.path);
  result.url = urlData?.publicUrl;
  return result;
}

export async function listUploads(params: {
  limit?: number;
  uploadedBy?: string | null;
}): Promise<Upload[]> {
  const limit = Math.min(params.limit ?? 50, 100);
  const base = db.select().from(uploads).orderBy(desc(uploads.createdAt)).limit(limit);
  if (params.uploadedBy != null) {
    return base.where(eq(uploads.uploadedBy, params.uploadedBy));
  }
  return base;
}

export async function getUploadById(id: string): Promise<Upload | null> {
  const [row] = await db.select().from(uploads).where(eq(uploads.id, id)).limit(1);
  return row ?? null;
}

export async function getSignedUrl(objectKey: string, expiresInSeconds = 3600): Promise<string> {
  const supabase = getSupabaseAuthClient();
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(objectKey, expiresInSeconds);
  if (error) throw new Error(`Signed URL failed: ${error.message}`);
  return data.signedUrl;
}

export async function deleteUpload(id: string, options?: { requireUploadedBy?: string }): Promise<boolean> {
  const row = await getUploadById(id);
  if (!row) return false;
  if (options?.requireUploadedBy != null && row.uploadedBy !== options.requireUploadedBy) {
    return false;
  }
  const supabase = getSupabaseAuthClient();
  await supabase.storage.from(row.bucket).remove([row.objectKey]);
  const deleted = await db.delete(uploads).where(eq(uploads.id, id)).returning();
  return deleted.length > 0;
}
```

---

## Other reference locations

| Purpose        | Location |
|----------------|----------|
| DB table       | `packages/database/src/tables/uploads.ts`, `src/shared/entity-type.ts` |
| Zod schema     | `packages/database/src/schemas/uploads.ts` |
| Bruno request  | `packages/bruno/uploads/Upload File.yml` |
