#!/usr/bin/env node
/**
 * Baseline gate checker — reads baselines/seed42.json and output/report.json.
 * Works for both TS and Rust report shapes (camelCase metrics).
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const baseline = JSON.parse(
  readFileSync(join(root, "baselines/seed42.json"), "utf8"),
);
const report = JSON.parse(
  readFileSync(join(root, "output/report.json"), "utf8"),
);
const groundTruth = JSON.parse(
  readFileSync(join(root, "data/ground_truth.json"), "utf8"),
);
const m = report.metrics;

const checks = [
  ["precision", m.precision, baseline.minPrecision, ">="],
  ["recall", m.recall, baseline.minRecall, ">="],
  ["matchRate", m.matchRate, baseline.minMatchRate, ">="],
  ["falsePositiveRate", m.falsePositiveRate, baseline.maxFalsePositiveRate, "<="],
];

let failed = false;
for (const [name, actual, bound, op] of checks) {
  const ok = op === ">=" ? actual >= bound : actual <= bound;
  const line = `${name}=${actual} ${op} ${bound} → ${ok ? "ok" : "FAIL"}`;
  console.log(line);
  if (!ok) failed = true;
}

// Batch sanity: hard ambiguity slices must exist in ground truth.
if (baseline.minGtAmbiguityCases) {
  const gtCounts = {};
  for (const g of groundTruth) {
    const k = g.ambiguityLevel;
    gtCounts[k] = (gtCounts[k] || 0) + 1;
  }
  for (const [level, min] of Object.entries(baseline.minGtAmbiguityCases)) {
    const actual = gtCounts[level] || 0;
    const ok = actual >= min;
    console.log(`gt.${level}=${actual} >= ${min} → ${ok ? "ok" : "FAIL"}`);
    if (!ok) failed = true;
  }
}

// Decoy deferral gate.
if (baseline.minDecoyDeferred != null) {
  const decoy = m.byAmbiguityLevel?.decoy;
  const deferred = decoy?.deferredTotal ?? 0;
  const ok = deferred >= baseline.minDecoyDeferred;
  console.log(`decoy.deferredTotal=${deferred} >= ${baseline.minDecoyDeferred} → ${ok ? "ok" : "FAIL"}`);
  if (!ok) failed = true;
}

// Perfect decoy deferral — no decoy may be auto-matched.
if (baseline.requireDecoyPerfectDeferral) {
  const decoy = m.byAmbiguityLevel?.decoy;
  const total = decoy?.deferredTotal ?? 0;
  const correct = decoy?.correctlyDeferred ?? 0;
  const ok = total === 0 || correct === total;
  console.log(
    `requireDecoyPerfectDeferral (${correct}/${total}) → ${ok ? "ok" : "FAIL"}`,
  );
  if (!ok) failed = true;
}

if (baseline.minExceptionAccuracySkipLlm != null) {
  const ok = m.exceptionAccuracy >= baseline.minExceptionAccuracySkipLlm;
  console.log(
    `exceptionAccuracy=${m.exceptionAccuracy} >= ${baseline.minExceptionAccuracySkipLlm} → ${ok ? "ok" : "FAIL"}`,
  );
  if (!ok) failed = true;
}

// Catch suspiciously perfect skip-llm runs with no tier usage.
if (baseline.forbidSuspiciousPerfect) {
  const src = m.matchSourceBreakdown || {};
  const perfect =
    m.precision === 1 &&
    m.recall === 1 &&
    m.falsePositiveRate === 0 &&
    (src.llm ?? 0) === 0 &&
    (src.human ?? 0) === 0;
  const ok = !perfect;
  console.log(
    `forbidSuspiciousPerfect (P=1 R=1 FP=0 llm=0 human=0) → ${ok ? "ok (not perfect)" : "FAIL"}`,
  );
  if (!ok) failed = true;
}

// Optional expected match-source breakdown (skip-llm seed 42).
if (baseline.expectedMatchSources) {
  const src = m.matchSourceBreakdown || {};
  for (const [key, expected] of Object.entries(baseline.expectedMatchSources)) {
    const actual = src[key] ?? 0;
    const ok = actual === expected;
    console.log(`matchSource.${key}=${actual} === ${expected} → ${ok ? "ok" : "FAIL"}`);
    if (!ok) failed = true;
  }
}

if (failed) {
  console.error("Baseline regression detected.");
  process.exit(1);
}
console.log("Baseline checks passed.");
