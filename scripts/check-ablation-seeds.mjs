#!/usr/bin/env node
/**
 * Soft gate for multi-seed LLM ablation — logs mean/min recall lift; warns if lift is zero.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const reportPath = join(root, "output/report.json");

let report;
try {
  report = JSON.parse(readFileSync(reportPath, "utf8"));
} catch {
  console.warn("check-ablation-seeds: no output/report.json — skip");
  process.exit(0);
}

const robust = report.metrics?.llmAblationRobustness;
if (!robust) {
  console.warn("check-ablation-seeds: no llmAblationRobustness in report — skip");
  process.exit(0);
}

const lift = robust.recallLift;
console.log(
  `LLM recall lift across seeds: mean=${(lift.mean * 100).toFixed(2)}% min=${(lift.min * 100).toFixed(2)}% max=${(lift.max * 100).toFixed(2)}%`,
);
if (lift.max <= 0) {
  console.warn("WARN: zero recall lift on all seeds — model may not help on this batch");
}
console.log("check-ablation-seeds: ok (informational)");
