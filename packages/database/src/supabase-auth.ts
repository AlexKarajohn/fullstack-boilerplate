import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Parse a Supabase API URL that has the key (password) inside it, e.g.:
 *   https://:SERVICE_ROLE_KEY@project-ref.supabase.co
 *   https://key:value@project-ref.supabase.co
 * For local Supabase (CLI), http is allowed for localhost / 127.0.0.1, e.g.:
 *   http://:SERVICE_ROLE_KEY@127.0.0.1:54321
 * Returns { baseUrl, key }. Same pattern as DB connection URL with password in it.
 */
export function parseSupabaseAuthUrl(envUrl: string): { baseUrl: string; key: string } {
  const u = new URL(envUrl);
  const isLocalhost =
    u.hostname === "localhost" || u.hostname === "127.0.0.1" || u.hostname === "::1";
  if (u.protocol !== "https:" && !(isLocalhost && u.protocol === "http:")) {
    throw new Error(
      'Supabase auth URL must be https (or http for localhost). Use SUPABASE_AUTH_URL with key in URL, e.g. "https://:KEY@project-ref.supabase.co" or "http://:KEY@127.0.0.1:54321".',
    );
  }
  const key = u.password || u.username;
  if (!key) {
    throw new Error(
      "Supabase auth URL must include the API key in the URL, e.g. https://:YOUR_KEY@project-ref.supabase.co"
    );
  }
  const baseUrl = `${u.protocol}//${u.hostname}${u.port ? ":" + u.port : ""}`;
  return { baseUrl, key };
}

/**
 * Supabase client for auth (signUp, signIn, getUser).
 * Pass the API URL with key in it (e.g. https://:KEY@project-ref.supabase.co).
 */
export function getSupabaseAuthClient(authUrl: string): SupabaseClient {
  const { baseUrl, key } = parseSupabaseAuthUrl(authUrl);
  return createClient(baseUrl, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
