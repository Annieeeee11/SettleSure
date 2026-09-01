# Payment Gateway Settlement Reconciliation Report

Razorpay-style 3-way flow: **Payment → Settlement → Bank payout credit** (UTR join).

Seed: `61` · Payments: 77 · Settlements: 77 · Bank credits: 60
LLM pass: disabled / unavailable

## Headline metrics

| Metric | Value |
| --- | --- |
| Match rate (recall on true matches) | 85.71% |
| Precision | 100.00% |
| Recall | 85.71% |
| False positive rate | 0.00% |
| Exception accuracy | 71.43% |
_Exception accuracy = correctly flagged ÷ predicted exceptions (precision on exceptions, not recall). Under `--skip-llm`, unresolved ambiguous GT matches inflate predicted exceptions (`ambiguous — LLM unavailable`), lowering this metric by design; with LLM enabled those cases resolve to matches._
| Throughput | 11159.99 records/sec |
| Runtime (total) | 12.28 ms |

### Counts

- True matches in ground truth: 49
- Predicted matches: 42
- True positives: 42
- False positives: 0
- False negatives: 7
- True exception records: 35
- Predicted exception records: 49
- Correctly flagged exceptions: 35

## Match-source breakdown

| Pass | Count |
| --- | ---: |
| Exact | 23 |
| Fuzzy | 17 |
| Split | 2 |
| LLM | 0 |
| Human | 0 |

| Pass timing | ms |
| --- | ---: |
| Exact | 1.06 |
| Fuzzy | 9.80 |
| Split | 0.32 |
| LLM | 0.08 |
| Total | 12.28 |

## Accuracy by case difficulty

| Difficulty | Match rate | Precision | Deferred | Notes |
| --- | --- | --- | --- | --- |
| Clear | 100.00% | 100.00% | — | trivial exact/fuzzy cases |
| Boundary | 42.86% | 100.00% | — | at fuzzy threshold edge |
| Decoy | 50.00% | 100.00% | 100.00% | correctly deferred, not auto-resolved to decoy |
| Unresolvable | — | — | 100.00% | correctly flagged as exception |

## Robustness across seeds

Seeds: 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61

| Metric | Mean | Std Dev | Min | Max |
| --- | ---: | ---: | ---: | ---: |
| Match rate | 85.71% | 0.00% | 85.71% | 85.71% |
| Precision | 100.00% | 0.00% | 100.00% | 100.00% |
| Recall | 85.71% | 0.00% | 85.71% | 85.71% |
| FP rate | 0.00% | 0.00% | 0.00% | 0.00% |

## Exception list

| Record ID(s) | Source | Reason |
| --- | --- | --- |
| setl_0068 | settlement | fee/tax miscalculation: netAmount 3410.86 ≠ gross(3433.21) - fee(63.98) - tax(11.52) = 3357.71 |
| setl_0069 | settlement | fee/tax miscalculation: netAmount 3715.64 ≠ gross(3767.15) - fee(68.67) - tax(12.36) = 3686.12 |
| setl_0070 | settlement | fee/tax miscalculation: netAmount 3661.13 ≠ gross(3731.02) - fee(77.6) - tax(13.97) = 3639.45 |
| bank_0052 | bank | currency mismatch, not auto-resolved |
| bank_0053 | bank | currency mismatch, not auto-resolved |
| setl_0074 | settlement | currency mismatch, not auto-resolved |
| setl_0075 | settlement | currency mismatch, not auto-resolved |
| bank_0058 | bank | duplicate bank credit — UTR already settled by bank_0057 |
| bank_0060 | bank | duplicate bank credit — UTR already settled by bank_0059 |
| bank_0036, setl_0036 | bank+settlement | ambiguous — LLM unavailable |
| bank_0037, setl_0037 | bank+settlement | ambiguous — LLM unavailable |
| bank_0038, setl_0038, setl_0039 | bank+settlement | ambiguous — LLM unavailable |
| bank_0039, setl_0040, setl_0041 | bank+settlement | ambiguous — LLM unavailable |
| bank_0040, setl_0042, setl_0043 | bank+settlement | ambiguous — LLM unavailable |
| bank_0041, setl_0044, setl_0045 | bank+settlement | ambiguous — LLM unavailable |
| bank_0042, setl_0046, setl_0047 | bank+settlement | ambiguous — LLM unavailable |
| bank_0048, setl_0060, setl_0061, setl_0062, setl_0063 | bank+settlement | ambiguous split — LLM unavailable: ambiguous split — multiple settlement combinations sum to credit: setl_0060+setl_0061 \| setl_0062+setl_0063 |
| bank_0049, setl_0064, setl_0065, setl_0066, setl_0067 | bank+settlement | ambiguous split — LLM unavailable: ambiguous split — multiple settlement combinations sum to credit: setl_0064+setl_0065 \| setl_0066+setl_0067 |
| bank_0050 | bank | no plausible counterpart in window |
| bank_0051 | bank | no plausible counterpart in window |
| bank_0054 | bank | no plausible counterpart in window |
| bank_0055 | bank | no plausible counterpart in window |
| bank_0056 | bank | no plausible counterpart in window |
| setl_0049 | settlement | settlement present, bank credit missing (payout may be in transit) |
| setl_0051 | settlement | settlement present, bank credit missing (payout may be in transit) |
| setl_0053 | settlement | settlement present, bank credit missing (payout may be in transit) |
| setl_0071 | settlement | settlement present, bank credit missing (payout may be in transit) |
| setl_0072 | settlement | settlement present, bank credit missing (payout may be in transit) |
| setl_0073 | settlement | settlement present, bank credit missing (payout may be in transit) |

_Grouped by relatedIds for display (29 groups from 49 per-record flags). Scoring still uses per-record exceptions._

## Known limitations

- Real CSV ingestion supports YYYY-MM-DD, DD/MM/YYYY, and DD-MM-YYYY dates only (US MM/DD/YYYY not supported).
- Split matching uses amount-bucketed subset-sum (max pool 100, max combo 8) with meet-in-the-middle for large pools.
- Ambiguous multi-solution batches are routed to the LLM/human tier (not auto-picked).
- No FX conversion — currency mismatches are never auto-resolved.
- Fuzzy matching uses net/credited amount, settlement/credit dates, and UTR similarity (prefix-aware).
- Duplicate bank credits: first claim (exact/fuzzy/split-pool enqueue) wins; same-UTR leftovers are blocked before split and flagged as exceptions.
- Near-duplicate decoys and boundary UTR mangles are intentional hard cases for LLM/human tiers.
- Ollama LLM calls use temperature 0 and a fixed seed for reproducibility; Anthropic uses temperature 0.
