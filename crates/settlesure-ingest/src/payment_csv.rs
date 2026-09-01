//! Gateway payment CSV parser.

use settlesure_types::{Payment, PaymentStatus, Result};
use std::path::Path;

use crate::csv_util::read_csv_table;
use crate::normalize::{get_col, get_col_opt, parse_amount, parse_date_flexible};

fn parse_status(s: &str) -> PaymentStatus {
    match s.trim().to_lowercase().as_str() {
        "failed" | "failure" => PaymentStatus::Failed,
        "refunded" | "refund" => PaymentStatus::Refunded,
        _ => PaymentStatus::Captured,
    }
}

pub fn parse_payment_csv(path: &Path) -> Result<Vec<Payment>> {
    let table = read_csv_table(path)?;
    let mut out = Vec::with_capacity(table.records.len());

    for (i, row) in table.records.iter().enumerate() {
        let line = i + 2;
        let payment_id = get_col(
            row,
            &table.headers,
            &["payment_id", "paymentid", "id"],
            "payment_id",
            line,
        )?
        .to_string();
        let order_id = get_col(
            row,
            &table.headers,
            &["order_id", "orderid"],
            "order_id",
            line,
        )?
        .to_string();
        let amount = parse_amount(
            get_col(row, &table.headers, &["amount", "gross_amount"], "amount", line)?,
            "amount",
            line,
        )?;
        let currency = get_col_opt(row, &table.headers, &["currency", "curr"])
            .unwrap_or("INR")
            .to_uppercase();
        let status = parse_status(
            get_col_opt(row, &table.headers, &["status", "payment_status"])
                .unwrap_or("captured"),
        );
        let created_at = parse_date_flexible(
            get_col(
                row,
                &table.headers,
                &["created_at", "date", "payment_date", "created"],
                "created_at",
                line,
            )?,
            "created_at",
            line,
        )?;

        out.push(Payment {
            order_id,
            payment_id,
            amount,
            currency,
            status,
            created_at,
        });
    }

    Ok(out)
}
