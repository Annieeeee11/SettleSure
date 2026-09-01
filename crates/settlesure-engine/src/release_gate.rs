//! Non-overridable auto-release safety floors.
//!
//! These constants are not exposed via CLI or config files. `merge_config` clamps
//! fuzzy thresholds so callers cannot weaken them below these floors.

use crate::fuzzy::score_pair;
use crate::reference::reference_similarity;
use settlesure_types::{
    amount_tolerance, BankCredit, Exception, ExceptionSource, MatchResult, MatchSource,
    ReconcileConfig, Settlement,
};

/// Minimum score gap between the top two fuzzy candidates for the same bank credit.
pub const MIN_FUZZY_RELEASE_MARGIN: f64 = 0.08;

/// LLM-suggested matches require at least this UTR/reference similarity.
pub const MIN_LLM_CORROBORATION_REF_SIM: f64 = 0.85;

/// Fuzzy auto-release requires an exact amount match (net vs credited).
pub const MIN_FUZZY_AMOUNT_SCORE: f64 = 1.0;

/// Floor for `fuzzy_accept_threshold` — config cannot be set lower.
pub const FUZZY_ACCEPT_THRESHOLD_FLOOR: f64 = 0.75;

/// Returns true when a fuzzy-tier match may be auto-released (not routed to human).
pub fn fuzzy_eligible_for_auto_release(
    bank: &BankCredit,
    settlement: &Settlement,
    top_score: f64,
    runner_up_score: Option<f64>,
    config: &ReconcileConfig,
) -> bool {
    if top_score < config.fuzzy_accept_threshold.max(FUZZY_ACCEPT_THRESHOLD_FLOOR) {
        return false;
    }
    let (amount_component, _, _) = {
        let tol = amount_tolerance(bank.credited_amount, config);
        let diff = (bank.credited_amount - settlement.net_amount).abs();
        (if diff <= tol && diff == 0.0 {
            1.0
        } else if diff <= tol {
            1.0 - diff / tol
        } else {
            0.0
        }, String::new(), false)
    };
    if amount_component < MIN_FUZZY_AMOUNT_SCORE {
        return false;
    }
    match runner_up_score {
        None => true,
        Some(second) => (top_score - second) >= MIN_FUZZY_RELEASE_MARGIN,
    }
}

/// LLM output alone is never sufficient — require independent amount + UTR corroboration.
pub fn llm_eligible_for_auto_release(
    bank: &BankCredit,
    settlement: &Settlement,
    config: &ReconcileConfig,
) -> bool {
    let (score, _, mismatch) = score_pair(bank, settlement, config);
    if mismatch {
        return false;
    }
    let ref_sim = reference_similarity(&bank.utr, &settlement.utr);
    if ref_sim < MIN_LLM_CORROBORATION_REF_SIM {
        return false;
    }
    let tol = amount_tolerance(bank.credited_amount, config);
    (bank.credited_amount - settlement.net_amount).abs() <= tol && score >= config.fuzzy_accept_threshold
}

pub fn hold_llm_match_for_review(
    m: &MatchResult,
    bank: &BankCredit,
    settlement: &Settlement,
) -> Exception {
    Exception {
        record_id: m.bank_credit_id.clone(),
        source: ExceptionSource::Bank,
        reason: format!(
            "LLM match held for human review — insufficient corroboration (UTR/amount) for settlement {}",
            settlement.settlement_id
        ),
        exception_type: None,
        related_ids: Some(vec![settlement.settlement_id.clone()]),
    }
}

pub fn hold_fuzzy_match_for_review(
    bank_id: &str,
    settlement_id: &str,
    reason: &str,
) -> Exception {
    Exception {
        record_id: bank_id.to_string(),
        source: ExceptionSource::Bank,
        reason: format!("fuzzy match held for human review — {reason}"),
        exception_type: None,
        related_ids: Some(vec![settlement_id.to_string()]),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use settlesure_types::DEFAULT_CONFIG;

    fn bank() -> BankCredit {
        BankCredit {
            id: "B1".into(),
            utr: "UTRABCDEFGH".into(),
            credited_amount: 1000.0,
            credited_at: "2025-01-15".into(),
            currency: "INR".into(),
        }
    }

    fn settlement(id: &str, utr: &str, net: f64) -> Settlement {
        Settlement {
            settlement_id: id.into(),
            payment_id: "pay_1".into(),
            gross_amount: net + 20.0,
            fee: 15.0,
            tax: 5.0,
            net_amount: net,
            settled_at: "2025-01-15".into(),
            utr: utr.into(),
            currency: "INR".into(),
        }
    }

    #[test]
    fn rejects_fuzzy_when_margin_too_narrow() {
        let b = bank();
        let s1 = settlement("S1", "UTRABCDEFGH", 1000.0);
        let cfg = &DEFAULT_CONFIG;
        assert!(!fuzzy_eligible_for_auto_release(&b, &s1, 0.80, Some(0.76), cfg));
    }

    #[test]
    fn accepts_fuzzy_with_wide_margin_and_exact_amount() {
        let b = bank();
        let s1 = settlement("S1", "UTRABCDEFGH", 1000.0);
        let cfg = &DEFAULT_CONFIG;
        assert!(fuzzy_eligible_for_auto_release(&b, &s1, 0.90, Some(0.70), cfg));
    }

    #[test]
    fn rejects_llm_without_utr_corroboration() {
        let b = bank();
        let s = settlement("S1", "UTRZZZZZZZZ", 1000.0);
        assert!(!llm_eligible_for_auto_release(&b, &s, &DEFAULT_CONFIG));
    }

    #[test]
    fn accepts_llm_with_strong_utr_and_amount() {
        let b = bank();
        let s = settlement("S1", "UTRABCDEFGH", 1000.0);
        assert!(llm_eligible_for_auto_release(&b, &s, &DEFAULT_CONFIG));
    }
}
