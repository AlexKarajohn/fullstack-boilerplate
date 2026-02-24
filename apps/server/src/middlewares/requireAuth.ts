import { Request, Response, NextFunction } from "express";
import { getSupabaseAuthClient } from "../db";

/**
 * Optional auth: sets req.auth.supabaseUser when a valid Bearer token is present; otherwise continues without 401.
 * Use for routes that behave differently when logged in (e.g. ?mine=1).
 */
export async function optionalAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void | Response> {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) {
    next();
    return;
  }
  try {
    const supabase = getSupabaseAuthClient();
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (!userError && userData.user) {
      req.auth = { supabaseUser: userData.user };
    }
  } catch {
    // ignore auth errors for optional auth
  }
  next();
}

/**
 * Skeleton auth middleware: validates Bearer token with Supabase and sets req.auth.supabaseUser.
 * When you add app-user/role tables, extend this to load appUser, allowedTeamIds, etc. and attach to req.auth.
 */
export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void | Response> {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) {
    return res.status(401).json({ error: "Missing Authorization: Bearer <token>" });
  }

  try {
    const supabase = getSupabaseAuthClient();
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData.user) {
      return res.status(401).json({ error: userError?.message ?? "Invalid token" });
    }

    req.auth = {
      supabaseUser: userData.user,
    };
    next();
  } catch (e) {
    return res
      .status(500)
      .json({ error: e instanceof Error ? e.message : "Auth failed" });
  }
}
