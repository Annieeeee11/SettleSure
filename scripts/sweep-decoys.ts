/**
 * Sweep near-duplicate decoy amount/date offsets on seed 42 (skip-llm).
 * Writes output/decoy-sweep.md. Defaults (1.2%, +2d) must stay byte-identical.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { generateDataset } from "../src/data/generate.js";
import { reconcile } from "../src/engine/reconcile.js";
import { scoreAgainstGroundTruth } from "../src/scoring/metrics.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "output", "decoy-sweep.md");

const AMOUNT_DELTAS = [0.005, 0.01, 0.012, 0.015, 0.02];
const DATE_OFFSETS = [1, 2, 3];

function pct(n: number): string {
  return `${(n * 100).toFixed(2)}%`;
}

async function cell(
  decoyAmountDeltaPct: number,
  decoyDateOffsetDays: number,
) {
  const dataset = generateDataset(42, {
    decoyAmountDeltaPct,
    decoyDateOffsetDays,
  });
  const result = await reconcile(
    dataset.payments,
    dataset.settlements,
    dataset.bankCredits,
    { skipLlm: true, seed: 42 },
  );
  const metrics = scoreAgainstGroundTruth(
    result,
    dataset.groundTruth,
    42,
    false,
    "none",
  );
  const decoy = metrics.byAmbiguityLevel.decoy;
  const deferred =
    decoy.deferredTotal && decoy.deferredTotal > 0
      ? `${decoy.correctlyDeferred}/${decoy.deferredTotal}`
      : "n/a";
  return {
    decoyAmountDeltaPct,
    decoyDateOffsetDays,
    deferral: deferred,
    fp: pct(metrics.falsePositiveRate),
    precision: pct(metrics.precision),
    recall: pct(metrics.recall),
  };
}

async function main() {
  const rows = [];
  for (const amount of AMOUNT_DELTAS) {
    for (const days of DATE_OFFSETS) {
      rows.push(await cell(amount, days));
    }
  }

  const lines = [
    "# Near-duplicate decoy offset sweep",
    "",
    "Seed **42**, `--skip-llm`. Varies only decoy amount delta and date offset;",
    "true settlement stays **+3d**. Default cell is **±1.2% / +2d**.",
    "",
    "| Amount Δ | Date offset (d) | Decoy deferral | FP rate | Precision | Recall |",
    "| ---: | ---: | ---: | ---: | ---: | ---: |",
    ...rows.map(
      (r) =>
        `| ±${(r.decoyAmountDeltaPct * 100).toFixed(1)}% | ${r.decoyDateOffsetDays} | ${r.deferral} | ${r.fp} | ${r.precision} | ${r.recall} |`,
    ),
    "",
    "Closer decoys (e.g. ±0.5% or +1d) can clear the 0.75 fuzzy accept threshold",
    "and escalate to LLM/human — that is the intended path, not a silent failure.",
    "",
  ];

  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, lines.join("\n"));
  console.log(`Wrote ${OUT}`);
  for (const r of rows) {
    console.log(
      `±${(r.decoyAmountDeltaPct * 100).toFixed(1)}% +${r.decoyDateOffsetDays}d → deferral ${r.deferral} FP ${r.fp} P ${r.precision} R ${r.recall}`,
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
