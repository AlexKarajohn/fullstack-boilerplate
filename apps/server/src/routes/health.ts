import { Router } from "express";
import { Resend } from "resend";
import { sql } from "drizzle-orm";
import { db } from "../db";

const router = Router();

router.get("/health", async (_, res) => {
  const start = Date.now();
  console.log("[health] request started");
  let dbStatus: "ok" | "error" = "error";
  try {
    console.log("[health] querying DB...");
    await db.execute(sql`SELECT 1`);
    dbStatus = "ok";
    console.log("[health] DB ok in", Date.now() - start, "ms");
  } catch (err) {
    console.log("[health] DB error after", Date.now() - start, "ms:", err);
  }

  let emailStatus: "ok" | "error" | "skipped" = "skipped";
  const resendKey = process.env.RESEND_API_KEY;
  const healthTo = process.env.RESEND_HEALTH_TO;
  if (resendKey && healthTo) {
    try {
      console.log("[health] sending email...");
      const resend = new Resend(resendKey);
      await resend.emails.send({
        from: "onboarding@resend.dev",
        to: healthTo,
        subject: "Health check",
        html: "<p>Email health check!</p>",
      });
      emailStatus = "ok";
      console.log("[health] email ok in", Date.now() - start, "ms");
    } catch (err) {
      emailStatus = "error";
      console.log("[health] email error after", Date.now() - start, "ms:", err);
    }
  }

  const payload = {
    status: "ok",
    timestamp: new Date().toISOString(),
    db: dbStatus,
    email: emailStatus,
  };
  console.log("[health] sending response", payload);
  res.json(payload);
});

export const healthRouter = router;
