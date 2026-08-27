//! Shared domain types for SettleSure — one canonical definition per concept.
//! JSON shapes match `data/*.json` and `output/report.json` from the TypeScript version.

mod config;
mod money;
mod secret;

pub use config::{amount_tolerance, ReconcileConfig, DEFAULT_CONFIG, SPLIT_MAX_COMBO, SPLIT_MAX_POOL};
pub use money::round_money;
pub use secret::Secret;

use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use thiserror::Error;

/// Errors that can surface from untrusted input (JSON, CLI, env).
#[derive(Debug, Error)]
pub enum SettleSureError {
    #[error("invalid JSON: {0}")]
    Json(#[from] serde_json::Error),
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    #[error("{0}")]
    Message(String),
}

pub type Result<T> = std::result::Result<T, SettleSureError>;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum PaymentStatus {
    Captured,
    Failed,
    Refunded,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Payment {
    pub order_id: String,
    pub payment_id: String,
    pub amount: f64,
    pub currency: String,
    pub status: PaymentStatus,
    pub created_at: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Settlement {
    pub settlement_id: String,
    pub payment_id: String,
    pub gross_amount: f64,
    pub fee: f64,
    pub tax: f64,
    pub net_amount: f64,
    pub settled_at: String,
    pub utr: String,
    pub currency: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BankCredit {
    pub id: String,
    pub utr: String,
    pub credited_amount: f64,
    pub credited_at: String,
    pub currency: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum GroundTruthLabelKind {
    Match,
    Exception,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AmbiguityLevel {
    Clear,
    Boundary,
    Decoy,
    Unresolvable,
}

impl AmbiguityLevel {
    pub const ALL: [AmbiguityLevel; 4] = [
        AmbiguityLevel::Clear,
        AmbiguityLevel::Boundary,
        AmbiguityLevel::Decoy,
        AmbiguityLevel::Unresolvable,
    ];

    pub fn as_str(self) -> &'static str {
        match self {
            AmbiguityLevel::Clear => "clear",
            AmbiguityLevel::Boundary => "boundary",
            AmbiguityLevel::Decoy => "decoy",
            AmbiguityLevel::Unresolvable => "unresolvable",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum DiscrepancyClass {
    Clean,
    DateShifted,
    AmountShifted,
    ReferenceMangled,
    ReferenceMangledBoundary,
    FuzzyAmbiguousMatch,
    NearDuplicateDecoy,
    AcceptBandDecoyAmountUtr,
    AcceptBandDecoyUtrAmountTol,
    AcceptBandDecoyDateWrongRef,
    DuplicateBank,
    CurrencyMismatch,
    FeeTaxMismatch,
    SettlementPendingBank,
    UnclaimedBankCredit,
    BatchedPayout,
    BatchedPayoutAmbiguous,
    UnresolvableNoise,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GroundTruthLabel {
    pub bank_credit_id: Option<String>,
    pub settlement_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub settlement_ids: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub decoy_settlement_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub payment_id: Option<String>,
    pub label: GroundTruthLabelKind,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub exception_type: Option<DiscrepancyClass>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub class: Option<DiscrepancyClass>,
    pub ambiguity_level: AmbiguityLevel,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum MatchSource {
    Exact,
    Fuzzy,
    Llm,
    Split,
    Human,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MatchResult {
    pub bank_credit_id: String,
    pub settlement_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub components: Option<Vec<String>>,
    pub confidence: f64,
    pub matched_by: MatchSource,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reasoning: Option<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ExceptionSource {
    Payment,
    Settlement,
    Bank,
}

impl ExceptionSource {
    pub fn as_str(self) -> &'static str {
        match self {
            ExceptionSource::Payment => "payment",
            ExceptionSource::Settlement => "settlement",
            ExceptionSource::Bank => "bank",
        }
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Exception {
    pub record_id: String,
    pub source: ExceptionSource,
    pub reason: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub exception_type: Option<DiscrepancyClass>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub related_ids: Option<Vec<String>>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AmbiguousRival {
    pub settlement: Settlement,
    pub score: f64,
    pub reasoning: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AmbiguousKind {
    Fuzzy,
    Split,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AmbiguousCandidate {
    pub bank: BankCredit,
    pub settlement: Settlement,
    pub score: f64,
    pub reasoning: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub rivals: Option<Vec<AmbiguousRival>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub split_options: Option<Vec<Vec<String>>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub kind: Option<AmbiguousKind>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PassTiming {
    pub exact_ms: f64,
    pub fuzzy_ms: f64,
    pub split_ms: f64,
    pub llm_ms: f64,
    pub total_ms: f64,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReconcileResult {
    pub matches: Vec<MatchResult>,
    pub exceptions: Vec<Exception>,
    pub ambiguous_resolved: usize,
    pub timing: PassTiming,
    pub bank_count: usize,
    pub settlement_count: usize,
    pub payment_count: usize,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum LlmProviderChoice {
    Anthropic,
    Ollama,
    None,
}

impl LlmProviderChoice {
    pub fn as_str(self) -> &'static str {
        match self {
            LlmProviderChoice::Anthropic => "anthropic",
            LlmProviderChoice::Ollama => "ollama",
            LlmProviderChoice::None => "none",
        }
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MatchSourceBreakdown {
    pub exact: usize,
    pub fuzzy: usize,
    pub split: usize,
    pub llm: usize,
    pub human: usize,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AmbiguitySliceMetrics {
    pub match_rate: f64,
    pub precision: f64,
    pub recall: f64,
    pub true_match_count: usize,
    pub predicted_match_count: usize,
    pub true_positive: usize,
    pub false_positive: usize,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub correctly_deferred: Option<usize>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub deferred_total: Option<usize>,
    pub notes: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MetricRange {
    pub mean: f64,
    pub min: f64,
    pub max: f64,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RobustnessSummary {
    pub seeds: Vec<u32>,
    pub match_rate: MetricRange,
    pub precision: MetricRange,
    pub recall: MetricRange,
    pub false_positive_rate: MetricRange,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LlmAblationSide {
    pub match_rate: f64,
    pub precision: f64,
    pub recall: f64,
    pub false_positive_rate: f64,
    pub llm_matches: usize,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub provider: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LlmCallStats {
    pub call_count: usize,
    pub verdict_match: usize,
    pub verdict_no_match: usize,
    pub verdict_unsure: usize,
    pub provider_errors: usize,
    pub latency_ms_min: f64,
    pub latency_ms_max: f64,
    pub latency_ms_mean: f64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub verdict_log: Option<Vec<LlmVerdictLogEntry>>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LlmVerdictLogEntry {
    pub candidate_id: String,
    pub verdict: String,
    pub reasoning: String,
    pub latency_ms: f64,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LlmAblationRobustnessSummary {
    pub seeds: Vec<u32>,
    pub recall_lift: MetricRange,
    pub with_llm_recall: MetricRange,
    pub without_llm_recall: MetricRange,
    pub llm_matches: MetricRange,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub per_seed: Option<Vec<LlmAblationSummary>>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LlmAblationSummary {
    pub with_llm: LlmAblationSide,
    pub without_llm: LlmAblationSide,
    pub provider_available: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub call_stats: Option<LlmCallStats>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScoreReport {
    pub match_rate: f64,
    pub precision: f64,
    pub recall: f64,
    pub false_positive_rate: f64,
    pub exception_accuracy: f64,
    pub true_match_count: usize,
    pub predicted_match_count: usize,
    pub true_positive: usize,
    pub false_positive: usize,
    pub false_negative: usize,
    pub true_exception_count: usize,
    pub predicted_exception_count: usize,
    pub correctly_flagged_exceptions: usize,
    pub throughput_records_per_sec: f64,
    pub timing: PassTiming,
    pub match_source_breakdown: MatchSourceBreakdown,
    pub bank_count: usize,
    pub settlement_count: usize,
    pub payment_count: usize,
    pub seed: u32,
    pub llm_enabled: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub llm_provider: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub suggested_fuzzy_threshold: Option<f64>,
    pub by_ambiguity_level: BTreeMap<String, AmbiguitySliceMetrics>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub robustness: Option<RobustnessSummary>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub llm_ablation: Option<LlmAblationSummary>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub llm_ablation_robustness: Option<LlmAblationRobustnessSummary>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum CorrectionDecision {
    Accept,
    Reject,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Correction {
    pub record_id: String,
    pub source: ExceptionSource,
    pub decision: CorrectionDecision,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub corrected_match_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub components: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub score: Option<f64>,
    pub ts: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FullReport {
    pub metrics: ScoreReport,
    pub matches: Vec<MatchResult>,
    pub exceptions: Vec<Exception>,
    pub known_limitations: Vec<String>,
}
