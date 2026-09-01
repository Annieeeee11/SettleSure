//! CSV ingestion and normalization for real settlement/bank/payment files.

mod bank_csv;
mod csv_util;
mod normalize;
mod payment_csv;
mod settlement_csv;

pub use bank_csv::parse_bank_csv;
pub use normalize::{normalize_header, normalize_utr, parse_date_flexible, strip_currency};
pub use payment_csv::parse_payment_csv;
pub use settlement_csv::parse_settlement_csv;

use settlesure_types::{BankCredit, Payment, Result, Settlement};
use std::path::Path;

/// Load all three CSV files required for real-data reconciliation.
pub fn load_csv_dataset(
    settlements_path: &Path,
    bank_path: &Path,
    payments_path: &Path,
) -> Result<CsvDataset> {
    Ok(CsvDataset {
        settlements: parse_settlement_csv(settlements_path)?,
        bank_credits: parse_bank_csv(bank_path)?,
        payments: parse_payment_csv(payments_path)?,
    })
}

#[derive(Debug, Clone)]
pub struct CsvDataset {
    pub payments: Vec<Payment>,
    pub settlements: Vec<Settlement>,
    pub bank_credits: Vec<BankCredit>,
}
