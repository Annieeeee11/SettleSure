# Payment Gateway Settlement Reconciliation Report

Razorpay-style 3-way flow: **Payment → Settlement → Bank payout credit** (UTR join).

Seed: `42` · Payments: 71 · Settlements: 71 · Bank credits: 57
LLM pass: enabled (ollama)

## Headline metrics

| Metric | Value |
| --- | --- |
| Match rate (recall on true matches) | 93.48% |
| Precision | 100.00% |
| Recall | 93.48% |
| False positive rate | 0.00% |
| Exception accuracy | 84.21% |
| Throughput | 0.57 records/sec |
| Runtime (total) | 223471.04 ms |

### Counts

- True matches in ground truth: 46
- Predicted matches: 43
- True positives: 43
- False positives: 0
- False negatives: 3
- True exception records: 32
- Predicted exception records: 38
- Correctly flagged exceptions: 32

## Match-source breakdown

| Pass | Count |
| --- | ---: |
| Exact | 20 |
| Fuzzy | 17 |
| Split | 2 |
| LLM | 4 |
| Human | 0 |

| Pass timing | ms |
| --- | ---: |
| Exact | 0.08 |
| Fuzzy | 5.51 |
| Split | 0.07 |
| LLM | 223454.72 |
| Total | 223471.04 |

## Accuracy by case difficulty

| Difficulty | Match rate | Precision | Deferred | Notes |
| --- | --- | --- | --- | --- |
| Clear | 100.00% | 100.00% | — | trivial exact/fuzzy cases |
| Boundary | 71.43% | 100.00% | — | at fuzzy threshold edge |
| Decoy | 66.67% | 100.00% | 100.00% | correctly deferred, not auto-resolved to decoy |
| Unresolvable | — | — | 100.00% | correctly flagged as exception |

## LLM ablation

| | With LLM | Without LLM |
| --- | ---: | ---: |
| Match rate | 93.48% | 84.78% |
| Precision | 100.00% | 100.00% |
| Recall | 93.48% | 84.78% |
| FP rate | 0.00% | 0.00% |
| LLM matches | 4 | 0 |
| Provider | ollama | none |

## Exception list

| Record ID(s) | Source | Reason |
| --- | --- | --- |
| setl_0062 | settlement | fee/tax miscalculation: netAmount 3935.4 ≠ gross(3974.78) - fee(75.07) - tax(13.51) = 3886.2 |
| setl_0063 | settlement | fee/tax miscalculation: netAmount 418.88 ≠ gross(396.38) - fee(6.63) - tax(1.19) = 388.56 |
| setl_0064 | settlement | fee/tax miscalculation: netAmount 2425.09 ≠ gross(2458.69) - fee(43.17) - tax(7.77) = 2407.75 |
| bank_0049 | bank | currency mismatch, not auto-resolved |
| bank_0050 | bank | currency mismatch, not auto-resolved |
| setl_0068 | settlement | currency mismatch, not auto-resolved |
| setl_0069 | settlement | currency mismatch, not auto-resolved |
| bank_0055 | bank | duplicate bank credit — UTR already settled by bank_0054 |
| bank_0057 | bank | duplicate bank credit — UTR already settled by bank_0056 |
| bank_0038, setl_0038, setl_0039 | bank+settlement | ambiguous — LLM declined — Insufficient evidence to determine match |
| bank_0039, setl_0040, setl_0041 | bank+settlement | ambiguous — LLM declined — Insufficient evidence to determine match |
| bank_0040, setl_0042, setl_0043 | bank+settlement | ambiguous — LLM declined — Insufficient evidence to determine match |
| bank_0045, setl_0054, setl_0055, setl_0056, setl_0057 | bank+settlement | ambiguous — LLM declined (split) — Insufficient evidence to determine the true batch |
| bank_0046, setl_0058, setl_0059, setl_0060, setl_0061 | bank+settlement | ambiguous — LLM declined (split) — Insufficient evidence to determine the true batch |
| bank_0047 | bank | no plausible counterpart in window |
| bank_0048 | bank | no plausible counterpart in window |
| bank_0051 | bank | no plausible counterpart in window |
| bank_0052 | bank | no plausible counterpart in window |
| bank_0053 | bank | no plausible counterpart in window |
| setl_0045 | settlement | settlement present, bank credit missing (payout may be in transit) |
| setl_0047 | settlement | settlement present, bank credit missing (payout may be in transit) |
| setl_0065 | settlement | settlement present, bank credit missing (payout may be in transit) |
| setl_0066 | settlement | settlement present, bank credit missing (payout may be in transit) |
| setl_0067 | settlement | settlement present, bank credit missing (payout may be in transit) |

_Grouped by relatedIds for display (24 groups from 38 per-record flags). Scoring still uses per-record exceptions._

## Known limitations

- Split matching uses bounded subset-sum (max pool 25, max combo 6) — demo-scale only.
- Ambiguous multi-solution batches are routed to the LLM/human tier (not auto-picked).
- No FX conversion — currency mismatches are never auto-resolved.
- Fuzzy matching uses net/credited amount, settlement/credit dates, and UTR similarity (prefix-aware).
- Duplicate bank credits: first claim (exact/fuzzy/split-pool enqueue) wins; same-UTR leftovers are blocked before split and flagged as exceptions.
- Near-duplicate decoys and boundary UTR mangles are intentional hard cases for LLM/human tiers.
- Ollama LLM calls use temperature 0 and a fixed seed for reproducibility; Anthropic uses temperature 0.
