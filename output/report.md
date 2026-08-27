# Payment Gateway Settlement Reconciliation Report

Razorpay-style 3-way flow: **Payment → Settlement → Bank payout credit** (UTR join).

Seed: `42` · Payments: 77 · Settlements: 77 · Bank credits: 60
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
| Throughput | 94678.65 records/sec |
| Runtime (total) | 1.45 ms |

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
| Exact | 0.10 |
| Fuzzy | 0.70 |
| Split | 0.09 |
| LLM | 0.12 |
| Total | 1.45 |

## Accuracy by case difficulty

| Difficulty | Match rate | Precision | Deferred | Notes |
| --- | --- | --- | --- | --- |
| Clear | 100.00% | 100.00% | — | trivial exact/fuzzy cases |
| Boundary | 42.86% | 100.00% | — | at fuzzy threshold edge |
| Decoy | 50.00% | 100.00% | 100.00% | correctly deferred, not auto-resolved to decoy |
| Unresolvable | — | — | 100.00% | correctly flagged as exception |

## Exception list

| Record ID(s) | Source | Reason |
| --- | --- | --- |
| setl_0068 | settlement | fee/tax miscalculation: netAmount 4127.24 ≠ gross(4192.03) - fee(80.05) - tax(14.41) = 4097.57 |
| setl_0069 | settlement | fee/tax miscalculation: netAmount 361.74 ≠ gross(317.58) - fee(5.04) - tax(0.91) = 311.63 |
| setl_0070 | settlement | fee/tax miscalculation: netAmount 1521.51 ≠ gross(1509.65) - fee(36.16) - tax(6.51) = 1466.98 |
| bank_0052 | bank | currency mismatch, not auto-resolved |
| bank_0053 | bank | currency mismatch, not auto-resolved |
| setl_0074 | settlement | currency mismatch, not auto-resolved |
| setl_0075 | settlement | currency mismatch, not auto-resolved |
| bank_0058 | bank | duplicate bank credit — UTR already settled by bank_0057 |
| bank_0060 | bank | duplicate bank credit — UTR already settled by bank_0059 |
| bank_0036, setl_0036 | bank+settlement | ambiguous — LLM unavailable |
| bank_0037, setl_0037 | bank+settlement | ambiguous — LLM unavailable |
| bank_0038, setl_0038, bank_0048, bank_0050, setl_0039, setl_0060, setl_0061, setl_0062, setl_0063 | bank+settlement | ambiguous — LLM unavailable |
| bank_0039, setl_0040, setl_0041 | bank+settlement | ambiguous — LLM unavailable |
| bank_0040, setl_0042, setl_0043 | bank+settlement | ambiguous — LLM unavailable |
| bank_0041, setl_0044, setl_0045 | bank+settlement | ambiguous — LLM unavailable |
| bank_0042, setl_0046, setl_0047 | bank+settlement | ambiguous — LLM unavailable |
| bank_0049, setl_0064, setl_0065, setl_0066, setl_0067 | bank+settlement | ambiguous split — LLM unavailable: ambiguous split — multiple settlement combinations sum to credit: setl_0064+setl_0065 \| setl_0066+setl_0067 |
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

_Grouped by relatedIds for display (27 groups from 49 per-record flags). Scoring still uses per-record exceptions._

## Known limitations

- Split matching uses bounded subset-sum (max pool 25, max combo 6) — demo-scale only.
- Ambiguous multi-solution batches are routed to the LLM/human tier (not auto-picked).
- No FX conversion — currency mismatches are never auto-resolved.
- Fuzzy matching uses net/credited amount, settlement/credit dates, and UTR similarity (prefix-aware).
- Duplicate bank credits: first claim (exact/fuzzy/split-pool enqueue) wins; same-UTR leftovers are blocked before split and flagged as exceptions.
- Near-duplicate decoys and boundary UTR mangles are intentional hard cases for LLM/human tiers.
- Ollama LLM calls use temperature 0 and a fixed seed for reproducibility; Anthropic uses temperature 0.
