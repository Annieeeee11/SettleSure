import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  CsvValidationError,
  MAX_BATCH_RECORDS,
  parseBankCsv,
  parseCsvBatch,
  parsePaymentsCsv,
  parseSettlementsCsv,
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

  it("accepts alternate settlement and bank column names", () => {
    const settlements = parseSettlementsCsv(
      "settlement_id,payment_id,gross_amount,fee,tax,net_amount,settled_at,utr_reference\n" +
        "set_1,pay_1,1000,20,4,976,2025-01-11,001234567890",
    );
    expect(settlements[0]).toMatchObject({
      utr: "001234567890",
      netAmount: 976,
    });

    const bank = parseBankCsv(
      "bank_txn_id,utr_number,amount,credit_date\n" +
        "txn_1,001234567890,976,2025-01-12",
    );
    expect(bank[0]).toMatchObject({
      id: "txn_1",
      utr: "001234567890",
      creditedAmount: 976,
      creditedAt: "2025-01-12",
    });
  });
});
