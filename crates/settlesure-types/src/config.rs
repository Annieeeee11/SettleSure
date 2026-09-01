//! Reconcile configuration — single source of truth for matching thresholds.

use crate::LlmProviderChoice;
use serde::{Deserialize, Serialize};

/// Load-bearing split bounds (correctness + throughput).
pub const SPLIT_MAX_POOL: usize = 100;
pub const SPLIT_MAX_COMBO: usize = 8;

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReconcileConfig {
    pub date_window_days: f64,
    pub amount_tolerance_pct: f64,
    pub amount_tolerance_abs: f64,
    pub fuzzy_accept_threshold: f64,
    pub ambiguous_low: f64,
    pub ambiguous_high: f64,
    pub weight_amount: f64,
    pub weight_date: f64,
    pub weight_reference: f64,
    pub skip_llm: bool,
    pub split_date_window_days: f64,
    pub split_max_pool: usize,
    pub split_max_combo: usize,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub llm_provider: Option<LlmProviderChoice>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub llm_model: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub seed: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub apply_corrections: Option<bool>,
}

pub const DEFAULT_CONFIG: ReconcileConfig = ReconcileConfig {
    date_window_days: 3.0,
    amount_tolerance_pct: 0.02,
    amount_tolerance_abs: 0.5,
    fuzzy_accept_threshold: 0.75,
    ambiguous_low: 0.5,
    ambiguous_high: 0.75,
    weight_amount: 0.4,
    weight_date: 0.3,
    weight_reference: 0.3,
    skip_llm: false,
    split_date_window_days: 5.0,
    split_max_pool: SPLIT_MAX_POOL,
    split_max_combo: SPLIT_MAX_COMBO,
    llm_provider: None,
    llm_model: None,
    seed: None,
    apply_corrections: None,
};

/// `max(|amount| × pct, abs)` — shared by fuzzy and split passes.
pub fn amount_tolerance(amount: f64, config: &ReconcileConfig) -> f64 {
    (amount.abs() * config.amount_tolerance_pct).max(config.amount_tolerance_abs)
}
