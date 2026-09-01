import type { VercelRequest, VercelResponse } from "@vercel/node";

const BACKEND =
  process.env.SETTLESURE_API_URL ?? "http://localhost:3000";

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  const upstream = await fetch(`${BACKEND}/api/health`);
  const text = await upstream.text();
  res.status(upstream.status).setHeader("Content-Type", "application/json");
  res.send(text);
}
