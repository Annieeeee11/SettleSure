# Near-duplicate decoy offset sweep

Seed **42**, `--skip-llm`. Varies decoy amount delta and date offset;
true settlement defaults to **+3d**. Default decoy cell is **±1.2% / +2d**.

| Amount Δ | Date offset (d) | Decoy deferral | FP rate | Precision | Recall |
| ---: | ---: | ---: | ---: | ---: | ---: |
| ±0.5% | 1 | 10/16 | 6.52% | 93.48% | 93.48% |
| ±0.5% | 2 | 16/16 | 0.00% | 100.00% | 100.00% |
| ±0.5% | 3 | 16/16 | 0.00% | 100.00% | 100.00% |
| ±1.0% | 1 | 16/16 | 0.00% | 100.00% | 100.00% |
| ±1.0% | 2 | 16/16 | 0.00% | 100.00% | 100.00% |
| ±1.0% | 3 | 16/16 | 0.00% | 100.00% | 100.00% |
| ±1.2% | 1 | 16/16 | 0.00% | 100.00% | 100.00% |
| ±1.2% | 2 | 16/16 | 0.00% | 100.00% | 100.00% |
| ±1.2% | 3 | 16/16 | 0.00% | 100.00% | 100.00% |
| ±1.5% | 1 | 16/16 | 0.00% | 100.00% | 100.00% |
| ±1.5% | 2 | 16/16 | 0.00% | 100.00% | 100.00% |
| ±1.5% | 3 | 16/16 | 0.00% | 100.00% | 100.00% |
| ±2.0% | 1 | 16/16 | 0.00% | 100.00% | 100.00% |
| ±2.0% | 2 | 16/16 | 0.00% | 100.00% | 100.00% |
| ±2.0% | 3 | 16/16 | 0.00% | 100.00% | 100.00% |

### True-settlement date offset (default decoy ±1.2% / +2d)

The 0.751 accept margin also rests on the true pair’s **+3d** date offset;
+4d would put true pairs at ~0.676 → FN.

| True date offset (d) | Decoy deferral | FP rate | Precision | Recall |
| ---: | ---: | ---: | ---: | ---: |
| 3 | 16/16 | 0.00% | 100.00% | 100.00% |
| 4 | 16/16 | 0.00% | 100.00% | 93.48% |
| 5 | 16/16 | 0.00% | 100.00% | 93.48% |

Closer decoys clear the 0.75 threshold — with the LLM tier enabled they land
in the ambiguous band for LLM/human review; skip-llm they score as FPs (see grid).
The ±0.5%/+1d cell also drops recall to **93.48%** because the accepted decoy
steals the bank credit from the true pair.
