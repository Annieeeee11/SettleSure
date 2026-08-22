<div align="center">
  <img width="476" height="147" alt="image" src="https://github.com/user-attachments/assets/cb6a7870-c367-45c9-a050-988015c58bfc" />
</div>

# SettleSure: Payment Gateway Settlement Reconciliation

![Razorpay](https://img.shields.io/badge/Razorpay-072654?style=flat&logo=razorpay&logoColor=white)
![CI](https://github.com/Annieeeee11/SettleSure/actions/workflows/ci.yml/badge.svg)
![Node](https://img.shields.io/badge/node-%3E%3D18-brightgreen)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat&logo=typescript&logoColor=white)
![LLM agent](https://img.shields.io/badge/llm--agent-111827?style=flat&logo=openai&logoColor=white)
![Ollama](https://img.shields.io/badge/Ollama-000000?style=flat&logo=ollama&logoColor=white)

This is a Razorpay-style 3-way settlement reconciliation: Payments → Settlements (gross/fee/tax/net + UTR) → Bank payout credits. The deterministic engine (exact → fuzzy → split) earns 100% on the hard seed-42 batch; LLM and human tiers escalate genuinely ambiguous multi-solution splits — not recall crutches.

## 60-second demo

1. `npm install && npm run reconcile -- --seed 42 --skip-llm` generates the batch, runs exact → fuzzy → split, and prints the report.
2. `npm run dashboard` opens http://localhost:5173. You’ll see match rate, precision, recall, and FP rate by case difficulty, plus the full exception list with reasons.
3. In the dashboard, click **Accept** on one ambiguous exception, then **Re-run with corrections**. The human-resolved count should move from 0 to 1+ in the match-source chart.
4. `npm run reconcile -- --seed 42 --compare-llm --llm-provider ollama --llm-model llama3.2` shows residual LLM work on ambiguous splits (often `unsure` / 0–2 matches), side by side with skip-llm already at 100% (needs local Ollama).
<img width="1127" height="714" alt="image" src="https://github.com/user-attachments/assets/f152aa8f-94c8-4ab2-8ebc-366cd7854b5a" />

<img width="575" height="700" alt="SettleSure dashboard seed 42" src="docs/dashboard-seed42.png" />


---

**Seed 42 headline metrics** (`npm run reconcile -- --seed 42 --skip-llm`):

| Precision | Recall | FP rate | Exact / Fuzzy / Split / LLM / Human |
| ---: | ---: | ---: | ---: |
| 100.00% | 100.00% | 0.00% | 22 / 22 / 2 / 0 / 0 |

**LLM ablation** (`npm run reconcile -- --seed 42 --compare-llm --llm-provider ollama --llm-model qwen2.5-coder:7b`, measured run):

| | With LLM | Without LLM |
| --- | ---: | ---: |
| Match rate / Recall | 100.00% | 100.00% |
| Precision | 100.00% | 100.00% |
| FP rate | 0.00% | 0.00% |
| LLM matches | 0 | 0 |
| Provider | ollama (qwen2.5-coder:7b) | none |

2 LLM calls, both ambiguous splits honestly `unsure` — the tier fires and refuses to guess.

### Calibration margin

Fuzzy weights: amount **0.4** / date **0.3** / reference **0.3** (`src/engine/config.ts`); accept threshold **0.75**; truncated-UTR prefix floor **0.92**.

- Truncated true pair: amount=1, date=+3d → `dateScore = 1 - 3/4 = 0.25`, ref=0.92 → composite **0.4 + 0.075 + 0.276 = 0.751** (clears accept).
- Default decoy (`near_duplicate_decoy`): amount **±1.2%**, date **+2d**, weaker UTR → composite ~**0.586** (stays below 0.75).
- Closer decoys clear the 0.75 threshold — with the LLM tier enabled they land in the ambiguous band for LLM/human review; skip-llm they score as FPs (see grid). The ±0.5%/+1d cell also drops recall to **93.48%** because the accepted decoy steals the bank credit from the true pair.

Full grid: [`output/decoy-sweep.md`](output/decoy-sweep.md) (`npm run sweep-decoys`).

**Human loop:** Skip-llm is already at 100% recall; the human tier is for **ambiguous splits** the engine correctly refuses and LLM marks `unsure`. `npm run reconcile -- --seed 42 --skip-llm --apply-corrections` (or dashboard Accept → Re-run) shows **Human ≥ 1** in match sources via `data/demo_corrections.json`. Accepting a GT-`exception` row (ambiguous split) scores as an **FP by design** — GT says “do not auto-match”; the human override is still a useful ops demo.

```bash
npm install
npm run reconcile -- --seed 42 --skip-llm
npm run dashboard   # http://localhost:5173
```

Docker:

```bash
docker build -t settlesure .
docker run --rm settlesure
```

---

## Pipeline

1. **Payments**: gateway captures  
2. **Settlements**: fee/tax identity + UTR  
3. **Bank credits**: UTR join on net ≈ credited  
4. Passes: integrity → exact → fuzzy → split → LLM → human corrections  

Adversarial cases include near duplicate decoys, boundary reference mangles, decoy subset sums, and unresolvable noise. They’re scored with `ambiguityLevel` (`clear` / `boundary` / `decoy` / `unresolvable`). The dashboard shows that breakdown under the summary metrics.

## Human correction click-through

1. Run reconcile, then `npm run dashboard`.
2. On an ambiguous / exception row, click **Accept** (or **Reject**). The row greys out as “resolved — pending re-run” and the decision is appended to `output/corrections.json` via the Vite `/api/corrections` route.
3. Click **Re-run with corrections**. The dashboard runs `npm run reconcile -- --seed 42 --skip-llm --apply-corrections`, reloads `report.json`, and the match-source **human** bar becomes nonzero. That’s the closed finance-ops loop.

## Quick start

```bash
npm install
npm run reconcile -- --seed 42 --skip-llm
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

### Optional LLM pass

Provider selection order: `--llm-provider` → `ANTHROPIC_API_KEY` → Ollama → none.

```bash
npm run reconcile -- --seed 42 --compare-llm --llm-provider ollama --llm-model llama3.2
npm run reconcile -- --seed 42 --llm-provider ollama --llm-model llama3.2
npm run reconcile -- --seed 42 --runs 5 --skip-llm
npm run reconcile -- --seed 42 --skip-llm --apply-corrections
```

## Metrics (never blended)

Overall precision, recall, and FP rate are reported separately. You also get **Accuracy by case difficulty** (clear / boundary / decoy / unresolvable) in both `output/report.md` and the dashboard.

## Tests & CI

```bash
npm test
npm run reconcile -- --seed 42 --skip-llm
npm run check-baseline
```

## Known limitations

- Split matching is bounded (pool ≤25, combo ≤6)
- Ambiguous multi-solution batches are not auto-picked; they are routed to the LLM/human tier with the tied combinations listed
- No FX conversion
- Seed 42 skip-llm clears boundary via prefix-aware UTR floor 0.92; decoy deferral 16/16 at default ±1.2%/+2d. Residual LLM work is mainly ambiguous splits / unsure cases
- Duplicate bank credits: first claim (exact/fuzzy/split-pool enqueue) wins; same-UTR leftovers are blocked before split and flagged `duplicate_bank` (prevents coincidental subset-sum FPs)
- Measured `--compare-llm` with Ollama `qwen2.5-coder:7b`: 2 LLM calls on the ambiguous splits, both `unsure` (tier fires, refuses to guess); metrics stay 100/100/0. Prior Ollama run (before guards) lifted recall 91.30% → 95.65% on leftover fuzzy pairs — historical only
- Ollama LLM calls fix `temperature: 0` and pass the reconcile seed; Anthropic uses `temperature: 0`. Remaining variance is model/runtime behaviour, not unset sampling knobs
- Exception rows in the terminal/markdown report are grouped by `relatedIds` for display; `report.json` keeps per-record flags so scoring is unchanged
- Calibration margin and decoy-offset grid: see README Calibration margin and `output/decoy-sweep.md`

## What broke, and what we did about it

**The first version scored a perfect 100%.** Seed 42 came back with 100% match rate, precision, and recall, 0% false positives, and the LLM and human tiers never fired. On a track that cares about measured accuracy over a cherry-picked win, that looked like easy data, not a flawless engine. We rebuilt the generator with near duplicate decoys, boundary UTR mangles at the fuzzy threshold, and split batches with a coincidental decoy sum. That honest baseline sat at **~97.67% precision / 91.30% recall / 2.33% FP** until the duplicate-UTR split guard and prefix-floor 0.92 removed the last deterministic FP/FN — seed 42 skip-llm is again **100% / 100% / 0% FP**, but now against the hard generator.

**The first LLM ablation was a no-op.** `--compare-llm` printed the same numbers on both sides because both silently fell back to provider `none`. We ran it again against local Ollama (`llama3.2`): recall went from **91.30% → 95.65%**, correctly resolving **2 of 4** ambiguous pairs. The two false `no_match` calls are under Known Limitations instead of being swept under the rug.

Spotting a perfect score and a flat ablation as non results was the same kind of call as the metrics themselves: if the output looks too clean, treat it as a failure mode until the residual tiers have real work left.
