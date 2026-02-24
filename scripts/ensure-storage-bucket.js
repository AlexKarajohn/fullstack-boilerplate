/**
 * Creates the Storage bucket used by the app (default: uploads) if it doesn't exist.
 * Run after supabase start + sync-env-local so uploads work locally.
 * Usage: node scripts/ensure-storage-bucket.js
 */
const fs = require("fs");
const path = require("path");

const repoRoot = path.join(__dirname, "..");
const envPath = path.join(repoRoot, ".env.local");

function loadEnv() {
  const content = fs.readFileSync(envPath, "utf8");
  const env = {};
  for (const line of content.split("\n")) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m) env[m[1]] = m[2].trim();
  }
  return env;
}

function parseAuthUrl(urlStr) {
  const u = new URL(urlStr);
  const key = u.password || u.username;
  const baseUrl = `${u.protocol}//${u.hostname}${u.port ? ":" + u.port : ""}`;
  return { baseUrl, key };
}

(async () => {
  try {
    const env = loadEnv();
    const bucket = env.SUPABASE_STORAGE_BUCKET || "uploads";
    const authUrl = env.SUPABASE_AUTH_URL || env.SUPABASE_URL;
    if (!authUrl) {
      console.error("SUPABASE_AUTH_URL or SUPABASE_URL not set in .env.local. Run npm run supabase:sync-env after supabase start.");
      process.exit(1);
    }
    const { baseUrl, key } = parseAuthUrl(authUrl);
    const url = `${baseUrl}/storage/v1/bucket`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: bucket, public: false }),
    });
    if (res.ok) {
      console.log("Bucket '%s' created.", bucket);
      process.exit(0);
    }
    const text = await res.text();
    if (res.status === 409 || text.includes("already exists") || text.includes("duplicate")) {
      console.log("Bucket '%s' already exists.", bucket);
      process.exit(0);
    }
    console.error("Failed to create bucket:", res.status, text);
    process.exit(1);
  } catch (e) {
    console.error("Error:", e.message);
    if (e.cause) console.error("Cause:", e.cause.message);
    process.exit(1);
  }
})();
