import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin } from "vite";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const correctionsPath = join(root, "output", "corrections.json");
const reportPath = join(root, "output", "report.json");
const publicReportPath = join(root, "dashboard", "public", "report.json");
const uploadDir = join(root, "data", "uploaded");

function readJsonBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (c: Buffer) => {
      raw += c.toString();
    });
    req.on("end", () => resolve(raw));
    req.on("error", reject);
  });
}

function correctionsPlugin(): Plugin {
  return {
    name: "corrections-api",
    configureServer(server) {
      server.middlewares.use(
        "/api/corrections",
        (req: IncomingMessage, res: ServerResponse, next: () => void) => {
          if (req.method === "GET") {
            mkdirSync(join(root, "output"), { recursive: true });
            const body = existsSync(correctionsPath)
              ? readFileSync(correctionsPath, "utf8")
              : "[]";
            res.setHeader("Content-Type", "application/json");
            res.end(body);
            return;
          }
          if (req.method === "POST") {
            void readJsonBody(req).then((raw) => {
              try {
                const entry = JSON.parse(raw) as Record<string, unknown>;
                mkdirSync(join(root, "output"), { recursive: true });
                const existing = existsSync(correctionsPath)
                  ? (JSON.parse(
                      readFileSync(correctionsPath, "utf8"),
                    ) as unknown[])
                  : [];
                existing.push({ ...entry, ts: new Date().toISOString() });
                writeFileSync(
                  correctionsPath,
                  JSON.stringify(existing, null, 2) + "\n",
                );
                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify({ ok: true, count: existing.length }));
              } catch (e) {
                res.statusCode = 400;
                res.end(JSON.stringify({ ok: false, error: String(e) }));
              }
            });
            return;
          }
          next();
        },
      );

      server.middlewares.use(
        "/api/ingest",
        (req: IncomingMessage, res: ServerResponse, next: () => void) => {
          if (req.method !== "POST") {
            next();
            return;
          }
          void readJsonBody(req).then((raw) => {
            try {
              const body = JSON.parse(raw) as {
                settlements?: string;
                bank?: string;
                payments?: string;
              };
              if (!body.settlements || !body.bank || !body.payments) {
                res.statusCode = 400;
                res.end(
                  JSON.stringify({
                    ok: false,
                    error: "settlements, bank, and payments file contents required",
                  }),
                );
                return;
              }
              mkdirSync(uploadDir, { recursive: true });
              const settlementPath = join(uploadDir, "settlements.csv");
              const bankPath = join(uploadDir, "bank.csv");
              const paymentsPath = join(uploadDir, "payments.csv");
              writeFileSync(settlementPath, body.settlements);
              writeFileSync(bankPath, body.bank);
              writeFileSync(paymentsPath, body.payments);

              const child = spawn(
                "cargo",
                [
                  "run",
                  "-q",
                  "-p",
                  "settlesure-cli",
                  "--",
                  "--settlement-file",
                  settlementPath,
                  "--bank-file",
                  bankPath,
                  "--payments-file",
                  paymentsPath,
                  "--skip-llm",
                ],
                { cwd: root, shell: true, stdio: "inherit" },
              );
              child.on("close", (code) => {
                if (code !== 0) {
                  res.statusCode = 500;
                  res.setHeader("Content-Type", "application/json");
                  res.end(
                    JSON.stringify({
                      ok: false,
                      error: `reconcile exited with code ${code}`,
                    }),
                  );
                  return;
                }
                try {
                  if (existsSync(reportPath)) {
                    mkdirSync(dirname(publicReportPath), { recursive: true });
                    copyFileSync(reportPath, publicReportPath);
                  }
                  res.setHeader("Content-Type", "application/json");
                  res.end(JSON.stringify({ ok: true }));
                } catch (e) {
                  res.statusCode = 500;
                  res.end(JSON.stringify({ ok: false, error: String(e) }));
                }
              });
            } catch (e) {
              res.statusCode = 400;
              res.end(JSON.stringify({ ok: false, error: String(e) }));
            }
          });
        },
      );

      server.middlewares.use(
        "/api/rerun",
        (req: IncomingMessage, res: ServerResponse, next: () => void) => {
          if (req.method !== "POST") {
            next();
            return;
          }
          const child = spawn(
            "cargo",
            [
              "run",
              "-q",
              "-p",
              "settlesure-cli",
              "--",
              "--seed",
              "42",
              "--skip-llm",
              "--apply-corrections",
            ],
            { cwd: root, shell: true, stdio: "inherit" },
          );
          child.on("close", (code) => {
            if (code !== 0) {
              res.statusCode = 500;
              res.setHeader("Content-Type", "application/json");
              res.end(
                JSON.stringify({
                  ok: false,
                  error: `reconcile exited with code ${code}`,
                }),
              );
              return;
            }
            try {
              if (existsSync(reportPath)) {
                mkdirSync(dirname(publicReportPath), { recursive: true });
                copyFileSync(reportPath, publicReportPath);
              }
              const report = JSON.parse(
                readFileSync(reportPath, "utf8"),
              ) as {
                metrics?: {
                  matchSourceBreakdown?: { human?: number };
                };
              };
              res.setHeader("Content-Type", "application/json");
              res.end(
                JSON.stringify({
                  ok: true,
                  human: report.metrics?.matchSourceBreakdown?.human ?? 0,
                }),
              );
            } catch (e) {
              res.statusCode = 500;
              res.end(JSON.stringify({ ok: false, error: String(e) }));
            }
          });
        },
      );
    },
  };
}

const dashboardRoot = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@": join(dashboardRoot, "src"),
    },
  },
  plugins: [react(), tailwindcss(), correctionsPlugin()],
  server: {
    port: 5173,
    proxy: {
      "/api/health": {
        target: process.env.SETTLESURE_API_URL ?? "http://127.0.0.1:3000",
        changeOrigin: true,
      },
      "/api/v1": {
        target: process.env.SETTLESURE_API_URL ?? "http://127.0.0.1:3000",
        changeOrigin: true,
        headers: process.env.API_KEY
          ? { "X-API-Key": process.env.API_KEY }
          : undefined,
      },
    },
  },
});
