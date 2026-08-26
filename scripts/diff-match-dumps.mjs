#!/usr/bin/env node
/**
 * Diff NDJSON match dumps from TS oracle vs Rust CLI.
 * Usage: node scripts/diff-match-dumps.mjs [oracle.ndjson] [rust.ndjson]
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const oraclePath = process.argv[2] ?? join(root, "output/oracle_matches.ndjson");
const rustPath = process.argv[3] ?? join(root, "output/rust_matches.ndjson");
const dataDir = join(root, "data");
const outPath = join(root, "output/match-divergence-report.md");

function loadNdjson(path) {
  const text = readFileSync(path, "utf8").trim();
  if (!text) return [];
  return text.split("\n").map((line) => JSON.parse(line));
}

function tripleKey(row) {
  return `${row.payment_id}|${row.settlement_id}|${row.bank_credit_id}`;
}

function loadFixtures() {
  const settlements = JSON.parse(
    readFileSync(join(dataDir, "settlements.json"), "utf8"),
  );
  const bankCredits = JSON.parse(
    readFileSync(join(dataDir, "bank_credits.json"), "utf8"),
  );
  const groundTruth = JSON.parse(
    readFileSync(join(dataDir, "ground_truth.json"), "utf8"),
  );
  const bySetl = new Map(settlements.map((s) => [s.settlementId, s]));
  const byBank = new Map(bankCredits.map((b) => [b.id, b]));
  return { bySetl, byBank, groundTruth };
}

function sortedSetKey(ids) {
  return [...ids].sort().join(",");
}

function gtForTriple(row, groundTruth) {
  const { payment_id, settlement_id, bank_credit_id } = row;
  const matches = groundTruth.filter(
    (g) =>
      g.label === "match" &&
      g.bankCreditId === bank_credit_id &&
      (g.settlementId === settlement_id ||
        g.settlementIds?.includes(settlement_id)),
  );
  const batch = groundTruth.find(
    (g) =>
      g.label === "match" &&
      g.bankCreditId === bank_credit_id &&
      g.settlementIds?.length > 1 &&
      g.settlementIds.includes(settlement_id),
  );
  const single = groundTruth.find(
    (g) =>
      g.label === "match" &&
      g.bankCreditId === bank_credit_id &&
      g.settlementId === settlement_id,
  );
  const hit = batch ?? single ?? matches[0];
  if (!hit) {
    const exc = groundTruth.find(
      (g) =>
        g.label === "exception" &&
        (g.bankCreditId === bank_credit_id ||
          g.settlementId === settlement_id),
    );
    return exc
      ? {
          gt_label: "exception",
          gt_class: exc.class ?? exc.exceptionType,
          gt_ambiguity: exc.ambiguityLevel,
        }
      : { gt_label: "unknown", gt_class: null, gt_ambiguity: null };
  }
  return {
    gt_label: "match",
    gt_class: hit.class ?? hit.exceptionType,
    gt_ambiguity: hit.ambiguityLevel,
    gt_settlement_ids: hit.settlementIds,
  };
}

function fieldSnapshot(row, fixtures) {
  const setl = fixtures.bySetl.get(row.settlement_id);
  const bank = fixtures.byBank.get(row.bank_credit_id);
  return {
    bank_utr: bank?.utr,
    bank_amount: bank?.creditedAmount,
    bank_date: bank?.creditedAt,
    bank_currency: bank?.currency,
    setl_utr: setl?.utr,
    setl_net: setl?.netAmount,
    setl_date: setl?.settledAt,
    setl_currency: setl?.currency,
  };
}

function diffPair(oracleRows, rustRows, labelA, labelB, fixtures) {
  const mapA = new Map(oracleRows.map((r) => [tripleKey(r), r]));
  const mapB = new Map(rustRows.map((r) => [tripleKey(r), r]));
  const allKeys = new Set([...mapA.keys(), ...mapB.keys()]);

  let onlyA = 0;
  let onlyB = 0;
  let sameSource = 0;
  let diffSource = 0;
  const divergences = [];

  for (const key of [...allKeys].sort()) {
    const a = mapA.get(key);
    const b = mapB.get(key);
    if (a && !b) {
      onlyA++;
      divergences.push({ kind: `only_${labelA}`, row: a, oracle: a, rust: null });
    } else if (!a && b) {
      onlyB++;
      divergences.push({ kind: `only_${labelB}`, row: b, oracle: null, rust: b });
    } else if (a.match_source === b.match_source) {
      sameSource++;
    } else {
      diffSource++;
      divergences.push({
        kind: "source_mismatch",
        row: a,
        oracle: a,
        rust: b,
      });
    }
  }

  const byPass = {};
  for (const d of divergences) {
    const o = d.oracle?.match_source ?? "—";
    const r = d.rust?.match_source ?? "—";
    const bucket = `${o}→${r}`;
    byPass[bucket] = (byPass[bucket] ?? 0) + 1;
  }

  return { onlyA, onlyB, sameSource, diffSource, divergences, byPass, total: allKeys.size };
}

function formatReport(title, result, fixtures, labelA, labelB) {
  const lines = [];
  lines.push(`## ${title}`);
  lines.push("");
  lines.push(`| Metric | Count |`);
  lines.push(`| --- | ---: |`);
  lines.push(`| Total unique triples | ${result.total} |`);
  lines.push(`| In both, same match_source | ${result.sameSource} |`);
  lines.push(`| In both, different match_source | ${result.diffSource} |`);
  lines.push(`| Only in ${labelA} | ${result.onlyA} |`);
  lines.push(`| Only in ${labelB} | ${result.onlyB} |`);
  lines.push("");

  if (Object.keys(result.byPass).length) {
    lines.push("### Divergence by pass transition");
    lines.push("");
    lines.push("| Transition | Count |");
    lines.push("| --- | ---: |");
    for (const [k, v] of Object.entries(result.byPass).sort()) {
      lines.push(`| ${k} | ${v} |`);
    }
    lines.push("");
  }

  if (result.divergences.length === 0) {
    lines.push("_No divergences._");
    lines.push("");
    return lines.join("\n");
  }

  lines.push("### Full divergence table");
  lines.push("");
  lines.push(
    "| Kind | payment | settlement | bank | oracle_src | rust_src | GT | class | amb | bank_utr | setl_utr | bank_amt | setl_net | bank_date | setl_date |",
  );
  lines.push("| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |");

  for (const d of result.divergences) {
    const row = d.oracle ?? d.rust;
    const gt = gtForTriple(row, fixtures.groundTruth);
    const snap = fieldSnapshot(row, fixtures);
    lines.push(
      `| ${d.kind} | ${row.payment_id} | ${row.settlement_id} | ${row.bank_credit_id} | ${d.oracle?.match_source ?? "—"} | ${d.rust?.match_source ?? "—"} | ${gt.gt_label} | ${gt.gt_class ?? "—"} | ${gt.gt_ambiguity ?? "—"} | ${snap.bank_utr} | ${snap.setl_utr} | ${snap.bank_amount} | ${snap.setl_net} | ${snap.bank_date} | ${snap.setl_date} |`,
    );
  }
  lines.push("");
  return lines.join("\n");
}

function main() {
  const oracle = loadNdjson(oraclePath);
  const rust = loadNdjson(rustPath);
  const fixtures = loadFixtures();

  const primary = diffPair(oracle, rust, "oracle", "rust", fixtures);

  const oldPath = join(root, "output/oracle_old_matches.ndjson");
  let secondary = null;
  try {
    const old = loadNdjson(oldPath);
    secondary = diffPair(old, rust, "oracle_old", "rust", fixtures);
  } catch {
    // optional
  }

  const md = [
    "# Seed-42 match-list divergence report",
    "",
    `Generated: ${new Date().toISOString()}`,
    "",
    formatReport("Primary: HEAD TS oracle vs Rust", primary, fixtures, "oracle", "rust"),
  ];

  if (secondary) {
    md.push(
      formatReport(
        "Secondary: historical TS oracle (1b4a43c) vs Rust",
        secondary,
        fixtures,
        "oracle_old",
        "rust",
      ),
    );
  }

  const report = md.join("\n");
  writeFileSync(outPath, report + "\n");
  console.log(report);
  console.log(`\nWrote ${outPath}`);
}

main();
