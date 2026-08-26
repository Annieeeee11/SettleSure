//! Benchmark exact + fuzzy + split passes on pre-generated data/*.json (no regeneration).
//! Usage: cargo run --release -p settlesure-cli --example bench_deterministic -- [data_dir]

use settlesure_engine::reconcile_skip_llm;
use settlesure_types::{
    BankCredit, Correction, Payment, ReconcileConfig, Settlement, DEFAULT_CONFIG,
};
use std::env;
use std::fs;
use std::path::PathBuf;

fn load_json<T: serde::de::DeserializeOwned>(path: &PathBuf) -> T {
    let s = fs::read_to_string(path).unwrap_or_else(|e| panic!("read {}: {e}", path.display()));
    serde_json::from_str(&s).unwrap_or_else(|e| panic!("parse {}: {e}", path.display()))
}

fn main() {
    let data_dir: PathBuf = env::args()
        .nth(1)
        .map(PathBuf::from)
        .unwrap_or_else(|| PathBuf::from("data"));

    let payments: Vec<Payment> = load_json(&data_dir.join("payments.json"));
    let settlements: Vec<Settlement> = load_json(&data_dir.join("settlements.json"));
    let bank_credits: Vec<BankCredit> = load_json(&data_dir.join("bank_credits.json"));

    let cfg = ReconcileConfig {
        seed: Some(42),
        skip_llm: true,
        ..DEFAULT_CONFIG
    };
    let corrections: Vec<Correction> = Vec::new();

    let result = reconcile_skip_llm(
        &payments,
        &settlements,
        &bank_credits,
        &cfg,
        &corrections,
    );

    let deterministic_ms = result.timing.exact_ms + result.timing.fuzzy_ms + result.timing.split_ms;

    let out = serde_json::json!({
        "engine": "rust",
        "mode": if cfg!(debug_assertions) { "debug" } else { "release" },
        "payments": result.payment_count,
        "settlements": result.settlement_count,
        "bankCredits": result.bank_count,
        "matchCount": result.matches.len(),
        "exceptionCount": result.exceptions.len(),
        "exactMs": result.timing.exact_ms,
        "fuzzyMs": result.timing.fuzzy_ms,
        "splitMs": result.timing.split_ms,
        "llmMs": result.timing.llm_ms,
        "deterministicMs": (deterministic_ms * 1000.0).round() / 1000.0,
        "totalReconcileMs": result.timing.total_ms,
    });
    println!("{}", out);
}
