# Using the upload service as attachments on other endpoints

This guide describes how to use the existing **file upload service** (Supabase Storage + `uploads` table) so that other CRUD resources can have **attachments**—for example, a **post** that has attached photos.

---

## Overview

- **Upload service:** `POST /uploads` stores a file in Supabase Storage and inserts a row in the `uploads` table (id, bucket, object_key, filename, mime_type, size_bytes, uploaded_by, created_at).
- **Linking to a resource:** You need a way to associate uploads with an entity (e.g. “these uploads belong to this post”). Two common patterns:

| Pattern | Where the link lives | Use when |
|--------|----------------------|----------|
| **Polymorphic on uploads** | Add `entity_type` + `entity_id` (or `post_id`) on `uploads` | One upload belongs to at most one entity; simple listing by entity. |
| **Join table** | New table e.g. `post_attachments(post_id, upload_id)` | Same upload could be reused, or you want a clear many-to-many. |

Below we use the **polymorphic** pattern (columns on `uploads`) for a **posts with photos** example. The same ideas apply if you use a join table instead.

---

## 1. Schema: link uploads to the resource

### Option A: Polymorphic columns on `uploads`

Add optional columns to `uploads` so an upload can be “attached” to an entity:

```sql
-- Migration (conceptually)
ALTER TABLE uploads
  ADD COLUMN entity_type text,
  ADD COLUMN entity_id   uuid;
-- Optional: index for listing by entity
CREATE INDEX idx_uploads_entity ON uploads (entity_type, entity_id);
```

- When creating an upload that will belong to a post, set `entity_type = 'post'` and `entity_id = <post_id>` (either in the same request or in a follow-up update).
- To list a post’s photos: `SELECT * FROM uploads WHERE entity_type = 'post' AND entity_id = $postId`.

### Option B: Resource-specific FK (e.g. `post_id` on uploads)

If attachments are only for posts, you can add:

```sql
ALTER TABLE uploads ADD COLUMN post_id uuid REFERENCES posts(id);
```

Then list photos for a post with `WHERE post_id = $postId`. Same idea can be applied for other tables (e.g. `profile_id`, `comment_id`).

### Option C: Join table

Keep `uploads` unchanged and add:

```sql
CREATE TABLE post_attachments (
  post_id   uuid NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  upload_id uuid NOT NULL REFERENCES uploads(id) ON DELETE CASCADE,
  sort_order int DEFAULT 0,
  PRIMARY KEY (post_id, upload_id)
);
```

Attach by inserting into `post_attachments`; list a post’s photos by joining `post_attachments` and `uploads`.

---

## 2. Example resource: posts with attached photos

Assume a **posts** table (e.g. id, title, body, author_id, created_at) and that uploads are linked via **Option A** (`entity_type`, `entity_id` on `uploads`).

### API shape (conceptual)

- **Create post with photos**
  - Either: one `multipart/form-data` request with fields `title`, `body`, and multiple `photos` (files).
  - Or: `POST /posts` with JSON `{ title, body }`, then `POST /uploads` for each file with body/query like `entity_type=post&entity_id=<new_post_id>` (after you have the post id).
- **Get post**
  - `GET /posts/:id` returns post plus an array of attachments (e.g. upload id, filename, mimeType, sizeBytes, and optionally `url` or `signedUrl`).
- **Update post**
  - `PATCH /posts/:id` can accept:
    - New photos (e.g. additional `photos` in multipart), and/or
    - `attachmentIdsToRemove: string[]` to detach (and optionally delete) specific uploads.
- **Delete post**
  - Delete the post; then either delete all uploads where `entity_type = 'post' AND entity_id = postId`, or set `entity_type` / `entity_id` to `NULL` to orphan them (policy choice).

---

## 3. Implementing in your CRUD

### 3.1 Create: post with attachments

**Option 1 – Multipart in one request**

1. Route: `POST /posts`, middleware: `requireAuth`, `upload.array('photos', 10)` (or `upload.fields([{ name: 'photos', maxCount: 10 }])`).
2. In the handler:
   - Create the post row (title, body from `req.body`, author from `req.auth.supabaseUser.id`).
   - For each `req.files` (or `req.files.photos`): call `uploadFile({ buffer, filename, mimeType, uploadedBy })` then update the created upload row with `entity_type: 'post'`, `entity_id: post.id` (or insert into a join table).
   - Return the post plus an `attachments` array (upload ids and metadata).

**Option 2 – Post first, then attach**

1. `POST /posts` with JSON body → returns `{ id, title, body, ... }`.
2. Client calls `POST /uploads` once per file (multipart), with query or body `entity_type=post&entity_id=<post_id>`.
3. Server upload handler: after inserting into `uploads`, set `entity_type` and `entity_id` from the request (if you added those columns and accept them in the upload endpoint).

### 3.2 Read: post with attachments

- In your **get post by id** handler (or in a shared “serialize post” helper):
  1. Load the post.
  2. Query uploads: `WHERE entity_type = 'post' AND entity_id = post.id` (or join via `post_attachments`).
  3. For each upload, optionally add a `signedUrl` (e.g. call `getSignedUrl(upload.objectKey)`) if the bucket is private.
  4. Attach the list to the response, e.g. `post.attachments = uploadsList`.

### 3.3 Update: add or remove attachments

- **Add:** Same as create—either accept more files in a multipart `PATCH /posts/:id` and call `uploadFile` then set `entity_type`/`entity_id`, or have the client call `POST /uploads` with `entity_id=postId`.
- **Remove:** Accept `attachmentIdsToRemove: string[]` in the body. For each id:
  - Optionally check that the upload’s `entity_id` matches the post (so users can’t unlink others’ uploads).
  - Either delete the upload (call `deleteUpload(id)`) or set `entity_type`/`entity_id` to `NULL` so the file stays in Storage but is no longer attached to the post.

### 3.4 Delete: post and its attachments

- When deleting a post:
  - **Cascade delete:** Delete all uploads where `entity_type = 'post'` and `entity_id = post.id` (use `deleteUpload` so Storage is cleaned up too), then delete the post.
  - **Orphan:** Set `entity_type` and `entity_id` to `NULL` for those uploads, then delete the post (files remain in Storage and in `uploads` for possible reuse or cleanup jobs).

---

## 4. Reuse pattern for other resources

The same approach works for any resource that “has” attachments:

1. **Schema:** Add a link from uploads to the resource (polymorphic columns, resource-specific FK, or join table).
2. **Create:** When creating the resource, create uploads (via `uploadFile`) and set the link (entity_type/entity_id or join row).
3. **Read:** When returning the resource, query uploads by that link and add an `attachments` (or `photos`, `documents`) array; add `signedUrl` if needed.
4. **Update:** Support adding new files and/or removing specific attachment ids.
5. **Delete:** Decide whether to delete linked uploads or orphan them, and implement accordingly.

This keeps the existing upload service and Storage as the single place for file storage while letting any CRUD endpoint maintain and expose its own attachments.
