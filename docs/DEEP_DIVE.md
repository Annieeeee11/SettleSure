# SettleSure — Complete Deep Dive

> **Purpose:** End-to-end, file-to-file, logic-to-logic guide to the SettleSure codebase.  
> Use this for interviews, onboarding, or understanding every moving part of the Razorpay-style settlement reconciliation engine.

---

## Table of Contents

1. [What Problem Does This Solve?](#1-what-problem-does-this-solve)
2. [High-Level Architecture](#2-high-level-architecture)
3. [The Three Data Legs](#3-the-three-data-legs)
4. [The Reconciliation Pipeline](#4-the-reconciliation-pipeline)
5. [Crate-by-Crate Breakdown](#5-crate-by-crate-breakdown)
6. [File-by-File Reference](#6-file-by-file-reference)
7. [Synthetic Data Generator](#7-synthetic-data-generator)
8. [Scoring & Metrics](#8-scoring--metrics)
9. [LLM Tier](#9-llm-tier)
10. [Human-in-the-Loop & Dashboard](#10-human-in-the-loop--dashboard)
11. [CLI & Scripts](#11-cli--scripts)
12. [CI, Baselines & Regression Guards](#12-ci-baselines--regression-guards)
13. [Docker & Deployment](#13-docker--deployment)
14. [Configuration Reference](#14-configuration-reference)
15. [Performance & Throughput](#15-performance--throughput)
16. [History & Engineering Judgment](#16-history--engineering-judgment)
17. [Interview Cheat Sheet](#17-interview-cheat-sheet)
18. [Quick Commands](#18-quick-commands)

---

## 1. What Problem Does This Solve?

Payment gateways like **Razorpay** sit between customers and merchants. When a customer pays:

1. A **payment** is captured at the gateway.
2. The gateway creates a **settlement** record: gross amount minus fees/taxes = net amount, tagged with a **UTR** (Unique Transaction Reference).
3. The merchant's bank eventually shows a **bank credit** — money actually arrived.

**Reconciliation** means: for every bank credit, find the settlement(s) it belongs to; for every settlement, confirm the money landed; flag anything that doesn't add up.

Real-world messiness this project models:

| Problem | How the engine handles it |
|---------|---------------------------|
| UTR truncated/mangled in bank feed | Fuzzy reference similarity + prefix floor |
| Date off by 1–3 days | Fuzzy date scoring within window |
| Amount off by small delta | Percentage + absolute tolerance |
| One bank credit = multiple settlements | Split / subset-sum matching |
| Near-duplicate decoy settlements | Escalate to LLM/human, never auto-match decoy |
| Duplicate UTR in bank feed | Dup-UTR gate before split |
| Fee/tax math wrong on settlement | Integrity pre-pass flags it |
| Currency mismatch | Never auto-resolved |

---

## 2. High-Level Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                         settlesure-cli                           │
│  (args, orchestration, multi-seed ablation, report I/O)          │
└────────┬──────────────┬──────────────┬──────────────┬────────────┘
         │              │              │              │
         ▼              ▼              ▼              ▼
┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│ settlesure- │  │ settlesure- │  │ settlesure- │  │ settlesure- │
│    data     │  │   engine    │  │     llm     │  │   scoring   │
│ (generate)  │  │  (match)    │  │ (resolve)   │  │  (metrics)  │
└──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘
       │                │                │                │
       └────────────────┴────────────────┴────────────────┘
                                │
                                ▼
                      ┌─────────────────┐
                      │ settlesure-types │
                      │ (domain structs) │
                      └─────────────────┘

         ┌─────────────────────────────────────┐
         │ dashboard/ (React + Vite)           │
         │ reads output/report.json            │
         │ human Accept/Reject → corrections   │
         └─────────────────────────────────────┘
```

### Design principles

1. **Engine has zero network code** — deterministic, fast, unit-testable.
2. **LLM is injected as a callback** — `reconcile(..., resolve_llm)` so engine and LLM crates don't circularly depend.
3. **Types are the single source of truth** — JSON wire format matches the original TypeScript version (`camelCase` serde).
4. **Adversarial generator with ground truth** — every synthetic row has a label so precision/recall are measurable.
5. **Honest metrics** — recall is intentionally <100% without LLM so fallback tiers are actually exercised.

---

## 3. The Three Data Legs

Defined in `crates/settlesure-types/src/lib.rs`.

### Payment

Gateway-side capture record.

```json
{
  "orderId": "order_0001",
  "paymentId": "pay_0001",
  "amount": 1050.0,
  "currency": "INR",
  "status": "captured",
  "createdAt": "2025-01-15"
}
```

Used in **integrity check** to validate settlement `grossAmount` and `currency`.

### Settlement

Gateway-side payout record after fee/tax deduction.

```json
{
  "settlementId": "setl_0001",
  "paymentId": "pay_0001",
  "grossAmount": 1050.0,
  "fee": 40.0,
  "tax": 10.0,
  "netAmount": 1000.0,
  "settledAt": "2025-01-15",
  "utr": "UTR000001ABCDEF",
  "currency": "INR"
}
```

**Identity constraint:** `netAmount ≈ grossAmount - fee - tax` (within ₹0.01).

### BankCredit

Merchant bank statement line.

```json
{
  "id": "bank_0001",
  "utr": "UTR000001ABCDEF",
  "creditedAmount": 1000.0,
  "creditedAt": "2025-01-15",
  "currency": "INR"
}
```

**Join key:** UTR + net/credited amount (+ date, currency).

### Ground truth

Each generated scenario gets a `GroundTruthLabel`:

```json
{
  "bankCreditId": "bank_0042",
  "settlementId": "setl_0042",
  "label": "match",
  "class": "date_shifted",
  "ambiguityLevel": "clear"
}
```

- `label`: `"match"` or `"exception"`
- `ambiguityLevel`: `clear` | `boundary` | `decoy` | `unresolvable`
- `class` / `exceptionType`: one of 18 `DiscrepancyClass` variants

---

## 4. The Reconciliation Pipeline

Orchestrated in `crates/settlesure-engine/src/reconcile.rs`.

```
Human corrections (if any)
        │
        ▼
┌───────────────────┐
│ Integrity check   │  payment ↔ settlement sanity
└─────────┬─────────┘
          ▼
┌───────────────────┐
│ Pass 1: Exact     │  UTR + amount + currency + date exact
└─────────┬─────────┘
          ▼
┌───────────────────┐
│ Pass 2: Fuzzy     │  scored similarity, greedy assignment
└─────────┬─────────┘
          ▼
┌───────────────────┐
│ Dup-UTR gate      │  block same-UTR leftovers from split
└─────────┬─────────┘
          ▼
┌───────────────────┐
│ Pass 3: Split     │  subset-sum batched payouts
└─────────┬─────────┘
          ▼
┌───────────────────┐
│ Pass 4: LLM       │  ambiguous bucket only
└─────────┬─────────┘
          ▼
┌───────────────────┐
│ Merge + leftovers │  unmatched → typed exceptions
└───────────────────┘
```

### 4.1 Human corrections (first)

Loaded from `output/corrections.json` or `data/demo_corrections.json`.

| Decision | Effect |
|----------|--------|
| **Accept** | Creates `MatchSource::Human` match; removes bank/settlement from pools |
| **Reject** | Adds permanent exception: `"permanently rejected by human correction"` |

Human matches run **before** all other passes so ops overrides take priority.

### 4.2 Integrity check

File: `crates/settlesure-engine/src/integrity.rs`

For each settlement:

1. `netAmount == round(gross - fee - tax)` → else `FeeTaxMismatch`, settlement flagged
2. `paymentId` must exist in payments
3. `grossAmount` must match payment `amount`
4. `currency` must match payment `currency`

Flagged settlements are **excluded from matching pools** but remain as exceptions.

### 4.3 Pass 1 — Exact match

File: `crates/settlesure-engine/src/exact.rs`

Greedy 1:1:

```
bank.utr == settlement.utr
&& bank.creditedAmount == settlement.netAmount
&& bank.currency == settlement.currency
&& bank.creditedAt == settlement.settledAt
```

- Confidence: `1.0`
- Source: `MatchSource::Exact`
- First bank in iteration order claims each settlement

### 4.4 Pass 2 — Fuzzy match

File: `crates/settlesure-engine/src/fuzzy.rs`

#### Pair scoring

For each (bank, settlement) candidate:

```
amountScore = 1 - (|bankAmt - netAmt| / tolerance)     // 0 if outside tol
dateScore   = 1 - (daysApart / (dateWindow + 1))     // 0 if outside 3-day window
refScore    = referenceSimilarity(bank.utr, settlement.utr)

totalScore  = 0.4 × amount + 0.3 × date + 0.3 × reference
```

**Tolerance:** `max(|amount| × 2%, ₹0.50)` — see `amount_tolerance()` in `config.rs`.

**Minimum reference similarity:** pairs below `0.65` are never considered.

#### Reference similarity

File: `crates/settlesure-engine/src/reference.rs`

1. **Normalize:** strip non-alphanumeric, uppercase (`UTR-001 a` → `UTR001A`)
2. **Levenshtein** distance → similarity ratio
3. **Prefix floor 0.92:** if shorter UTR (≥6 chars) is a prefix of longer, score ≥ 0.92

This models bank feeds that truncate UTRs to a prefix.

#### Decision bands

| Score range | Action |
|-------------|--------|
| ≥ `fuzzyAcceptThreshold` (0.75) | Auto-match → `MatchSource::Fuzzy` |
| `ambiguousLow` (0.5) ≤ score < 0.75 | **Ambiguous** → LLM bucket with top-3 rivals |
| < 0.5 | No match |
| Currency mismatch (same UTR/amount/date, diff currency) | Exception, never auto-resolved |

#### Greedy assignment

All candidates sorted by score **descending**. Highest wins; bank and settlement are claimed. Not globally optimal — by design for speed.

#### Bucketing optimization

Production path indexes settlements by `(currency, amountBucket, dateBucket)` and only compares neighboring buckets (±1). Same candidate set as brute force, fewer comparisons. Verified by `crates/settlesure-integration/tests/fuzzy_bucket_parity.rs`.

At 50× scale, fuzzy dominates runtime (~12.5s of ~13s total in Rust release).

### 4.5 Duplicate-UTR gate

**Between fuzzy and split** in `reconcile.rs`:

After exact + fuzzy matches, track which UTRs are already claimed. Any remaining bank credit whose UTR was already settled by another match:

- **Blocked from split matching**
- Flagged as `DuplicateBank` exception

This fixed a historical bug (commit `17c0c88`) where decoy subset-sums caused false split matches on duplicate UTR entries.

### 4.6 Pass 3 — Split match

File: `crates/settlesure-engine/src/split.rs`

Handles **batched payouts**: one bank credit = sum of 2–6 settlements.

**Algorithm:**

1. Filter settlements: same currency, within `splitDateWindowDays` (5 days)
2. If settlements have UTRs like `{bankUtr}_S1`, `{bankUtr}_S2` → use only those (linked batch)
3. Pool capped at `splitMaxPool` (25)
4. **DFS subset-sum:** find combos of size 2..`splitMaxCombo` (6) summing to `bank.creditedAmount` within tolerance
5. Outcomes:
   - **0 solutions** → stays unmatched
   - **1 solution** → `MatchSource::Split` with `components: [setl_1, setl_2, ...]`
   - **2+ solutions** → ambiguous → LLM bucket with `splitOptions`

**Bounds:** pool ≤25, combo ≤6 — demo-scale only (documented limitation).

### 4.7 Pass 4 — LLM resolve

Engine calls injected callback with all `AmbiguousCandidate` rows from fuzzy + split.

See [Section 9](#9-llm-tier) for full detail.

`merge_llm_matches()` ensures LLM cannot claim settlements already matched by earlier passes. Conflicts become exceptions.

### 4.8 Leftover exceptions

Unmatched **bank credits** classified by `reason_for_leftover_bank()`:

| Condition | Exception type | Reason |
|-----------|----------------|--------|
| Settlements exist with `{utr}_S` prefix | `BatchedPayout` | Batched payout — no unique subset-sum |
| No plausible counterpart in window | `UnresolvableNoise` | No counterpart in date/amount window |
| Otherwise | `UnclaimedBankCredit` | UTR in bank feed, no matching settlement |

Unmatched **settlements** → `SettlementPendingBank` (payout may be in transit).

All exceptions are deduplicated by `source:recordId` key. Fee/tax mismatch pairs get cross-linked `relatedIds`.

---

## 5. Crate-by-Crate Breakdown

### `settlesure-types`

**Role:** Shared domain types, config, money rounding. Zero business logic.

| Module | Contents |
|--------|----------|
| `lib.rs` | All structs/enums: Payment, Settlement, BankCredit, MatchResult, Exception, ScoreReport, etc. |
| `config.rs` | `ReconcileConfig`, `DEFAULT_CONFIG`, `amount_tolerance()` |
| `money.rs` | `round_money()` — matches JS `Math.round(n*100)/100` |
| `secret.rs` | `Secret<String>` — API keys don't leak in logs |

### `settlesure-data`

**Role:** Seeded synthetic dataset generator with ground truth.

| Module | Contents |
|--------|----------|
| `generate.rs` | 18 discrepancy classes, adversarial engineering, writes `data/*.json` |
| `rng.rs` | Mulberry32 PRNG — reproducible across runs for same seed |
| `lib.rs` | `generate_and_write_with_opts()`, `GeneratedDataset` |

Uses engine's `score_pair` and `reference_similarity` at generation time to validate adversarial cases land in the right score bands.

### `settlesure-engine`

**Role:** Core matching. Sync, no network, no LLM dependency.

| Module | Contents |
|--------|----------|
| `reconcile.rs` | Pipeline orchestration, merge, exception dedup |
| `exact.rs` | Pass 1 |
| `fuzzy.rs` | Pass 2 + bucketing |
| `split.rs` | Pass 3 + subset-sum DFS |
| `integrity.rs` | Pre-pass validation |
| `reference.rs` | UTR normalization + Levenshtein + prefix floor |
| `corrections.rs` | Load corrections, `suggest_fuzzy_threshold()` |

Public API: `reconcile()`, `reconcile_skip_llm()`, `load_corrections_with_fallback()`.

### `settlesure-llm`

**Role:** Async LLM providers for ambiguous bucket only.

| Module | Contents |
|--------|----------|
| `resolve.rs` | `llm_resolve()`, provider selection, call stats |
| `provider.rs` | `LlmProvider` trait, prompts, JSON parsing, retry |
| `ollama.rs` | Local Ollama (temperature 0, JSON schema format) |
| `anthropic.rs` | Claude API |
| `openai_compat.rs` | OpenAI / Groq / OpenRouter |
| `cache.rs` | Disk verdict cache (`output/llm-cache.json`) |
| `client.rs` | HTTP timeouts (120s), retry constants |

Does **not** depend on `settlesure-engine` — avoids circular deps. CLI maps `LlmResolveResult` → `LlmPassResult` at the boundary.

### `settlesure-scoring`

**Role:** Compare engine output to ground truth; write reports.

| Module | Contents |
|--------|----------|
| `metrics.rs` | Precision, recall, FP rate, per-ambiguity slices |
| `report.rs` | Write `output/report.json` + `output/report.md` |
| `terminal.rs` | ANSI colored terminal summary |
| `ansi.rs` | Terminal color helpers |

### `settlesure-cli`

**Role:** Binary entry point. Args only — no matching logic.

| Module | Contents |
|--------|----------|
| `main.rs` | Clap args, `run_once()`, multi-seed ablation, report copy to dashboard |
| `banner.rs` | Startup logo (skipped on non-TTY or `--no-banner`) |

### `settlesure-integration`

**Role:** E2E and property tests (not shipped in production binary).

| Test file | What it verifies |
|-----------|------------------|
| `reconcile_e2e.rs` | Full pipeline on generated data |
| `fuzzy_bucket_parity.rs` | Bucketed vs brute-force candidate parity |
| `proptest_bounds.rs` | Fuzzy/split score bounds via property testing |
| `decoy_sweep.rs` | Decoy deferral across parameter sweeps |

---

## 6. File-by-File Reference

### Root

| File | Purpose |
|------|---------|
| `Cargo.toml` | Workspace definition, shared dependency versions |
| `Cargo.lock` | Locked dependency tree |
| `package.json` | npm scripts wrapping cargo commands |
| `README.md` | Headline metrics, quick start, history |
| `MIGRATION_NOTES.md` | TS→Rust port details, ablation numbers, benchmark methodology |
| `DEPENDENCIES.md` | Justification for each external crate |
| `Dockerfile` | CLI-only image (~160 MB) |
| `docker-compose.yml` | Engine + dashboard services |
| `baselines/seed42.json` | CI regression thresholds |

### Generated / runtime artifacts

| Path | Purpose |
|------|---------|
| `data/payments.json` | Generated payment records |
| `data/settlements.json` | Generated settlement records |
| `data/bank_credits.json` | Generated bank credit records |
| `data/ground_truth.json` | Expected matches/exceptions for scoring |
| `data/demo_corrections.json` | Sample human corrections for demo |
| `output/report.json` | Full report (metrics + matches + exceptions) |
| `output/report.md` | Human-readable markdown report |
| `output/corrections.json` | Dashboard-written human corrections |
| `output/llm-cache.json` | Cached LLM verdicts for reproducible ablations |
| `output/matches.ndjson` | Optional match dump (`--dump-matches`) |
| `dashboard/public/report.json` | Copy of report for Vite dev server |

### Dashboard

| File | Purpose |
|------|---------|
| `dashboard/src/App.tsx` | Main UI: metrics, difficulty slices, exceptions, matches |
| `dashboard/src/types.ts` | TypeScript types mirroring Rust `FullReport` |
| `dashboard/vite.config.ts` | Dev server + `/api/corrections` + `/api/rerun` middleware |
| `dashboard/src/App.css` | Styling |

---

## 7. Synthetic Data Generator

File: `crates/settlesure-data/src/generate.rs` (~1300 lines)

### Seed reproducibility

Uses **Mulberry32 PRNG** (`rng.rs`) seeded by `--seed`. Same seed → identical dataset every run.

### Class plan (seed 42, scale 1×)

| DiscrepancyClass | Count | AmbiguityLevel | What it tests |
|------------------|------:|----------------|---------------|
| `Clean` | 18 | clear | Trivial exact matches |
| `DateShifted` | 6 | clear | Fuzzy date tolerance |
| `AmountShifted` | 5 | clear | Fuzzy amount tolerance |
| `ReferenceMangled` | 3 | clear | UTR typo recovery via fuzzy |
| `ReferenceMangledBoundary` | 5 | boundary | Scores near 0.75 threshold |
| `FuzzyAmbiguousMatch` | 2 | boundary | Two plausible settlements → LLM |
| `NearDuplicateDecoy` | 3 | decoy | Near-dup that must NOT auto-match |
| `AcceptBandDecoyAmountUtr` | 1 | decoy | Decoy scores ≥0.75 but is wrong |
| `AcceptBandDecoyUtrAmountTol` | 1 | decoy | Same, different mangling strategy |
| `AcceptBandDecoyDateWrongRef` | 1 | decoy | Same, date/ref variant |
| `BatchedPayout` | 2 | clear | Unique subset-sum split |
| `BatchedPayoutAmbiguous` | 2 | decoy | Multiple valid subset-sums → LLM |
| `FeeTaxMismatch` | 3 | unresolvable | Integrity failure |
| `SettlementPendingBank` | 3 | unresolvable | Settlement without bank credit |
| `UnclaimedBankCredit` | 2 | unresolvable | Bank credit without settlement |
| `CurrencyMismatch` | 2 | unresolvable | Same UTR/amount, different currency |
| `UnresolvableNoise` | 3 | unresolvable | No plausible match exists |
| `DuplicateBank` | 2 | clear | Same UTR twice in bank feed |

Total at 1× scale: **71 payments / 71 settlements / 57 bank credits**.

Scale with `--batch-scale N` to multiply every class count.

### Adversarial engineering techniques

1. **`mangle_non_prefix()`** — UTR mangling that avoids truncated-prefix pairs (which hit the 0.92 ref floor and auto-match trivially).

2. **`mangle_for_composite_score()`** — targets fuzzy ambiguous band (0.55–0.72) by trying different manglings and date offsets, validated via `score_pair`.

3. **`assert_accept_band_bait()`** — generation-time guard ensuring:
   - Decoy settlement scores ≥ `fuzzyAcceptThreshold` (0.75)
   - True settlement still wins greedy ranking by >0.01

4. **Near-duplicate decoys** — settlements with ±0.5% amount delta, 2-day date offset, mangled UTR. GT says: match the true one, never the decoy.

### Generator hardening (why recall dropped from 100% to 85.71%)

After Rust port reproduced fixed TS engine at 100%/100%, the generator was hardened so `--skip-llm` leaves **7 genuinely ambiguous GT matches** unresolved. This ensures LLM and human tiers are actually exercised — a perfect score without them is a red flag.

---

## 8. Scoring & Metrics

File: `crates/settlesure-scoring/src/metrics.rs`

### Headline metrics

| Metric | Formula | Notes |
|--------|---------|-------|
| **Precision** | TP / predicted matches | 100% = no false matches |
| **Recall** (match rate) | TP / GT matches | How many true matches we found |
| **FP rate** | FP / predicted matches | Separate from precision (not blended) |
| **Exception accuracy** | correctly flagged exceptions / predicted exceptions | Precision on exceptions |

### Match source breakdown

Counts matches by `MatchSource`: exact / fuzzy / split / llm / human.

Seed 42 `--skip-llm` expected: **23 / 17 / 2 / 0 / 0**.

### Per-ambiguity-level slices

| Level | What's measured |
|-------|-----------------|
| `clear` | Precision + recall on trivial cases |
| `boundary` | Precision + recall at threshold edge |
| `decoy` | "Correctly deferred" — did we avoid matching the decoy? |
| `unresolvable` | "Correctly flagged" — did we leave true exceptions unmatched? |

### Exception accuracy nuance

Under `--skip-llm`, the 7 unresolved ambiguous GT matches produce `ambiguous — LLM unavailable` exception rows. These inflate the exception denominator without being GT exceptions → **~71% exception accuracy**. This is **expected**, not a regression. With LLM enabled, those resolve to matches and exception accuracy rises.

### Ground truth matching

A predicted match equals GT if:
- Same `bankCreditId`
- Same `settlementId` (or same sorted `settlementIds` set for splits)

Greedy one-to-one: each GT match can be claimed by at most one prediction.

---

## 9. LLM Tier

### When LLM is invoked

Only for rows in the **ambiguous bucket**:

- Fuzzy scores in `[0.5, 0.75)` with optional rivals
- Split with multiple valid subset-sum solutions

Never called for clear exact/fuzzy matches or integrity failures.

### Provider selection

File: `crates/settlesure-llm/src/resolve.rs` → `select_llm_provider()`

Priority:

1. Explicit `--llm-provider`
2. `ANTHROPIC_API_KEY`
3. `OPENAI_API_KEY` (+ optional `--llm-base-url` for Groq/OpenRouter)
4. Ollama on `localhost:11434`
5. `none`

Missing key with explicit provider → WARN log, falls back to `none`.

### Prompt structure

System prompt (`provider.rs` → `SETTLEMENT_SYSTEM_PROMPT`):

- Judge UTR prefix alignment (truncated bank UTR vs full settlement UTR)
- When rivals present: match only if primary is best among primary+rivals
- When splitOptions present: include `chosenSettlementIds` on match verdict
- Respond with JSON only: `{verdict, reasoning, chosenSettlementIds?}`

User payload (`build_resolve_payload()`):

```json
{
  "bankCredit": { ... },
  "settlement": { ... },
  "deterministicScore": 0.68,
  "deterministicReason": "date off by 2d; UTR similarity 0.71",
  "kind": "fuzzy",
  "rivals": [{ "settlement": {...}, "score": 0.66, "reason": "..." }],
  "splitOptions": [["setl_1", "setl_2"], ["setl_3", "setl_4"]]
}
```

### Verdict handling

| Verdict | Fuzzy case | Split case |
|---------|------------|------------|
| `match` | Creates `MatchSource::Llm` match | Match with validated `chosenSettlementIds` |
| `no_match` | Pair exceptions | Bank exception with split relatedIds |
| `unsure` | `"ambiguous — LLM declined"` | Same, split-flavored |
| Provider error | `"LLM unavailable — provider error"` | Same |
| No provider | `"ambiguous — LLM unavailable"` | Same |

### Transport hardening

- **120s** HTTP timeout
- **1 retry** with 2s backoff on transport errors only
- Model `unsure` is **never** retried
- Sequential dispatch (Ollama serves one request at a time locally)

### Verdict cache

File: `crates/settlesure-llm/src/cache.rs`

- Path: `output/llm-cache.json`
- Key: hash of (payload + model + seed)
- Enabled by default; disable with `--no-llm-cache`
- Uses `DefaultHasher` — not stable across Rust versions; treat as regenerable local state

### Model sensitivity (seed 42, measured)

| Model | Recall w/ LLM | LLM matches |
|-------|--------------:|------------:|
| none (`--skip-llm`) | 85.71% | 0 |
| qwen2.5:7b | 85.71% | 0 |
| llama3.2 | 93.48% | 4 |
| qwen2.5-coder:7b | 100.00% | 7 |

LLM lift is **model-dependent**. ~15s/call mean latency on local llama3.2.

---

## 10. Human-in-the-Loop & Dashboard

### Flow

```
Dashboard "Accept" on exception
        │
        ▼
POST /api/corrections → output/corrections.json
        │
        ▼
"Re-run with corrections" button
        │
        ▼
POST /api/rerun → cargo run ... --apply-corrections
        │
        ▼
Engine loads corrections → MatchSource::Human
        │
        ▼
Fresh report.json → dashboard reloads
```

### Correction schema

```json
{
  "recordId": "bank_0042",
  "source": "bank",
  "decision": "accept",
  "correctedMatchId": "setl_0042",
  "score": 0.7,
  "ts": "2026-08-28T..."
}
```

### Dashboard features

- Headline metrics: match rate, precision, recall, FP rate, throughput
- **Accuracy by case difficulty** — 4 cards (clear/boundary/decoy/unresolvable)
- Match source bar chart (exact/fuzzy/split/llm/human)
- Exceptions tab: filter, sort, Accept/Reject, expand reason
- Matches tab: inspector with pass, confidence, components, reasoning
- LLM ablation panel (when report includes `llmAblation`)

### Dev API (Vite middleware)

File: `dashboard/vite.config.ts`

- `GET/POST /api/corrections` — read/write corrections file
- `POST /api/rerun` — shell out to `cargo run -p settlesure-cli -- --seed 42 --skip-llm --apply-corrections`

**Note:** `/api/rerun` requires local Rust toolchain. Docker compose runs engine + dashboard separately.

### Threshold suggestion

If humans consistently accept scores in `[0.65, 0.75)`, `suggest_fuzzy_threshold()` in `corrections.rs` suggests lowering `fuzzyAcceptThreshold` — logged but **not auto-applied**.

---

## 11. CLI & Scripts

### CLI flags

| Flag | Default | Purpose |
|------|---------|---------|
| `--seed` | 42 | Reproducible dataset |
| `--generate-only` | false | Write data/*.json and exit |
| `--skip-llm` | false | Force deterministic only |
| `--llm-provider` | auto | anthropic \| openai \| ollama \| none |
| `--llm-model` | llama3.2 | Model name |
| `--llm-base-url` | openai.com/v1 | OpenAI-compatible API root |
| `--apply-corrections` | false | Load human corrections |
| `--runs` | 1 | Multi-seed (seed..seed+n-1) |
| `--compare-llm` | false | Side-by-side LLM on vs off |
| `--no-llm-cache` | false | Fresh model calls |
| `--dump-matches` | — | NDJSON match triples |
| `--batch-scale` | 1 | Multiply adversarial class counts |
| `--no-banner` | false | Skip startup logo |

### npm scripts

| Script | Command |
|--------|---------|
| `npm run reconcile` | `cargo run -p settlesure-cli --` |
| `npm run generate` | `cargo run -p settlesure-cli -- --generate-only` |
| `npm run dashboard` | Vite dev server on :5173 |
| `npm run test` | `cargo test --workspace` |
| `npm run check-baseline` | Regression gate vs seed42.json |
| `npm run ablation-seeds` | 5-seed LLM ablation |
| `npm run ablation-openai` | OpenAI ablation script |
| `npm run ablation-anthropic` | Anthropic ablation script |
| `npm run bench-throughput` | TS vs Rust timing comparison |

---

## 12. CI, Baselines & Regression Guards

### CI pipeline (`.github/workflows/ci.yml`)

**Job 1 — test-and-reconcile (blocks merge):**

1. `cargo test --workspace`
2. `cargo clippy --all-targets --all-features -- -D warnings`
3. `cargo run -p settlesure-cli -- --seed 42 --skip-llm --no-banner`
4. `node scripts/check-baseline.mjs`

**Job 2 — llm-ablation (optional, never blocks):**

- Best-effort Ollama install + multi-seed ablation

### Baseline gates (`scripts/check-baseline.mjs`)

Reads `baselines/seed42.json` vs `output/report.json`:

- `precision >= minPrecision`
- `recall >= minRecall`
- `matchRate >= minMatchRate`
- `falsePositiveRate <= maxFalsePositiveRate`
- GT ambiguity slice counts must exist
- Decoy deferral must be perfect (no decoy auto-matched)
- **`forbidSuspiciousPerfect`**: fails if 100%/100%/0% with zero LLM/human tier usage

This prevents the generator from regressing to trivially easy data.

---

## 13. Docker & Deployment

### CLI image

```bash
docker build -t settlesure .
docker run --rm settlesure --seed 42 --skip-llm --no-banner
```

- **CLI only** (~160 MB) — no Node, no dashboard, no bundled data
- Regenerates `data/` and writes `output/` at runtime

### Docker Compose

```bash
docker compose up engine      # runs reconcile, writes output/report.json
docker compose up dashboard   # serves dashboard on :5173
```

**Limitations:**

- Ollama inside container → unreachable (`localhost:11434` is host). LLM ablation needs native `cargo run` or host-network wiring.
- Dashboard `/api/rerun` shells out to local `cargo` — dev convenience only.

---

## 14. Configuration Reference

All defaults in `crates/settlesure-types/src/config.rs`:

```rust
ReconcileConfig {
    date_window_days: 3.0,
    amount_tolerance_pct: 0.02,      // 2%
    amount_tolerance_abs: 0.5,       // ₹0.50 floor
    fuzzy_accept_threshold: 0.75,
    ambiguous_low: 0.5,
    ambiguous_high: 0.75,
    weight_amount: 0.4,
    weight_date: 0.3,
    weight_reference: 0.3,
    split_date_window_days: 5.0,
    split_max_pool: 25,
    split_max_combo: 6,
}
```

Constants:

- `SPLIT_MAX_POOL = 25`
- `SPLIT_MAX_COMBO = 6`
- Fuzzy min reference similarity = `0.65` (in fuzzy.rs)
- Prefix floor = `0.92` for UTRs ≥6 chars (in reference.rs)

---

## 15. Performance & Throughput

### Deterministic passes (seed 42, 1× scale)

| Engine | Mean time |
|--------|----------:|
| TypeScript (Node) | 18.1 ms |
| Rust (release) | 5.1 ms |
| **Speedup** | **3.6×** |

### At 50× scale (3550 records)

| Pass | TypeScript | Rust release |
|------|----------:|-------------:|
| Exact | 166 ms | 120 ms |
| Fuzzy | 27,566 ms | 12,537 ms |
| Split | 202 ms | 92 ms |
| **Total** | ~28 s | ~13 s |
| **Speedup** | | **2.2×** |

Fuzzy dominates at scale. Bucketing reduces comparisons but fuzzy is still the bottleneck.

LLM is the throughput bottleneck when enabled: ~15s/call on local llama3.2, ~136s total for 9 ambiguous cases.

---

## 16. History & Engineering Judgment

### Timeline

| Era | Precision / Recall | Exact / Fuzzy / Split | Notes |
|-----|-------------------|----------------------|-------|
| Pre-fix TS | 97.67% / 91.30% | 22 / 18 / 3 | Dup-UTR false splits + prefix floor 0.9 |
| Fixed TS | 100% / 100% | 22 / 22 / 2 | Dup-UTR gate + prefix floor 0.92 |
| Rust port | 100% / 100% | 22 / 22 / 2 | Parity with fixed TS |
| **Hardened generator (current)** | **100% / 85.71%** | **23 / 17 / 2** | Accept-band decoy bait + LLM-tier cases |

### Three bugs caught (good interview stories)

1. **Suspicious perfect score** — 100%/100%/0% with zero LLM/human meant adversarial data wasn't exercising fallback tiers. Generator hardened.

2. **Transport errors mislabeled** — connection failures showed as `"ambiguous — LLM error"`. Split into explicit `provider error` vs `declined (unsure)`.

3. **Docker stub binary** — container shipped wrong binary. Fixed in Dockerfile.

### Known limitations

Listed in `scoring/report.rs` → `KNOWN_LIMITATIONS`:

- Split matching bounded (pool 25, combo 6)
- Ambiguous multi-solution batches routed to LLM/human, not auto-picked
- No FX conversion
- Ollama residual nondeterminism possible (model/hardware)
- `--skip-llm` intentionally under-matches ambiguous GT rows

---

## 17. Interview Cheat Sheet

### 30-second pitch

> SettleSure is a Razorpay-style 3-way settlement reconciliation engine in Rust. It matches bank payout credits to gateway settlements through a tiered pipeline: exact → fuzzy → split → LLM → human. Synthetic adversarial data with ground truth lets us measure precision/recall honestly. At seed 42 without LLM we get 100% precision and 85.71% recall — the 7 missed cases are genuinely ambiguous and designed for LLM/human escalation.

### Top 10 likely questions

**Q: Why is recall 85.71% without LLM?**  
A: Generator hardened so 7 GT matches are genuinely ambiguous (near-dup UTR pairs, multi-solution splits, accept-band decoys). Deterministic passes correctly defer them. LLM recovers most.

**Q: Why greedy fuzzy instead of Hungarian/global optimum?**  
A: Speed. Bucketing + greedy gives 3.6× over TS. Precision guarded by threshold + LLM escalation. Tradeoff acknowledged.

**Q: Why separate engine and LLM crates?**  
A: Engine is sync, network-free, testable. LLM is async HTTP. Callback injection avoids circular deps and keeps Docker/CI fast.

**Q: What's the duplicate-UTR gate?**  
A: After fuzzy claims a UTR, other bank credits with same UTR can't enter split. Prevents false subset-sum on duplicate bank entries.

**Q: What's accept-band decoy bait?**  
A: Wrong settlement engineered to score ≥0.75 but GT says don't match. Tests precision under greedy ranking.

**Q: How does fuzzy scoring work?**  
A: Weighted sum: 40% amount + 30% date + 30% UTR similarity. Amount/date zeroed outside tolerance/window. UTR uses Levenshtein + 0.92 prefix floor.

**Q: How does split matching work?**  
A: DFS subset-sum on settlement pool (≤25, combo ≤6). Unique solution → auto-match. Multiple → LLM disambiguation.

**Q: What happens when LLM is unavailable?**  
A: Ambiguous cases become exceptions with `"ambiguous — LLM unavailable"`. Not silently matched or silently dropped.

**Q: How do you prevent metric cheating?**  
A: CI baseline gate + `forbidSuspiciousPerfect` + decoy perfect deferral check + GT ambiguity slice counts.

**Q: Rust vs TypeScript — why port?**  
A: Same semantics, verified parity. Rust adds typed errors, crate separation, fuzzy bucketing, 2–3× speedup. Generator hardened after port for honest tier exercise.

### Numbers to memorize

| Metric | Value |
|--------|------:|
| Seed 42 records | 71 / 71 / 57 |
| Skip-LLM precision | 100% |
| Skip-LLM recall | 85.71% |
| Match sources (skip-LLM) | 23 / 17 / 2 / 0 / 0 |
| Rust deterministic time | ~5 ms |
| LLM lift (llama3.2) | 85.71% → 93.48% |
| Rust vs TS speedup (1×) | 3.6× |

---

## 18. Quick Commands

```bash
# Standard reconcile (deterministic)
cargo run -p settlesure-cli -- --seed 42 --skip-llm

# Generate data only
cargo run -p settlesure-cli -- --seed 42 --generate-only

# LLM ablation (needs Ollama or API key)
cargo run -p settlesure-cli -- --seed 42 --compare-llm --llm-provider ollama --llm-model llama3.2

# Human corrections demo
cargo run -p settlesure-cli -- --seed 42 --skip-llm --apply-corrections

# Multi-seed robustness
cargo run -p settlesure-cli -- --seed 42 --runs 5 --skip-llm

# Dashboard
npm run dashboard   # http://localhost:5173

# Tests + CI checks
cargo test --workspace
cargo clippy --all-targets --all-features -- -D warnings
npm run check-baseline

# Large-scale benchmark
cargo run -p settlesure-cli -- --seed 42 --batch-scale 50 --skip-llm --no-banner
```

---

*Last updated: August 2026 · SettleSure v2.0.0 · Rust workspace*
