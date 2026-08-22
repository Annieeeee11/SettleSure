import { describe, expect, it } from "vitest";
import { generateDataset } from "../src/data/generate.js";
import type { AmbiguityLevel } from "../src/data/types.js";
import { reconcile } from "../src/engine/reconcile.js";
import { scoreAgainstGroundTruth } from "../src/scoring/metrics.js";

const LEVELS: AmbiguityLevel[] = [
  "clear",
  "boundary",
  "decoy",
  "unresolvable",
];

describe("reconcile e2e (seed 42, skip-llm)", () => {
  it("meets baseline gates and reports each difficulty slice", async () => {
    const dataset = generateDataset(42);
    const result = await reconcile(
      dataset.payments,
      dataset.settlements,
      dataset.bankCredits,
      { skipLlm: true, seed: 42 },
    );
    const metrics = scoreAgainstGroundTruth(
      result,
      dataset.groundTruth,
      42,
      false,
      "none",
    );

    expect(metrics.precision).toBe(1);
    expect(metrics.falsePositiveRate).toBe(0);
    expect(metrics.recall).toBeGreaterThanOrEqual(0.88);
    expect(metrics.matchRate).toBeGreaterThanOrEqual(0.88);

    for (const level of LEVELS) {
      const slice = metrics.byAmbiguityLevel[level];
      expect(slice, `missing slice ${level}`).toBeDefined();
      expect(typeof slice.matchRate).toBe("number");
      expect(typeof slice.precision).toBe("number");
      expect(typeof slice.recall).toBe("number");
    }

    const decoy = metrics.byAmbiguityLevel.decoy;
    if (decoy.deferredTotal && decoy.deferredTotal > 0) {
      expect(decoy.correctlyDeferred).toBe(decoy.deferredTotal);
    }
  });

  it("does not split-match duplicate bank_0057; emits duplicate_bank", async () => {
    const dataset = generateDataset(42);
    const result = await reconcile(
      dataset.payments,
      dataset.settlements,
      dataset.bankCredits,
      { skipLlm: true, seed: 42 },
    );

    expect(
      result.matches.some((m) => m.bankCreditId === "bank_0057"),
    ).toBe(false);

    const ex = result.exceptions.find((e) => e.recordId === "bank_0057");
    expect(ex).toBeDefined();
    expect(ex?.exceptionType).toBe("duplicate_bank");
    expect(ex?.source).toBe("bank");
    expect(ex?.reason).toMatch(/duplicate bank credit/i);
  });

  it("reserves UTR on split-pool enqueue so same-UTR leftovers cannot both match", async () => {
    const date = "2025-01-15";
    const payments = [
      {
        orderId: "order_1",
        paymentId: "pay_1",
        amount: 102.36,
        currency: "INR",
        status: "captured" as const,
        createdAt: date,
      },
      {
        orderId: "order_2",
        paymentId: "pay_2",
        amount: 51.18,
        currency: "INR",
        status: "captured" as const,
        createdAt: date,
      },
      {
        orderId: "order_3",
        paymentId: "pay_3",
        amount: 51.18,
        currency: "INR",
        status: "captured" as const,
        createdAt: date,
      },
    ];
    const settlements = [
      {
        settlementId: "setl_1",
        paymentId: "pay_1",
        grossAmount: 102.36,
        fee: 2,
        tax: 0.36,
        netAmount: 100,
        settledAt: date,
        utr: "SETL_UTR_AAAA",
        currency: "INR",
      },
      {
        settlementId: "setl_2",
        paymentId: "pay_2",
        grossAmount: 51.18,
        fee: 1,
        tax: 0.18,
        netAmount: 50,
        settledAt: date,
        utr: "SETL_UTR_BBBB",
        currency: "INR",
      },
      {
        settlementId: "setl_3",
        paymentId: "pay_3",
        grossAmount: 51.18,
        fee: 1,
        tax: 0.18,
        netAmount: 50,
        settledAt: date,
        utr: "SETL_UTR_CCCC",
        currency: "INR",
      },
    ];
    // Same UTR, both survive exact/fuzzy (UTR ≠ settlements) into split pool.
    const bankCredits = [
      {
        id: "bank_dup_a",
        utr: "SHARED_UTR_999",
        creditedAmount: 100,
        creditedAt: date,
        currency: "INR",
      },
      {
        id: "bank_dup_b",
        utr: "SHARED_UTR_999",
        creditedAmount: 100,
        creditedAt: date,
        currency: "INR",
      },
    ];

    const result = await reconcile(payments, settlements, bankCredits, {
      skipLlm: true,
      seed: 42,
    });

    const matchedDup = result.matches.filter((m) =>
      m.bankCreditId.startsWith("bank_dup_"),
    );
    expect(matchedDup.length).toBeLessThanOrEqual(1);

    const dupEx = result.exceptions.find(
      (e) =>
        e.exceptionType === "duplicate_bank" &&
        e.recordId.startsWith("bank_dup_"),
    );
    expect(dupEx).toBeDefined();
    expect(dupEx?.relatedIds?.[0]).toMatch(/^bank_dup_/);
  });
});
