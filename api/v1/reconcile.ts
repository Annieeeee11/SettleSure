import type { VercelRequest, VercelResponse } from "@vercel/node";

const BACKEND = process.env.SETTLESURE_API_URL ?? "http://localhost:3000";
const TIMEOUT_MS = 65_000;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "method not allowed" });
  }
  if (!process.env.API_KEY) {
    return res.status(503).json({ error: "API proxy is not configured" });
  }

  const url = `${BACKEND}/api/v1/reconcile`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-API-Key": process.env.API_KEY,
  };
  if (req.headers["idempotency-key"]) {
    headers["Idempotency-Key"] = String(req.headers["idempotency-key"]);
  }

  try {
    const upstream = await fetch(url, {
      method: "POST",
      headers,
      body: typeof req.body === "string" ? req.body : JSON.stringify(req.body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    const text = await upstream.text();
    res
      .status(upstream.status)
      .setHeader(
        "Content-Type",
        upstream.headers.get("content-type") ?? "application/json",
      )
      .setHeader("Cache-Control", "no-store")
      .send(text);
  } catch (error) {
    const timedOut =
      error instanceof DOMException && error.name === "TimeoutError";
    res.status(timedOut ? 504 : 502).json({
      error: timedOut
        ? "SettleSure API timed out while waking up"
        : "SettleSure API is temporarily unavailable",
    });
  }
}
