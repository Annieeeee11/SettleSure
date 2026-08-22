/**
 * Sweep near-duplicate decoy amount/date offsets on seed 42 (skip-llm).
 * Writes output/decoy-sweep.md. Defaults (1.2%, +2d, true +3d) must stay byte-identical.
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
const TRUE_DATE_OFFSETS = [3, 4, 5];

function pct(n: number): string {
  return `${(n * 100).toFixed(2)}%`;
}

async function runCell(opts: {
  decoyAmountDeltaPct?: number;
  decoyDateOffsetDays?: number;
  trueDateOffsetDays?: number;
}) {
  const dataset = generateDataset(42, opts);
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
    deferral: deferred,
    fp: pct(metrics.falsePositiveRate),
    precision: pct(metrics.precision),
    recall: pct(metrics.recall),
  };
}

async function main() {
  const decoyRows = [];
  for (const amount of AMOUNT_DELTAS) {
    for (const days of DATE_OFFSETS) {
      const m = await runCell({
        decoyAmountDeltaPct: amount,
        decoyDateOffsetDays: days,
      });
      decoyRows.push({ decoyAmountDeltaPct: amount, decoyDateOffsetDays: days, ...m });
    }
  }

  const trueDateRows = [];
  for (const trueDateOffsetDays of TRUE_DATE_OFFSETS) {
    const m = await runCell({ trueDateOffsetDays });
    trueDateRows.push({ trueDateOffsetDays, ...m });
  }

  const lines = [
    "# Near-duplicate decoy offset sweep",
    "",
    "Seed **42**, `--skip-llm`. Varies decoy amount delta and date offset;",
    "true settlement defaults to **+3d**. Default decoy cell is **±1.2% / +2d**.",
    "",
    "| Amount Δ | Date offset (d) | Decoy deferral | FP rate | Precision | Recall |",
    "| ---: | ---: | ---: | ---: | ---: | ---: |",
    ...decoyRows.map(
      (r) =>
        `| ±${(r.decoyAmountDeltaPct * 100).toFixed(1)}% | ${r.decoyDateOffsetDays} | ${r.deferral} | ${r.fp} | ${r.precision} | ${r.recall} |`,
    ),
    "",
    "### True-settlement date offset (default decoy ±1.2% / +2d)",
    "",
    "The 0.751 accept margin also rests on the true pair’s **+3d** date offset;",
    "+4d would put true pairs at ~0.676 → FN.",
    "",
    "| True date offset (d) | Decoy deferral | FP rate | Precision | Recall |",
    "| ---: | ---: | ---: | ---: | ---: |",
    ...trueDateRows.map(
      (r) =>
        `| ${r.trueDateOffsetDays} | ${r.deferral} | ${r.fp} | ${r.precision} | ${r.recall} |`,
    ),
    "",
    "Closer decoys clear the 0.75 threshold — with the LLM tier enabled they land",
    "in the ambiguous band for LLM/human review; skip-llm they score as FPs (see grid).",
    "The ±0.5%/+1d cell also drops recall to **93.48%** because the accepted decoy",
    "steals the bank credit from the true pair.",
    "",
  ];

  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, lines.join("\n"));
  console.log(`Wrote ${OUT}`);
  for (const r of decoyRows) {
    console.log(
      `±${(r.decoyAmountDeltaPct * 100).toFixed(1)}% +${r.decoyDateOffsetDays}d → deferral ${r.deferral} FP ${r.fp} P ${r.precision} R ${r.recall}`,
    );
  }
  for (const r of trueDateRows) {
    console.log(
      `true +${r.trueDateOffsetDays}d → deferral ${r.deferral} FP ${r.fp} P ${r.precision} R ${r.recall}`,
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
