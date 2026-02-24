import type { User } from "@supabase/supabase-js";

export {};

declare global {
  namespace Express {
    interface Request {
      auth?: {
        supabaseUser: User;
      };
    }
  }
}
