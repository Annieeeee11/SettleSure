//! Deterministic reconciliation engine — no network I/O.

mod corrections;
mod exact;
mod fuzzy;
mod integrity;
mod reconcile;
mod reference;
mod split;

pub use corrections::{load_corrections, load_corrections_with_fallback, suggest_fuzzy_threshold};
pub use exact::exact_match;
pub use fuzzy::{
    days_apart, fuzzy_candidate_pair_keys_brute, fuzzy_candidate_pair_keys_bucketed, fuzzy_match,
    fuzzy_match_default, score_pair, FuzzyMatchResult,
};
pub use integrity::integrity_check;
pub use reconcile::{
    merge_llm_matches, reconcile, reconcile_skip_llm, settlement_ids_of, LlmPassResult,
};
pub use reference::{levenshtein, normalize_reference, reference_similarity};
pub use split::{find_subset_sums, split_match, split_match_default, SplitMatchResult};
