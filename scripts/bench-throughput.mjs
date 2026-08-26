#!/usr/bin/env node
/**
 * Side-by-side TS-oracle vs Rust deterministic-pass throughput benchmark.
 *
 * Prerequisites:
 *   - TS oracle worktree at ../settlesure-ts-oracle (e44ec9d), npm install done
 *   - Fixtures under benchmarks/fixtures/scale-{N}x/ (or --data-dir)
 *
 * Usage:
 *   node scripts/bench-throughput.mjs [--runs 5] [--scales 1,10,50]
 */
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const TS_ORACLE = resolve(ROOT, "../settlesure-ts-oracle");

function parseArgs() {
  let runs = 5;
  let scales = [1, 10, 50];
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--runs") runs = Number(argv[++i]);
    else if (argv[i] === "--scales") {
      scales = argv[++i].split(",").map((s) => Number(s.trim()));
    } else if (argv[i] === "--data-dir") {
      scales = [0];
      scales._singleDir = resolve(argv[++i]);
    }
  }
  return { runs, scales };
}

function stats(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const sum = sorted.reduce((a, b) => a + b, 0);
  return {
    min: Number(sorted[0].toFixed(3)),
    max: Number(sorted[sorted.length - 1].toFixed(3)),
    mean: Number((sum / sorted.length).toFixed(3)),
    values: sorted.map((v) => Number(v.toFixed(3))),
  };
}

function fixtureDir(scale) {
  return join(ROOT, "benchmarks", "fixtures", `scale-${scale}x`);
}

function syncFixtures(dataDir) {
  const tsData = join(TS_ORACLE, "data");
  mkdirSync(tsData, { recursive: true });
  for (const f of [
    "payments.json",
    "settlements.json",
    "bank_credits.json",
    "ground_truth.json",
  ]) {
    copyFileSync(join(dataDir, f), join(tsData, f));
  }
}

function cargoTargetDir() {
  const meta = JSON.parse(
    execFileSync("cargo", ["metadata", "--format-version", "1"], {
      cwd: ROOT,
      encoding: "utf8",
    }),
  );
  return meta.target_directory;
}

function ensureRustBenchBin() {
  execFileSync(
    "cargo",
    [
      "build",
      "--release",
      "-q",
      "-p",
      "settlesure-cli",
      "--example",
      "bench_deterministic",
    ],
    { cwd: ROOT, stdio: "inherit" },
  );
  return join(cargoTargetDir(), "release/examples/bench_deterministic");
}

let rustBin = null;

function runRustOnce(dataDir) {
  if (!rustBin) rustBin = ensureRustBenchBin();
  const out = execFileSync(rustBin, [dataDir], { encoding: "utf8" }).trim();
  return JSON.parse(out);
}

function runTsOnce() {
  const script = join(TS_ORACLE, "scripts/bench-deterministic.ts");
  const out = execFileSync("npx", ["tsx", script, join(TS_ORACLE, "data")], {
    cwd: TS_ORACLE,
    encoding: "utf8",
  }).trim();
  return JSON.parse(out);
}

function runEngine(engine, dataDir, runs) {
  const samples = [];
  for (let i = 0; i < runs; i++) {
    samples.push(
      engine === "rust" ? runRustOnce(dataDir) : runTsOnce(),
    );
  }
  return samples;
}

function checkParity(rustSample, tsSample, scale) {
  if (
    rustSample.matchCount !== tsSample.matchCount ||
    rustSample.exceptionCount !== tsSample.exceptionCount
  ) {
    throw new Error(
      `Parity failed at scale ${scale}x: Rust ${rustSample.matchCount}/${rustSample.exceptionCount} vs TS ${tsSample.matchCount}/${tsSample.exceptionCount}`,
    );
  }
}

function summarize(label, samples) {
  const det = stats(samples.map((s) => s.deterministicMs));
  const first = samples[0];
  const msPerBank = det.mean / first.bankCredits;
  return {
    label,
    mode: first.mode,
    counts: {
      payments: first.payments,
      settlements: first.settlements,
      bankCredits: first.bankCredits,
    },
    matchCount: first.matchCount,
    exceptionCount: first.exceptionCount,
    deterministicMs: det,
    msPerBankCredit: Number(msPerBank.toFixed(4)),
    exactMs: stats(samples.map((s) => s.exactMs)),
    fuzzyMs: stats(samples.map((s) => s.fuzzyMs)),
    splitMs: stats(samples.map((s) => s.splitMs)),
  };
}

function generateFixture(scale) {
  const dir = fixtureDir(scale);
  mkdirSync(dir, { recursive: true });
  execFileSync(
    "cargo",
    [
      "run",
      "--release",
      "-q",
      "-p",
      "settlesure-cli",
      "--",
      "--seed",
      "42",
      "--generate-only",
      "--batch-scale",
      String(scale),
      "--output-data-dir",
      dir,
      "--no-banner",
    ],
    { cwd: ROOT, stdio: "inherit" },
  );
  return dir;
}

const { runs, scales: scalesArg } = parseArgs();
const scales = scalesArg._singleDir
  ? [{ scale: "custom", dir: scalesArg._singleDir }]
  : scalesArg.map((scale) => ({ scale, dir: null }));

if (!existsSync(TS_ORACLE)) {
  console.error(`TS oracle worktree not found at ${TS_ORACLE}`);
  process.exit(1);
}

const scaleResults = [];

for (const { scale, dir: customDir } of scales) {
  const dataDir =
    customDir ?? (existsSync(fixtureDir(scale)) ? fixtureDir(scale) : generateFixture(scale));

  if (!customDir && scale !== "custom" && !existsSync(join(dataDir, "payments.json"))) {
    generateFixture(scale);
  }

  console.error(`Scale ${scale}x — syncing fixtures from ${dataDir}...`);
  syncFixtures(dataDir);

  console.error(`Scale ${scale}x — parity check...`);
  const rustParity = runRustOnce(dataDir);
  const tsParity = runTsOnce();
  checkParity(rustParity, tsParity, scale);

  console.error(`Scale ${scale}x — running ${runs} timed iterations each...`);
  const rustSamples = runEngine("rust", dataDir, runs);
  const tsSamples = runEngine("ts", dataDir, runs);

  const rust = summarize("rust", rustSamples);
  const ts = summarize("typescript", tsSamples);
  const speedup = ts.deterministicMs.mean / rust.deterministicMs.mean;

  scaleResults.push({
    scale: scale === "custom" ? "custom" : `${scale}x`,
    fixture: dataDir,
    parity: {
      matchCount: rust.matchCount,
      exceptionCount: rust.exceptionCount,
    },
    typescript: ts,
    rust,
    speedupMean: Number(speedup.toFixed(2)),
  });
}

const report = {
  runs,
  note: "Timed region = exactMs + fuzzyMs + splitMs from engine instrumentation. Excludes data generation, report I/O, integrity setup, and LLM.",
  caveat:
    "Each timed run is a fresh subprocess (Node/tsx for TS; release binary for Rust). Rust build cost excluded. TS has no separate release mode.",
  scales: scaleResults,
};

console.log(JSON.stringify(report, null, 2));
