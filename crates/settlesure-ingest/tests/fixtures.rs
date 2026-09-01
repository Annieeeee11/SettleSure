//! Integration tests for real CSV fixtures.

use settlesure_ingest::load_csv_dataset;
use settlesure_engine::reconcile_skip_llm;
use settlesure_scoring::score_operational_with_banks;
use settlesure_types::DEFAULT_CONFIG;
use std::path::PathBuf;

fn fixture_dir() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("../../fixtures/real")
}

#[test]
fn loads_messy_fixture_csvs() {
    let dir = fixture_dir();
    let csv = load_csv_dataset(
        &dir.join("settlements.csv"),
        &dir.join("bank.csv"),
        &dir.join("payments.csv"),
    )
    .expect("fixture CSVs should parse");
    assert_eq!(csv.payments.len(), 3);
    assert_eq!(csv.settlements.len(), 3);
    assert_eq!(csv.bank_credits.len(), 3);
    assert_eq!(csv.settlements[0].utr, "001234567890");
    assert_eq!(csv.settlements[0].settled_at, "2025-01-15");
}

#[test]
fn reconciles_fixture_csvs_end_to_end() {
    let dir = fixture_dir();
    let csv = load_csv_dataset(
        &dir.join("settlements.csv"),
        &dir.join("bank.csv"),
        &dir.join("payments.csv"),
    )
    .unwrap();
    let result = reconcile_skip_llm(
        &csv.payments,
        &csv.settlements,
        &csv.bank_credits,
        &DEFAULT_CONFIG,
        &[],
    );
    let report = score_operational_with_banks(&result, &csv.bank_credits, 0, false, "none");
    assert_eq!(report.predicted_match_count, 3);
    assert_eq!(result.exceptions.len(), 0);
}
