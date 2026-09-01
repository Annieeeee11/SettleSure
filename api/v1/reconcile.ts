import type { VercelRequest, VercelResponse } from "@vercel/node";

const BACKEND =
  process.env.SETTLESURE_API_URL ?? "http://localhost:3000";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const url = `${BACKEND}/api/v1/reconcile`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (process.env.API_KEY) {
    headers["X-API-Key"] = process.env.API_KEY;
  }
  if (req.headers["idempotency-key"]) {
    headers["Idempotency-Key"] = String(req.headers["idempotency-key"]);
  }

  const upstream = await fetch(url, {
    method: "POST",
    headers,
    body: typeof req.body === "string" ? req.body : JSON.stringify(req.body),
  });

  const text = await upstream.text();
  res.status(upstream.status).setHeader("Content-Type", "application/json");
  res.send(text);
}
