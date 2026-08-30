<p align="center">
  <img src="docs/image.png" alt="logo" />
</p>

# SettleSure: Payment Gateway Settlement Reconciliation

**Razorpay AI Buildathon, [Track 04: AI Finance Controller](https://razorpay.com/buildathon/)**

![Razorpay](https://img.shields.io/badge/Razorpay-072654?style=flat&logo=razorpay&logoColor=white)
![Rust](https://img.shields.io/badge/rust-1.90+-orange?style=flat&logo=rust)
![CI](https://github.com/Annieeeee11/SettleSure/actions/workflows/ci.yml/badge.svg)

Rules handle **42/49** true matches in **~13 ms**. LLM verifies the **7** genuinely ambiguous cases rules cannot safely decide.

| Precision | Recall | FP rate | Exact / Fuzzy / Split / LLM / Human |
| ---: | ---: | ---: | ---: |
| **100%** | **85.71%** | **0%** | 23 / 17 / 2 / 0 / 0 |

Seed 42, 77 payments / 77 settlements / 60 bank credits, `--skip-llm` baseline (no corrections).

| CLI | Dashboard |
| --- | --- |
| ![CLI reconcile output](docs/cli.png) | ![Dashboard metrics](docs/dashboard-seed42.png) |

## 60-second demo

```bash
npm run sync-report    # regenerate baseline + copy to dashboard/public/report.json
npm run dashboard      # http://localhost:5173
```

1. `cargo run -p settlesure-cli -- --seed 42 --skip-llm` runs exact, fuzzy, and split passes and writes `output/report.json`.
2. Dashboard shows match rate, precision, recall, FP rate by case difficulty, and the full exception list.
3. **Human loop (separate demo):** Accept an exception, then Re-run with corrections. Do **not** use this run for headline metrics. FP by design on GT-exception rows.

## Engineering judgment

We caught and fixed three results that looked good but weren't:

1. **Suspicious perfect score.** 100%/100%/0% with zero LLM/human meant the adversarial batch no longer exercised fallback tiers. Generator hardened so `--skip-llm` leaves 7 ambiguous GT matches unresolved.
2. **Transport errors mislabeled.** Connection failures showed as `"ambiguous — LLM error"`. Split into explicit `provider error` vs `declined (unsure)`.
3. **Docker stub binary.** Container shipped wrong binary. Fixed in Dockerfile.

## AI design: verifier, not matcher

LLM is **tier 4**, not tier 1. Clear cases never touch the model.

| Tier | Handles | Why not LLM? |
| --- | --- | --- |
| Exact / Fuzzy / Split | Clear + bounded ambiguity | Deterministic, auditable, sub-ms |
| **LLM** | 7 ambiguous GT matches (near-dup UTR, multi-solution splits) | Only place rules can't safely decide |
| Human | Ops override via dashboard | Bounded escalation with audit trail |

### Model sensitivity (seed 42, `--compare-llm`)

| Model | Recall w/ LLM | LLM matches | Verdicts (match / no_match / declined) |
| --- | ---: | ---: | --- |
| none (`--skip-llm`) | 85.71% | 0 | n/a |
| **qwen2.5-coder:7b** (Ollama) | **100.00%** | **7** | 7 / 0 / 2 |
| llama3.2 (Ollama, measured 2026-08-30) | 89.80% | 2 | 2 / 3 / 5 |
| gpt-4o-mini (OpenAI BYOK) | re-measure with key | n/a | n/a |
| qwen2.5:7b | 85.71% | 0 | 0 / 7 / 2 |

qwen2.5-coder measured 2026-08-27. llama3.2 re-measured 2026-08-30 on hardened generator. Model choice matters. Weak models show zero recall lift.

```bash
# Primary local demo (Ollama, best recall lift)
cargo run -p settlesure-cli -- --seed 42 --compare-llm \
  --llm-provider ollama --llm-model qwen2.5-coder:7b --no-llm-cache --no-banner

# Cloud BYOK fallback
OPENAI_API_KEY=... cargo run -p settlesure-cli -- --seed 42 --compare-llm \
  --llm-provider openai --llm-model gpt-4o-mini --no-banner
# or: npm run ablation-openai
```

When `--compare-llm` runs with a reachable provider, the report includes `llmAblation` and a `verdictLog` audit trail. Committed example: [`dashboard/public/report-llm.json`](dashboard/public/report-llm.json) (llama3.2, 2026-08-30). Sample entry:

```json
{
  "candidateId": "bank_0036:setl_0036",
  "verdict": "match",
  "reasoning": "UTR similarity 0.87",
  "latencyMs": 77340.067
}
```

### LLM exception prefixes (failure-class distinction)

| Prefix | Meaning |
| --- | --- |
| `LLM verdict: match` / `no_match` | Model responded with a clear verdict |
| `ambiguous — LLM declined` | Model responded but unsure / low confidence |
| `LLM unavailable — provider error` | Transport/HTTP failure after one retry |
| `ambiguous — LLM unavailable` | Provider not selected / Ollama unreachable |

Copy ablation output for dashboard LLM panel: `cp output/report.json dashboard/public/report-llm.json` (committed sample uses llama3.2).

## Architecture

```mermaid
flowchart TB
  subgraph cli [settlesure-cli]
    Args[CLI orchestration]
  end
  subgraph core [Rust workspace]
    Data[settlesure-data]
    Engine[settlesure-engine]
    LLM[settlesure-llm]
    Scoring[settlesure-scoring]
    Types[settlesure-types]
  end
  subgraph ui [Dashboard]
    Vite[React + Vite]
    ReportJSON[public/report.json]
  end
  Args --> Data --> Engine
  Engine -->|"ambiguous only"| LLM
  Engine --> Scoring
  LLM --> Scoring
  Scoring --> ReportJSON
  Vite --> ReportJSON
  Types --> Data
  Types --> Engine
  Types --> LLM
  Types --> Scoring
```

Pipeline: **integrity → exact → fuzzy → split → LLM → human corrections**

Full design doc: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)

## Pipeline

Razorpay-style 3-way settlement reconciliation: Payments → Settlements (gross/fee/tax/net + UTR) → Bank payout credits.

Adversarial cases include near-duplicate decoys, **accept-band precision bait** (decoys engineered to cross the 0.75 fuzzy threshold), boundary reference mangles, decoy subset sums, and unresolvable noise. Scored with `ambiguityLevel` (`clear` / `boundary` / `decoy` / `unresolvable`).

## Quick start

```bash
cargo run -p settlesure-cli -- --seed 42 --skip-llm
# or: npm run reconcile -- --seed 42 --skip-llm
npm run sync-report   # baseline + dashboard artifact + check-baseline
npm run dashboard     # http://localhost:5173
```

### Options

| Flag | Meaning |
| --- | --- |
| `--seed <n>` | Reproducible batch (default `42`) |
| `--generate-only` | Write data files and exit |
| `--skip-llm` | Force no LLM |
| `--llm-provider <…>` | `anthropic` \| `openai` \| `ollama` \| `none` |
| `--llm-model <name>` | Model name (Ollama default `llama3.2`, OpenAI default `gpt-4o-mini`) |
| `--llm-base-url <url>` | OpenAI-compatible API root |
| `--apply-corrections` | Apply `output/corrections.json` or `data/demo_corrections.json` |
| `--runs <n>` | Multi-seed robustness (seeds `seed..seed+n-1`) |
| `--compare-llm` | Side-by-side LLM on vs off ablation |
| `--no-llm-cache` | Disable `output/llm-cache.json` (fresh model calls) |
| `--batch-scale <n>` | Multiply adversarial class counts (default `1`) |

Provider selection: `--llm-provider` → `ANTHROPIC_API_KEY` → `OPENAI_API_KEY` → Ollama → none.

### BYOK (bring your own key)

| Provider | Env | `--llm-base-url` | Example `--llm-model` |
| --- | --- | --- | --- |
| OpenAI | `OPENAI_API_KEY` | (default) | `gpt-4o-mini` |
| Groq | `OPENAI_API_KEY` | `https://api.groq.com/openai/v1` | `llama-3.1-8b-instant` |
| OpenRouter | `OPENAI_API_KEY` | `https://openrouter.ai/api/v1` | `openai/gpt-4o-mini` |

Anthropic: `npm run ablation-anthropic` when `ANTHROPIC_API_KEY` is set.

## Throughput (Rust release, deterministic passes)

Measured 2026-08-30 with `cargo run --release -p settlesure-cli -- --seed 42 --batch-scale N --skip-llm`.

| Scale | Records (pay / setl / bank) | Runtime (ms) | Throughput (rec/s) |
| --- | --- | ---: | ---: |
| 1× | 77 / 77 / 60 | 1.8 | 74,538 |
| 10× | 770 / 770 / 600 | 218.5 | 6,269 |
| 50× | 3,850 / 3,850 / 3,000 | 3,820.6 | 1,793 |

Fuzzy pass dominates at scale. Amount × date bucketing reduces pairwise comparisons.

## Docker

```bash
docker build -t settlesure .
docker run --rm settlesure --seed 42 --skip-llm --no-banner
docker compose up engine      # writes output/report.json
docker compose up dashboard   # http://localhost:5173
```

**Container notes.** Ollama runs on the host, not inside the container. Dashboard `/api/rerun` requires a local Rust toolchain (dev convenience).

## Metrics (never blended)

Overall precision, recall, and FP rate are reported separately, plus **Accuracy by case difficulty** in `output/report.md` and the dashboard.

**Exception accuracy** = correctly flagged exceptions ÷ predicted exception count. Under `--skip-llm`, the 7 deliberately-unresolved ambiguous GT matches produce `ambiguous — LLM unavailable` rows that inflate the denominator. **~71%** at seed 42. With LLM enabled those cases resolve to matches. Expected, not a regression.

## Tests & CI

```bash
cargo test --workspace
cargo clippy --all-targets --all-features -- -D warnings
npm run sync-report
```

CI fails if seed 42 is suspiciously perfect (100%/100%/0% with zero LLM/human tier usage) or if adversarial GT slices disappear.


## History

| Era | Precision / Recall | Exact / Fuzzy / Split | Notes |
| --- | --- | --- | --- |
| Pre-fix TS | 97.67% / 91.30% | 22 / 18 / 3 | Dup-UTR false splits |
| Fixed TS | 100% / 100% | 22 / 22 / 2 | Dup-UTR gate + prefix floor 0.92 |
| Rust port | 100% / 100% | 22 / 22 / 2 | Parity with fixed TS |
| **Hardened generator (current)** | **100% / 85.71%** | **23 / 17 / 2** | Accept-band decoy bait + LLM-tier cases |

## Known limitations

- Split matching bounded (pool ≤25, combo ≤6)
- Ambiguous multi-solution batches routed to LLM/human, not auto-picked
- No FX conversion
- Ollama residual nondeterminism possible (model/hardware)
- `--skip-llm` intentionally under-matches ambiguous GT rows
- LLM ablation numbers are model-dependent. Re-measure per provider.
