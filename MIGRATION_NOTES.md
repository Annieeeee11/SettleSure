# SettleSure TypeScript → Rust migration notes

## Acceptance bar (locked)

Rust matches **current TypeScript engine semantics** (exact → fuzzy → dup-UTR gate → split → LLM). Seed-42 `--skip-llm` after generator hardening:

| Metric | Value |
| --- | ---: |
| Precision | 100% |
| Recall / match rate | 84.78% |
| FP rate | 0% |
| Exact / Fuzzy / Split / LLM / Human | 20 / 17 / 2 / 0 / 0 |

Diff vs [`baselines/seed42.json`](baselines/seed42.json) gates: pass (`P≥0.88`, `R≥0.84`, `FP≤0.05`, `matchRate≥0.84`, `forbidSuspiciousPerfect`).

## Historical divergence (22/18/3 vs 22/22/2)

The older README table (~97.67% precision / 91.30% recall, 22/18/3) reflected **pre-fix TypeScript** at commit `1b4a43c`, not a Rust regression:

1. **`17c0c88`** — Duplicate-UTR split gate: blocks leftover bank credits with an already-claimed UTR from entering split (eliminated false split on `bank_0057`-style decoy sums).
2. **`7a67d75`** — Prefix floor raised from 0.9 → **0.92** so truncated true UTR pairs clear `fuzzyAcceptThreshold` 0.75.

Rust reproduces fixed TS at 100%/100%/22/22/2 when the generator used prefix-truncation mangling that the fixed engine auto-resolved. That was **correct engine parity** but **too-easy adversarial data**.

## Generator hardening (post-port)

[`crates/settlesure-data/src/generate.rs`](crates/settlesure-data/src/generate.rs) was updated to keep fallback tiers exercised against the **fixed** engine:

- **Non-prefix UTR mangling** for boundary/decoy cases (avoids the 0.92 truncated-prefix floor).
- **`mangle_for_composite_score`** targets fuzzy ambiguous band (0.55–0.72) validated via `score_pair`.
- **`FuzzyAmbiguousMatch`** class (2 cases) — dual-settlement disambiguation.
- Tighter near-duplicate decoys (±0.5% amount delta default).

Result: `--skip-llm` leaves 7 GT matches in the LLM tier; `--compare-llm` is the intended path to recover them.

## LLM transport + ablation (seed 42, Ollama `llama3.2`)

`settlesure-llm` uses a **120s reqwest timeout**, **sequential dispatch** (Ollama single-slot), and **one transport retry** (2s backoff). Outcomes are typed: model verdict vs provider error vs declined (unsure).

| | With LLM | Without LLM |
| --- | ---: | ---: |
| Recall / match rate | 93.48% | 84.78% |
| Precision / FP | 100% / 0% | 100% / 0% |
| LLM matches | 4 | 0 |
| Ambiguous LLM calls | 9 (4 match / 0 no_match / 5 declined / 0 provider err) | — |
| Per-call latency | min 7.9s · mean 15.1s · max 58.2s | — |
| LLM pass wall time | ~136s | ~1ms |

**Exception prefix guide:**

| Prefix | Meaning |
| --- | --- |
| `LLM verdict: match` / `no_match` | Clear model verdict |
| `ambiguous — LLM declined` | Model unsure — not a transport failure |
| `LLM unavailable — provider error` | HTTP/transport failure after retry |
| `ambiguous — LLM unavailable` | No provider at reconcile start |

Prior to transport hardening, 7/9 ambiguous cases failed with connection errors mislabeled as `"ambiguous — LLM error"`.

**Anthropic:** HTTP client + error mapping are unit-tested; **live ablation not run in CI by default**. Optional: `npm run ablation-anthropic` when `ANTHROPIC_API_KEY` is set.

**Structured LLM output:** Ollama requests use JSON-schema `format`; verdicts are cached in `output/llm-cache.json` (keyed by candidate hash + model + seed) unless `--no-llm-cache`.

## Throughput benchmark methodology

Side-by-side comparison against a **TS oracle worktree** (last pre-deletion commit) on **identical pre-generated fixtures**.

### Setup

```bash
git worktree add ../settlesure-ts-oracle e44ec9d
cd ../settlesure-ts-oracle && npm install
```

### Fixture generation (Rust)

```bash
cargo run --release -p settlesure-cli -- --seed 42 --generate-only --batch-scale 1  --output-data-dir benchmarks/fixtures/scale-1x  --no-banner
cargo run --release -p settlesure-cli -- --seed 42 --generate-only --batch-scale 10 --output-data-dir benchmarks/fixtures/scale-10x --no-banner
cargo run --release -p settlesure-cli -- --seed 42 --generate-only --batch-scale 50 --output-data-dir benchmarks/fixtures/scale-50x --no-banner
```

Fixtures are copied to `../settlesure-ts-oracle/data/` before each scale run. TS has no `--skip-generate` flag; the bench script loads JSON from disk.

### Timing

- **Timed region:** `exactMs + fuzzyMs + splitMs` from engine instrumentation (excludes generation, report I/O, integrity setup, LLM).
- **Fresh subprocess per run:** orchestrator spawns `npx tsx scripts/bench-deterministic.ts` (TS) or the release `bench_deterministic` binary (Rust) five times per scale. Rust build cost is excluded.
- **Parity gate:** abort if match/exception counts differ between engines at a scale before trusting timings.
- **Modes:** Rust `--release`; TypeScript under Node (no JIT warm-up discard).

### Reproduce

```bash
npm run bench-throughput
# equivalent: node scripts/bench-throughput.mjs --runs 5 --scales 1,10,50
```

Harness: [`scripts/bench-throughput.mjs`](scripts/bench-throughput.mjs), Rust example [`crates/settlesure-cli/examples/bench_deterministic.rs`](crates/settlesure-cli/examples/bench_deterministic.rs), TS script in oracle worktree `scripts/bench-deterministic.ts`.

**Scaling insight:** Speedup shrinks from 3.6× (1×) to ~2.2× (10×/50×) because fuzzy dominates and scales O(banks × settlements) in both engines. Rust wins on constant-factor overhead, not algorithmic complexity.

## Docker (CLI-only, verified)

```bash
docker build -t settlesure .
docker run --rm settlesure --seed 42 --skip-llm --no-banner
```

Verified 2026-08-27: image ~160 MB; seed-42 `--skip-llm` produces **84.78% recall, 100% precision, 20/17/2/0/0** match sources inside the container.

The Dockerfile uses stub-crate layer caching ([`docker/stub-crates.sh`](docker/stub-crates.sh)); real sources are copied then rebuilt with `find … -exec touch` so Cargo does not ship the stub `fn main() {}` binary.

**Container scope:** No Node/dashboard. `--compare-llm --llm-provider ollama` warns `localhost:11434 unreachable` and falls back to `LLM: none` (expected — Ollama runs on the host).

## Behavior not ported 1:1 (harmless)

1. **Demo correction timestamps** — TS used wall-clock `new Date().toISOString()`. Rust uses fixed `2026-01-01T00:00:00.000Z`. Matching ignores `ts`.
2. **JSON float formatting** — serde may emit `1.0` vs `1`; numeric values match.
3. **Banner coloring** — CLI wordmark is plain ASCII.
4. **LLM non-determinism** — Ollama/Anthropic responses vary across runs.

## RNG / money

- **Mulberry32** ported with `wrapping_add` / `wrapping_mul` to match JS `>>> 0` / `Math.imul`.
- **Money** stays `f64` + `round_money` at the same call sites as TS.

## Async / sync boundary

- `settlesure-engine` is **fully sync** and has **no** HTTP/network code.
- `reconcile` accepts a `FnOnce(&[AmbiguousCandidate]) -> LlmPassResult` callback.
- `settlesure-cli` bridges async LLM via `tokio::task::block_in_place` + `Handle::block_on`.

## Crate map

| TS | Rust |
| --- | --- |
| `src/data/types.ts` | `settlesure-types` |
| `src/data/generate.ts` | `settlesure-data` |
| `src/engine/*` (no providers) | `settlesure-engine` |
| `src/engine/llmResolve.ts` + `providers/*` | `settlesure-llm` |
| `src/scoring/*` | `settlesure-scoring` |
| `src/cli.ts` | `settlesure-cli` |

## Diagnostics

- **`--dump-matches [path]`** — NDJSON match triples with GT `ambiguity_level` (default `output/matches.ndjson`).
- **`scripts/diff-match-dumps.mjs`** — diff two NDJSON dumps with GT annotation.
- **`scripts/check-baseline.mjs`** — regression gates + `forbidSuspiciousPerfect` tier-exercise guard.

## Commands

```bash
cargo run -p settlesure-cli -- --seed 42 --skip-llm
cargo run -p settlesure-cli -- --seed 42 --dump-matches
cargo test --workspace
cargo clippy --all-targets --all-features -- -D warnings
npm run check-baseline
```
