# File uploads — reference implementation

The repo does **not** mount any upload endpoints. Reference code for implementing a Supabase Storage–backed uploads API lives in a single Markdown file for LLMs and developers to copy or adapt:

- **`apps/server/src/services/uploads-reference.md`** — full route and service code in fenced blocks, plus how to enable and where DB/Bruno references live.

See that file for the implementation. DB schema (`uploads` table, enums), Zod schema, and Bruno request remain in `packages/database` and `packages/bruno` as reference.
