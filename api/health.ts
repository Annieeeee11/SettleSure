import type { VercelRequest, VercelResponse } from "@vercel/node";

const BACKEND = process.env.SETTLESURE_API_URL ?? "http://localhost:3000";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "method not allowed" });
  }

  try {
    const upstream = await fetch(`${BACKEND}/api/health`, {
      signal: AbortSignal.timeout(65_000),
    });
    const text = await upstream.text();
    res
      .status(upstream.status)
      .setHeader("Content-Type", "application/json")
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
