//! Generic bank statement CSV parser.

use settlesure_types::{BankCredit, Result};
use std::path::Path;

use crate::csv_util::read_csv_table;
use crate::normalize::{get_col, get_col_opt, normalize_utr, parse_amount, parse_date_flexible};

pub fn parse_bank_csv(path: &Path) -> Result<Vec<BankCredit>> {
    let table = read_csv_table(path)?;
    let mut out = Vec::with_capacity(table.records.len());

    for (i, row) in table.records.iter().enumerate() {
        let line = i + 2;
        let credited_at = parse_date_flexible(
            get_col(
                row,
                &table.headers,
                &["date", "credited_at", "transaction_date", "txn_date"],
                "date",
                line,
            )?,
            "date",
            line,
        )?;
        let utr = normalize_utr(get_col(
            row,
            &table.headers,
            &["reference", "utr", "ref", "transaction_ref", "narration_ref"],
            "reference/utr",
            line,
        )?);

        let credit_str = get_col_opt(
            row,
            &table.headers,
            &["credit_amount", "credited_amount", "credit", "cr"],
        );
        let debit_str = get_col_opt(row, &table.headers, &["debit_amount", "debit", "dr"]);

        let credited_amount = match (credit_str, debit_str) {
            (Some(c), _) if !c.trim().is_empty() => parse_amount(c, "credit_amount", line)?,
            (_, Some(d)) if !d.trim().is_empty() => {
                let debit = parse_amount(d, "debit_amount", line)?;
                if debit == 0.0 {
                    return Err(settlesure_types::SettleSureError::Message(format!(
                        "line {line}: zero debit amount"
                    )));
                }
                debit
            }
            _ => {
                return Err(settlesure_types::SettleSureError::Message(format!(
                    "line {line}: missing credit_amount or debit_amount"
                )));
            }
        };

        let id = get_col_opt(row, &table.headers, &["id", "transaction_id", "txn_id"])
            .map(|s| s.to_string())
            .unwrap_or_else(|| format!("bank_{}_{}", i + 1, utr));

        let currency = get_col_opt(row, &table.headers, &["currency", "curr"])
            .unwrap_or("INR")
            .to_uppercase();

        out.push(BankCredit {
            id,
            utr,
            credited_amount,
            credited_at,
            currency,
        });
    }

    Ok(out)
}
