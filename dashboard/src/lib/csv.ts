import Papa from "papaparse";
import type {
  BankTransaction,
  Payment,
  PaymentStatus,
  ReconcileRequest,
  Settlement,
} from "../types";

export const MAX_BATCH_RECORDS = 20_000;

type Row = Record<string, string>;

export class CsvValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CsvValidationError";
  }
}

function normalizeHeader(header: string): string {
  return header.trim().toLowerCase().replace(/[ -]/g, "_");
}

function parseRows(csv: string, label: string): Row[] {
  const result = Papa.parse<Row>(csv, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: normalizeHeader,
    transform: (value) => value.trim(),
  });
  if (result.errors.length > 0) {
    const issue = result.errors[0];
    throw new CsvValidationError(
      `${label} CSV row ${(issue.row ?? 0) + 2}: ${issue.message}`,
    );
  }
  if (result.data.length === 0) {
    throw new CsvValidationError(`${label} CSV has no data rows`);
  }
  return result.data;
}

function value(
  row: Row,
  aliases: string[],
  field: string,
  line: number,
  optional = false,
): string {
  for (const alias of aliases) {
    const found = row[alias]?.trim();
    if (found) return found;
  }
  if (optional) return "";
  throw new CsvValidationError(
    `Row ${line}: missing ${field} (accepted columns: ${aliases.join(", ")})`,
  );
}

function amount(raw: string, field: string, line: number): number {
  const cleaned = raw
    .trim()
    .replace(/^[₹$€]/, "")
    .replace(/,/g, "")
    .trim();
  const parsed = Number(cleaned);
  if (!cleaned || !Number.isFinite(parsed)) {
    throw new CsvValidationError(
      `Row ${line}: invalid ${field} amount ${JSON.stringify(raw)}`,
    );
  }
  return parsed;
}

function date(raw: string, field: string, line: number): string {
  const input = raw.trim();
  let year: number;
  let month: number;
  let day: number;
  let match = input.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) {
    [, year, month, day] = match.map(Number);
  } else {
    match = input.match(/^(\d{2})[/-](\d{2})[/-](\d{4})$/);
    if (!match) {
      throw new CsvValidationError(
        `Row ${line}: unsupported ${field} date ${JSON.stringify(raw)}`,
      );
    }
    [, day, month, year] = match.map(Number);
  }
  const candidate = new Date(Date.UTC(year, month - 1, day));
  if (
    candidate.getUTCFullYear() !== year ||
    candidate.getUTCMonth() !== month - 1 ||
    candidate.getUTCDate() !== day
  ) {
    throw new CsvValidationError(
      `Row ${line}: invalid ${field} date ${JSON.stringify(raw)}`,
    );
  }
  return `${year.toString().padStart(4, "0")}-${month
    .toString()
    .padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
}

function currency(row: Row): string {
  return (row.currency || row.curr || "INR").trim().toUpperCase();
}

function paymentStatus(raw: string): PaymentStatus {
  const status = raw.trim().toLowerCase();
  if (status === "failed" || status === "failure") return "failed";
  if (status === "refunded" || status === "refund") return "refunded";
  return "captured";
}

export function parsePaymentsCsv(csv: string): Payment[] {
  return parseRows(csv, "Payments").map((row, index) => {
    const line = index + 2;
    return {
      paymentId: value(row, ["payment_id", "paymentid", "id"], "payment_id", line),
      orderId: value(row, ["order_id", "orderid"], "order_id", line),
      amount: amount(
        value(row, ["amount", "gross_amount"], "amount", line),
        "amount",
        line,
      ),
      currency: currency(row),
      status: paymentStatus(
        value(row, ["status", "payment_status"], "status", line, true) ||
          "captured",
      ),
      createdAt: date(
        value(
          row,
          ["created_at", "date", "payment_date", "created"],
          "created_at",
          line,
        ),
        "created_at",
        line,
      ),
    };
  });
}

export function parseSettlementsCsv(csv: string): Settlement[] {
  return parseRows(csv, "Settlements").map((row, index) => {
    const line = index + 2;
    return {
      settlementId: value(
        row,
        ["settlement_id", "settlementid", "id"],
        "settlement_id",
        line,
      ),
      paymentId: value(row, ["payment_id", "paymentid"], "payment_id", line),
      grossAmount: amount(
        value(row, ["gross_amount", "amount", "gross"], "gross_amount", line),
        "gross_amount",
        line,
      ),
      fee: amount(value(row, ["fee", "fees"], "fee", line, true) || "0", "fee", line),
      tax: amount(value(row, ["tax", "gst"], "tax", line, true) || "0", "tax", line),
      netAmount: amount(
        value(row, ["net_amount", "net", "settled_amount"], "net_amount", line),
        "net_amount",
        line,
      ),
      settledAt: date(
        value(row, ["settled_at", "settlement_date", "date"], "settled_at", line),
        "settled_at",
        line,
      ),
      utr: value(
        row,
        [
          "utr",
          "settlement_utr",
          "reference",
          "utr_reference",
          "bank_reference",
          "bank_ref",
        ],
        "utr",
        line,
      ),
      currency: currency(row),
    };
  });
}

export function parseBankCsv(csv: string): BankTransaction[] {
  return parseRows(csv, "Bank").map((row, index) => {
    const line = index + 2;
    const utr = value(
      row,
      [
        "reference",
        "utr",
        "ref",
        "transaction_ref",
        "narration_ref",
        "utr_number",
        "utr_reference",
        "bank_reference",
      ],
      "reference/utr",
      line,
    );
    const credit =
      value(
        row,
        [
          "credit_amount",
          "credited_amount",
          "credit",
          "cr",
          "amount",
          "transaction_amount",
        ],
        "credit_amount",
        line,
        true,
      ) ||
      value(
        row,
        ["debit_amount", "debit", "dr"],
        "debit_amount",
        line,
        true,
      );
    if (!credit) {
      throw new CsvValidationError(
        `Row ${line}: missing credit_amount or debit_amount (accepted columns: credit_amount, credited_amount, credit, cr, amount, transaction_amount, debit_amount, debit, dr)`,
      );
    }
    return {
      id:
        value(
          row,
          ["id", "transaction_id", "txn_id", "bank_txn_id", "bank_transaction_id"],
          "id",
          line,
          true,
        ) || `bank_${index + 1}_${utr}`,
      utr,
      creditedAmount: amount(credit, "credit_amount", line),
      creditedAt: date(
        value(
          row,
          [
            "date",
            "credited_at",
            "transaction_date",
            "txn_date",
            "credit_date",
            "value_date",
          ],
          "credited_at",
          line,
        ),
        "credited_at",
        line,
      ),
      currency: currency(row),
    };
  });
}

export function parseCsvBatch(input: {
  payments: string;
  settlements: string;
  bank: string;
}): ReconcileRequest {
  const batch = {
    payments: parsePaymentsCsv(input.payments),
    settlements: parseSettlementsCsv(input.settlements),
    bankTransactions: parseBankCsv(input.bank),
  };
  const total =
    batch.payments.length +
    batch.settlements.length +
    batch.bankTransactions.length;
  if (total > MAX_BATCH_RECORDS) {
    throw new CsvValidationError(
      `Batch has ${total.toLocaleString()} records; the API limit is ${MAX_BATCH_RECORDS.toLocaleString()}.`,
    );
  }
  return batch;
}
