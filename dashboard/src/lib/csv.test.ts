import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  CsvValidationError,
  MAX_BATCH_RECORDS,
  parseCsvBatch,
  parsePaymentsCsv,
} from "./csv";

function fixture(name: string): string {
  return readFileSync(
    new URL(`../../../fixtures/real/${name}`, import.meta.url),
    "utf8",
  );
}

describe("CSV normalization", () => {
  it("converts the real fixtures into an API request", () => {
    const batch = parseCsvBatch({
      payments: fixture("payments.csv"),
      settlements: fixture("settlements.csv"),
      bank: fixture("bank.csv"),
    });

    expect(batch.payments).toHaveLength(3);
    expect(batch.payments[0]).toMatchObject({
      paymentId: "pay_001",
      amount: 1000,
      createdAt: "2025-01-10",
    });
    expect(batch.settlements[0]).toMatchObject({
      netAmount: 976,
      utr: "001234567890",
    });
    expect(batch.bankTransactions[0]).toMatchObject({
      id: "bank_1_001234567890",
      creditedAmount: 976,
    });
  });

  it("reports row-specific validation errors", () => {
    expect(() =>
      parsePaymentsCsv(
        "payment_id,order_id,amount,created_at\npay_1,ord_1,nope,2025-01-01",
      ),
    ).toThrow(/Row 2: invalid amount/);
  });

  it("rejects invalid dates", () => {
    expect(() =>
      parsePaymentsCsv(
        "payment_id,order_id,amount,created_at\npay_1,ord_1,10,31/02/2025",
      ),
    ).toThrow(CsvValidationError);
  });

  it("exports the same batch cap as the API", () => {
    expect(MAX_BATCH_RECORDS).toBe(20_000);
  });
});
