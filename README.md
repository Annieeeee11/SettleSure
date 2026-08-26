# SettleSure: Payment Gateway Settlement Reconciliation

![Razorpay](https://img.shields.io/badge/Razorpay-072654?style=flat&logo=razorpay&logoColor=white)
![Rust](https://img.shields.io/badge/rust-1.90+-orange?style=flat&logo=rust)
![CI](https://github.com/Annieeeee11/SettleSure/actions/workflows/ci.yml/badge.svg)

This is a Razorpay-style 3-way settlement reconciliation: Payments → Settlements (gross/fee/tax/net + UTR) → Bank payout credits. The **Rust** deterministic engine (exact → fuzzy → split) handles the clear batch; **LLM and human tiers** escalate genuinely ambiguous near-dups, boundary UTR pairs, and multi-solution splits — not recall crutches.

See [`MIGRATION_NOTES.md`](MIGRATION_NOTES.md) for the TypeScript → Rust port details.

## What broke, and what we did about it

A perfect **100%/100%/0%** score with **zero LLM or human matches** is a red flag on this track: it means the adversarial batch no longer exercises fallback tiers. Seed 42 was hardened so `--skip-llm` leaves **7 genuinely ambiguous GT matches** unresolved (boundary + near-duplicate decoys routed to LLM). With LLM enabled, those cases are the intended resolution path.

## 60-second demo

1. `cargo run -p settlesure-cli -- --seed 42 --skip-llm` generates the batch, runs exact → fuzzy → split, and prints the report.
2. `npm run dashboard` opens http://localhost:5173. You’ll see match rate, precision, recall, and FP rate by case difficulty, plus the full exception list with reasons.
3. In the dashboard, click **Accept** on one ambiguous exception, then **Re-run with corrections**. The human-resolved count should move from 0 to 1+ in the match-source chart.
4. `cargo run -p settlesure-cli -- --seed 42 --compare-llm --llm-provider ollama --llm-model llama3.2` shows residual LLM work on ambiguous splits and near-dups (needs local Ollama). After transport hardening (120s timeout, one retry), all 9 ambiguous cases get a model verdict or an explicit provider-error label — no misleading `"ambiguous — LLM error"` strings.

**Seed 42 headline metrics** (`--seed 42 --skip-llm`):

| Precision | Recall | FP rate | Exact / Fuzzy / Split / LLM / Human |
| ---: | ---: | ---: | ---: |
| 100% | 84.78% | 0% | 20 / 17 / 2 / 0 / 0 |

**Seed 42 LLM ablation** (`--seed 42 --compare-llm --llm-provider ollama --llm-model llama3.2`, measured 2026-08-27):

| | With LLM | Without LLM |
| --- | ---: | ---: |
| Match rate / Recall | 93.48% | 84.78% |
| Precision / FP | 100% / 0% | 100% / 0% |
| LLM matches | 4 | 0 |
| Match sources | 20 / 17 / 2 / 4 / 0 | 20 / 17 / 2 / 0 / 0 |
| LLM pass wall time | ~136s | ~1ms |
| Per-call latency (9 calls) | min 7.9s · mean 15.1s · max 58.2s | — |

Deterministic passes run in ~1–2ms per record; LLM verification is the throughput bottleneck (~15s/call on local `llama3.2`).

**LLM exception prefixes** (failure-class distinction):

| Prefix | Meaning |
| --- | --- |
| `LLM verdict: match` / `no_match` | Model responded with a clear verdict |
| `ambiguous — LLM declined` | Model responded but unsure / low confidence |
| `LLM unavailable — provider error` | Transport/HTTP failure after one retry |
| `ambiguous — LLM unavailable` | Provider not selected / Ollama unreachable at start |

**Human loop:** `cargo run -p settlesure-cli -- --seed 42 --skip-llm --apply-corrections` (or dashboard Accept → Re-run) shows **Human ≥ 1** via `data/demo_corrections.json`. Accepting a GT-`exception` row (ambiguous split) scores as an **FP by design** — GT says “do not auto-match”; the human override is still a useful ops demo.

```bash
cargo run -p settlesure-cli -- --seed 42 --skip-llm
npm run dashboard   # http://localhost:5173
```

## Pipeline

1. **Payments**: gateway captures  
2. **Settlements**: fee/tax identity + UTR  
3. **Bank credits**: UTR join on net ≈ credited  
4. Passes: integrity → exact → fuzzy → split → LLM → human corrections  

Adversarial cases include near duplicate decoys, boundary reference mangles, decoy subset sums, and unresolvable noise. They’re scored with `ambiguityLevel` (`clear` / `boundary` / `decoy` / `unresolvable`).

## Quick start

```bash
cargo run -p settlesure-cli -- --seed 42 --skip-llm
# or: npm run reconcile -- --seed 42 --skip-llm
```

### Options

| Flag | Meaning |
| --- | --- |
| `--seed <n>` | Reproducible batch (default `42`) |
| `--generate-only` | Write data files and exit |
| `--skip-llm` | Force no LLM |
| `--llm-provider <…>` | `anthropic` \| `ollama` \| `none` |
| `--llm-model <name>` | Ollama model (default `llama3.2`) |
| `--apply-corrections` | Apply `output/corrections.json` or `data/demo_corrections.json` |
| `--runs <n>` | Multi-seed robustness (seeds `seed..seed+n-1`) |
| `--compare-llm` | Side-by-side LLM on vs off ablation |
| `--dump-matches [path]` | Write NDJSON match triples (default `output/matches.ndjson`) |
| `--batch-scale <n>` | Multiply adversarial class counts when generating (default `1`) |
| `--output-data-dir <dir>` | Override data output path (with `--generate-only`) |

Provider selection order: `--llm-provider` → `ANTHROPIC_API_KEY` → Ollama → none.

## Throughput (TS oracle vs Rust release)

Deterministic passes only (exact + fuzzy + split), measured with fresh subprocess per run. Rust uses `--release`; TypeScript runs under Node (no separate release mode). Fixtures are Rust-generated and copied to the TS oracle worktree; parity on match/exception counts is verified before timing.

| Scale | Records (pay / setl / bank) | TS mean (ms) | Rust mean (ms) | Speedup | ms / bank |
| --- | --- | ---: | ---: | ---: | ---: |
| 1× | 71 / 71 / 57 | 18.1 | 5.1 | **3.6×** | 0.32 / 0.09 |
| 10× | 710 / 710 / 570 | 1,072 | 485 | **2.2×** | 1.88 / 0.85 |
| 50× | 3,550 / 3,550 / 2,850 | 27,935 | 12,749 | **2.2×** | 9.80 / 4.47 |

At seed-42 scale (71 records), both engines finish deterministic reconciliation in single-digit milliseconds — the ~3.6× gap is real but modest in absolute terms. The story widens at production-ish batch sizes: fuzzy pass is O(banks × settlements), so time grows super-linearly and dominates total runtime.

**Pass breakdown at 50× scale (mean ms):**

| Pass | TypeScript | Rust release |
| --- | ---: | ---: |
| Exact | 166 | 120 |
| Fuzzy | 27,566 | 12,537 |
| Split | 202 | 92 |

Reproduce: `npm run bench-throughput` (requires TS oracle worktree — see [`MIGRATION_NOTES.md`](MIGRATION_NOTES.md)).

## Docker (CLI-only)

The image packages **`settlesure-cli` only** — no Node, no dashboard.

```bash
docker build -t settlesure .
docker run --rm settlesure --seed 42 --skip-llm --no-banner
```

The CLI regenerates `data/` and writes `output/` at runtime under `/app`. Baselines and pre-shipped fixtures are not required in the image.

**Dashboard `/api/rerun`** ([`dashboard/vite.config.ts`](dashboard/vite.config.ts)) shells out to `cargo run` on the host — a **local-dev convenience** that requires a local Rust toolchain. It is intentionally **not** included in the Docker image. A fully containerized dashboard+engine demo would be a separate `docker-compose.yml`.

## Cargo workspace

```
crates/settlesure-types|data|engine|scoring|llm|cli
```

Engine has no network code; LLM is isolated and async.

## Metrics (never blended)

Overall precision, recall, and FP rate are reported separately, plus **Accuracy by case difficulty** in `output/report.md` and the dashboard.

## Tests & CI

```bash
cargo test --workspace
cargo clippy --all-targets --all-features -- -D warnings
cargo run -p settlesure-cli -- --seed 42 --skip-llm
npm run check-baseline
```

CI fails if seed 42 is suspiciously perfect (100%/100%/0% with zero LLM/human tier usage) or if adversarial GT slices disappear.

## History

| Era | Precision / Recall | Exact / Fuzzy / Split | Notes |
| --- | --- | --- | --- |
| Pre-fix TS (`1b4a43c`) | 97.67% / 91.30% | 22 / 18 / 3 | Dup-UTR false splits + prefix floor 0.9 |
| Fixed TS (`17c0c88`, `7a67d75`) | 100% / 100% | 22 / 22 / 2 | Dup-UTR split gate + prefix floor 0.92 |
| Rust port (same engine) | 100% / 100% | 22 / 22 / 2 | Correct parity with fixed TS |
| **Hardened generator (current)** | **100% / 84.78%** | **20 / 17 / 2** | Adversarial cases target LLM tier again |

Root cause of the historical 22/18/3 gap: TS commits [`17c0c88`](.) (duplicate-UTR split gate) and [`7a67d75`](.) (prefix floor 0.92). Rust reproduces fixed TS behavior; the generator was subsequently hardened so truncated-prefix mangling alone cannot trivialize the batch.

## Known limitations

- Split matching is bounded (pool ≤25, combo ≤6)
- Ambiguous multi-solution batches are not auto-picked; they are routed to the LLM/human tier
- No FX conversion
- Local LLM output isn’t deterministic
- `--skip-llm` intentionally under-matches ambiguous GT rows — use `--compare-llm` or `--apply-corrections` to exercise fallback tiers
