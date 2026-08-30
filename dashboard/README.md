# SettleSure Dashboard

React + Vite ops view for reconciliation reports. Reads `public/report.json` (sync from repo root via `npm run sync-report`).

## Run locally

```bash
# From repo root — regenerate baseline report first
npm run sync-report
npm run dashboard   # http://localhost:5173
```

If the dashboard shows stale metrics (e.g. Human > 0 on a skip-llm baseline), re-run `npm run sync-report` from the repo root.

## Panels

| Panel | Content |
| --- | --- |
| Headline metrics | Match rate, precision, recall, FP rate, throughput |
| By difficulty | Clear / boundary / decoy / unresolvable slices |
| Match sources | Exact / fuzzy / split / LLM / human bar chart |
| LLM ablation | Side-by-side when `metrics.llmAblation` is present (use `report-llm.json` or `--compare-llm` output) |
| Exceptions | Filterable list with Accept/Reject and reason expansion |
| Matches | Inspector with pass, confidence, and reasoning |

## Human loop (dev only)

- **Accept** on an exception → writes to `output/corrections.json`
- **Re-run with corrections** → shells out to `cargo run ... --apply-corrections` and refreshes `public/report.json`

Note: corrections demo intentionally may lower precision (FP by design on GT-exception rows). Do not use this run for Track 04 headline screenshots.

## Dev API (`vite.config.ts`)

| Route | Method | Purpose |
| --- | --- | --- |
| `/api/corrections` | GET/POST | Read/write corrections file |
| `/api/rerun` | POST | Reconcile with corrections applied |

Requires local Rust toolchain for `/api/rerun`. Docker Compose runs engine + dashboard separately (see root README).
