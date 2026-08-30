#!/usr/bin/env node
/**
 * Regenerate seed-42 baseline (--skip-llm) and copy output/report.json
 * to dashboard/public/report.json so committed dashboard artifacts stay in sync.
 */
import { copyFileSync, existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const reportPath = join(root, "output/report.json");
const publicReportPath = join(root, "dashboard/public/report.json");

console.log("Running seed-42 baseline reconcile (--skip-llm)...");
const run = spawnSync(
  "cargo",
  ["run", "-p", "settlesure-cli", "--", "--seed", "42", "--skip-llm", "--no-banner"],
  { cwd: root, stdio: "inherit" },
);

if (run.status !== 0) {
  console.error("Reconcile failed.");
  process.exit(run.status ?? 1);
}

if (!existsSync(reportPath)) {
  console.error(`Missing ${reportPath}`);
  process.exit(1);
}

copyFileSync(reportPath, publicReportPath);
console.log(`Copied → dashboard/public/report.json`);

const m = JSON.parse(readFileSync(reportPath, "utf8")).metrics;
const src = m.matchSourceBreakdown ?? {};
console.log(
  `Headline: precision=${(m.precision * 100).toFixed(2)}% recall=${(m.recall * 100).toFixed(2)}% FP=${(m.falsePositiveRate * 100).toFixed(2)}%`,
);
console.log(
  `Match sources: exact=${src.exact ?? 0} fuzzy=${src.fuzzy ?? 0} split=${src.split ?? 0} llm=${src.llm ?? 0} human=${src.human ?? 0}`,
);

const check = spawnSync("node", ["scripts/check-baseline.mjs"], {
  cwd: root,
  stdio: "inherit",
});
process.exit(check.status ?? 0);
