# SettleSure: Payment Gateway Settlement Reconciliation

![Razorpay](https://img.shields.io/badge/Razorpay-072654?style=flat&logo=razorpay&logoColor=white)
![Rust](https://img.shields.io/badge/rust-1.90+-orange?style=flat&logo=rust)
![CI](https://github.com/Annieeeee11/SettleSure/actions/workflows/ci.yml/badge.svg)

**Track 04 bar (seed 42):** **85.71% recall / 100% precision** with an honest exception list (7 ambiguous GT matches left unresolved under `--skip-llm`); **3.6×** deterministic throughput vs the TS oracle at 1× scale; **LLM lift is model-dependent** (see model sensitivity table below).

## Current headline metrics (seed 42, `--skip-llm`)

| Precision | Recall | FP rate | Exact / Fuzzy / Split / LLM / Human |
| ---: | ---: | ---: | ---: |
| 100% | 85.71% | 0% | 23 / 17 / 2 / 0 / 0 |

> **LLM lift is model-dependent.** An arbitrary local Ollama model may show **zero recall gain**. Re-measure manually per model (see [BYOK](#byok-bring-your-own-key) below); `npm run ablation-models-help` prints an example command only — it does not run ablations.

**Model sensitivity (seed 42, `--compare-llm`, measured 2026-08-27):**

| Model | Recall w/ LLM | LLM matches | Verdicts (match / no_match / declined) |
| --- | ---: | ---: | --- |
| none (`--skip-llm`) | 85.71% | 0 | — |
| qwen2.5:7b | 85.71% | 0 | 0 / 7 / 2 |
| llama3.2 | 93.48%† | 4 | 4 / 0 / 5 |
| qwen2.5-coder:7b | 100.00% | 7 | 7 / 0 / 2 |

† `llama3.2` ablation used pre–accept-band-bait batch layout (84.78% skip-llm baseline); re-measure manually after generator changes (see BYOK section).

**Anthropic:** transport/error handling is unit-tested; **live ablation not run by default**. Optional: `npm run ablation-anthropic` when `ANTHROPIC_API_KEY` is set (uses `claude-3-5-haiku-latest`).

**LLM ablation (comparative — Ollama `llama3.2`, single seed, measured 2026-08-27):**

| | With LLM | Without LLM |
| --- | ---: | ---: |
| Match rate / Recall | 93.48% | 84.78%† |
| Precision / FP | 100% / 0% | 100% / 0% |
| LLM matches | 4 | 0 |
| Match sources | 20 / 17 / 2 / 4 / 0 | 20 / 17 / 2 / 0 / 0 |
| LLM pass wall time | ~136s | ~1ms |
| Per-call latency (9 calls) | min 7.9s · mean 15.1s · max 58.2s | — |

**Multi-seed LLM ablation:** `npm run ablation-seeds` runs `--compare-llm --runs 5` (seeds 42–46) and reports mean/min/max recall lift in `output/report.md`. CI runs this optionally when Ollama is available (never blocks merge).

Deterministic passes at seed-42 scale finish in single-digit milliseconds; LLM verification is the throughput bottleneck (~15s/call on local `llama3.2`).

> **Engineering judgment:** We caught and fixed three instances of a result that looked good but wasn't — a perfect 100%/100%/0% score that stopped exercising fallback tiers, transport errors mislabeled as LLM declines, and a Docker stub-binary bug. See [History](#history) for the full timeline.

## 60-second demo

1. `cargo run -p settlesure-cli -- --seed 42 --skip-llm` generates the batch, runs exact → fuzzy → split, and prints the report to `output/report.json`.
2. `npm run dashboard` opens http://localhost:5173 (serves `dashboard/public/report.json` — copy from `output/` after step 1 if you need a fresh view). You'll see match rate, precision, recall, and FP rate by case difficulty, plus the full exception list with reasons.
3. In the dashboard, click **Accept** on one ambiguous exception, then **Re-run with corrections**. The human-resolved count should move from 0 to 1+ in the match-source chart.
4. `cargo run -p settlesure-cli -- --seed 42 --compare-llm --llm-provider ollama --llm-model llama3.2` shows residual LLM work on ambiguous splits and near-dups (needs local Ollama). After transport hardening (120s timeout, one retry), all 9 ambiguous cases get a model verdict or an explicit provider-error label — no misleading `"ambiguous — LLM error"` strings.

**LLM exception prefixes** (failure-class distinction):

| Prefix | Meaning |
| --- | --- |
| `LLM verdict: match` / `no_match` | Model responded with a clear verdict |
| `ambiguous — LLM declined` | Model responded but unsure / low confidence |
| `LLM unavailable — provider error` | Transport/HTTP failure after one retry |
| `ambiguous — LLM unavailable` | Provider not selected / Ollama unreachable at start |

**Human loop:** `cargo run -p settlesure-cli -- --seed 42 --skip-llm --apply-corrections` (or dashboard Accept → Re-run) shows **Human ≥ 1** via `data/demo_corrections.json`. Accepting a GT-`exception` row (ambiguous split) scores as an **FP by design** — GT says "do not auto-match"; the human override is still a useful ops demo.

## What broke, and what we did about it

A perfect **100%/100%/0%** score with **zero LLM or human matches** is a red flag on this track: it means the adversarial batch no longer exercises fallback tiers. Seed 42 was hardened so `--skip-llm` leaves **7 genuinely ambiguous GT matches** unresolved (boundary + near-duplicate decoys routed to LLM). With LLM enabled, those cases are the intended resolution path.

## Pipeline

Razorpay-style 3-way settlement reconciliation: Payments → Settlements (gross/fee/tax/net + UTR) → Bank payout credits. The **Rust** deterministic engine (exact → fuzzy → split) handles the clear batch; **LLM and human tiers** escalate genuinely ambiguous near-dups, boundary UTR pairs, and multi-solution splits — not recall crutches.

See [`MIGRATION_NOTES.md`](MIGRATION_NOTES.md) for the TypeScript → Rust port details.

1. **Payments**: gateway captures  
2. **Settlements**: fee/tax identity + UTR  
3. **Bank credits**: UTR join on net ≈ credited  
4. Passes: integrity → exact → fuzzy → split → LLM → human corrections  

Adversarial cases include near duplicate decoys, **accept-band precision bait** (decoys engineered to cross the 0.75 fuzzy threshold), boundary reference mangles, decoy subset sums, and unresolvable noise. They're scored with `ambiguityLevel` (`clear` / `boundary` / `decoy` / `unresolvable`).

## Quick start

```bash
cargo run -p settlesure-cli -- --seed 42 --skip-llm
# or: npm run reconcile -- --seed 42 --skip-llm
npm run dashboard   # http://localhost:5173
```

### Options

| Flag | Meaning |
| --- | --- |
| `--seed <n>` | Reproducible batch (default `42`) |
| `--generate-only` | Write data files and exit |
| `--skip-llm` | Force no LLM |
| `--llm-provider <…>` | `anthropic` \| `openai` \| `ollama` \| `none` |
| `--llm-model <name>` | Model name (Ollama default `llama3.2`; OpenAI default `gpt-4o-mini`) |
| `--llm-base-url <url>` | OpenAI-compatible API root (default `https://api.openai.com/v1`) |
| `--apply-corrections` | Apply `output/corrections.json` or `data/demo_corrections.json` |
| `--runs <n>` | Multi-seed robustness (seeds `seed..seed+n-1`); combine with `--compare-llm` for multi-seed LLM ablation |
| `--compare-llm` | Side-by-side LLM on vs off ablation (works with `--runs`) |
| `--no-llm-cache` | Disable `output/llm-cache.json` verdict cache (fresh model calls) |
| `--dump-matches [path]` | Write NDJSON match triples (default `output/matches.ndjson`) |
| `--batch-scale <n>` | Multiply adversarial class counts when generating (default `1`) |
| `--output-data-dir <dir>` | Override data output path (with `--generate-only`) |

Provider selection order: `--llm-provider` → `ANTHROPIC_API_KEY` → `OPENAI_API_KEY` → Ollama → none.

### BYOK (bring your own key)

OpenAI-compatible endpoints share one provider (`--llm-provider openai`) with `OPENAI_API_KEY`:

| Provider | Env | `--llm-base-url` (optional) | Example `--llm-model` |
| --- | --- | --- | --- |
| OpenAI | `OPENAI_API_KEY` | (default) | `gpt-4o-mini` |
| Groq | `OPENAI_API_KEY` | `https://api.groq.com/openai/v1` | `llama-3.1-8b-instant` |
| OpenRouter | `OPENAI_API_KEY` | `https://openrouter.ai/api/v1` | `openai/gpt-4o-mini` |

```bash
OPENAI_API_KEY=... cargo run --release -p settlesure-cli -- --seed 42 --compare-llm \
  --llm-provider openai --llm-model gpt-4o-mini --no-banner
# or: npm run ablation-openai
```

Missing `OPENAI_API_KEY` with `--llm-provider openai` falls back to `LLM: none` with a WARN log; ambiguous cases get `ambiguous — LLM unavailable` (same as Anthropic without a key). Anthropic: `npm run ablation-anthropic` when `ANTHROPIC_API_KEY` is set.

## Throughput (historical / comparative — TS oracle vs Rust release)

Deterministic passes only (exact + fuzzy + split), measured with fresh subprocess per run. Rust uses `--release`; TypeScript runs under Node (no separate release mode). Fixtures are Rust-generated and copied to the TS oracle worktree; parity on match/exception counts is verified before timing.

| Scale | Records (pay / setl / bank) | TS mean (ms) | Rust mean (ms) | Speedup | ms / bank |
| --- | --- | ---: | ---: | ---: | ---: |
| 1× | 71 / 71 / 57 | 18.1 | 5.1 | **3.6×** | 0.32 / 0.09 |
| 10× | 710 / 710 / 570 | 1,072 | 485 | **2.2×** | 1.88 / 0.85 |
| 50× | 3,550 / 3,550 / 2,850 | 27,935 | 12,749 | **2.2×** | 9.80 / 4.47 |

At seed-42 scale (71 records), both engines finish deterministic reconciliation in single-digit milliseconds — the ~3.6× gap is real but modest in absolute terms.

**Why speedup shrinks at scale:** The fuzzy pass dominates runtime (~27.5s TS / ~12.5s Rust out of ~28s / ~13s total at 50×). Fuzzy now uses an **amount × date bucket pre-filter** before pairwise scoring (same candidate set, fewer comparisons). The Rust rewrite still improves constant factors; bucketing is the next lever at larger batch sizes.

**Pass breakdown at 50× scale (mean ms):**

| Pass | TypeScript | Rust release |
| --- | ---: | ---: |
| Exact | 166 | 120 |
| Fuzzy | 27,566 | 12,537 |
| Split | 202 | 92 |

Reproduce: `npm run bench-throughput` (requires TS oracle worktree — see [`MIGRATION_NOTES.md`](MIGRATION_NOTES.md)).

## Docker (CLI-only)

The image packages **`settlesure-cli` only** (~160 MB) — no Node, no dashboard, no bundled `data/` or `target/` artifacts.

```bash
docker build -t settlesure .
docker run --rm settlesure --seed 42 --skip-llm --no-banner
# Dashboard + engine (run engine first — it writes output/report.json):
docker compose up engine
docker compose up dashboard   # then open http://localhost:5173
```

First boot: run **`engine` before `dashboard`** so `output/report.json` exists. Dashboard skips `npm ci` when `node_modules` is already present.

**Verified output** (2026-08-27, `docker build` + `docker run` on Colima/arm64):

| Metric | Value |
| --- | ---: |
| Recall / match rate | 85.71% |
| Precision / FP | 100% / 0% |
| Match sources | 23 / 17 / 2 / 0 / 0 |

The CLI regenerates `data/` and writes `output/` at runtime under `/app`.

**Known container limitations:**

- **`--compare-llm --llm-provider ollama`** falls back to `LLM: none` with a WARN log (`localhost:11434 unreachable`) — Ollama runs on the host, not inside the container. This exits cleanly (no hang/crash); use native `cargo run` or host-network wiring for LLM ablation.
- **Dashboard `/api/rerun`** ([`dashboard/vite.config.ts`](dashboard/vite.config.ts)) shells out to `cargo run` on the host — a **local-dev convenience** requiring a local Rust toolchain. Use [`docker-compose.yml`](docker-compose.yml) for a containerized dashboard+engine demo (Ollama still on host for LLM ablation).

## Cargo workspace

```
crates/settlesure-types|data|engine|scoring|llm|cli
```

Engine has no network code; LLM is isolated and async.

## Metrics (never blended)

Overall precision, recall, and FP rate are reported separately, plus **Accuracy by case difficulty** in `output/report.md` and the dashboard.

**Exception accuracy** = correctly flagged exceptions ÷ predicted exception count (precision on exceptions, not recall). Under `--skip-llm`, the 7 deliberately-unresolved ambiguous GT **matches** produce `ambiguous — LLM unavailable` exception rows that inflate the denominator without being GT exceptions — **~71%** (35/49) at current seed 42. With LLM enabled those cases resolve to matches and exception accuracy rises (~84%+). This is expected, not a regression.

## Tests & CI

```bash
cargo test --workspace
cargo clippy --all-targets --all-features -- -D warnings
cargo run -p settlesure-cli -- --seed 42 --skip-llm
npm run check-baseline
```

CI fails if seed 42 is suspiciously perfect (100%/100%/0% with zero LLM/human tier usage) or if adversarial GT slices disappear.

## History (historical / comparative)

| Era | Precision / Recall | Exact / Fuzzy / Split | Notes |
| --- | --- | --- | --- |
| Pre-fix TS (`1b4a43c`) | 97.67% / 91.30% | 22 / 18 / 3 | Dup-UTR false splits + prefix floor 0.9 |
| Fixed TS (`17c0c88`, `7a67d75`) | 100% / 100% | 22 / 22 / 2 | Dup-UTR split gate + prefix floor 0.92 |
| Rust port (same engine) | 100% / 100% | 22 / 22 / 2 | Correct parity with fixed TS |
| **Hardened generator (current)** | **100% / 85.71%** | **23 / 17 / 2** | Accept-band decoy bait + LLM-tier ambiguous cases |

Root cause of the historical 22/18/3 gap: TS commits [`17c0c88`](.) (duplicate-UTR split gate) and [`7a67d75`](.) (prefix floor 0.92). Rust reproduces fixed TS behavior; the generator was subsequently hardened so truncated-prefix mangling alone cannot trivialize the batch.

## Known limitations

- Split matching is bounded (pool ≤25, combo ≤6)
- Fuzzy matching buckets candidates by amount × date window before pairwise scoring (reduces comparisons at scale)
- Ambiguous multi-solution batches are not auto-picked; they are routed to the LLM/human tier
- No FX conversion
- Ollama uses `temperature: 0` + fixed seed + JSON schema `format`; residual nondeterminism may remain (model/hardware)
- Anthropic / OpenAI live ablation not verified by default — use `npm run ablation-anthropic` or `npm run ablation-openai` with API keys
- `--skip-llm` intentionally under-matches ambiguous GT rows — use `--compare-llm` (native/Ollama on host) or `--apply-corrections` to exercise fallback tiers
- Docker image is CLI-only; Ollama/LLM ablation requires host-side provider access
