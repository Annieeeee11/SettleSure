//! Razorpay-style settlement CSV parser.

use settlesure_types::{Result, Settlement};
use std::path::Path;

use crate::csv_util::read_csv_table;
use crate::normalize::{get_col, get_col_opt, normalize_utr, parse_amount, parse_date_flexible};

pub fn parse_settlement_csv(path: &Path) -> Result<Vec<Settlement>> {
    let table = read_csv_table(path)?;
    let mut out = Vec::with_capacity(table.records.len());

    for (i, row) in table.records.iter().enumerate() {
        let line = i + 2; // 1-based, account for header row
        let settlement_id = get_col(
            row,
            &table.headers,
            &["settlement_id", "settlementid", "id"],
            "settlement_id",
            line,
        )?
        .to_string();
        let payment_id = get_col(
            row,
            &table.headers,
            &["payment_id", "paymentid"],
            "payment_id",
            line,
        )?
        .to_string();
        let gross_amount = parse_amount(
            get_col(
                row,
                &table.headers,
                &["gross_amount", "amount", "gross"],
                "gross_amount",
                line,
            )?,
            "gross_amount",
            line,
        )?;
        let fee = parse_amount(
            get_col_opt(row, &table.headers, &["fee", "fees"])
                .unwrap_or("0"),
            "fee",
            line,
        )?;
        let tax = parse_amount(
            get_col_opt(row, &table.headers, &["tax", "gst"])
                .unwrap_or("0"),
            "tax",
            line,
        )?;
        let net_amount = parse_amount(
            get_col(
                row,
                &table.headers,
                &["net_amount", "net", "settled_amount"],
                "net_amount",
                line,
            )?,
            "net_amount",
            line,
        )?;
        let settled_at = parse_date_flexible(
            get_col(
                row,
                &table.headers,
                &["settled_at", "settlement_date", "date"],
                "settled_at",
                line,
            )?,
            "settled_at",
            line,
        )?;
        let utr = normalize_utr(get_col(
            row,
            &table.headers,
            &["utr", "settlement_utr", "reference"],
            "utr",
            line,
        )?);
        let currency = get_col_opt(row, &table.headers, &["currency", "curr"])
            .unwrap_or("INR")
            .to_uppercase();

        out.push(Settlement {
            settlement_id,
            payment_id,
            gross_amount,
            fee,
            tax,
            net_amount,
            settled_at,
            utr,
            currency,
        });
    }

    Ok(out)
}
