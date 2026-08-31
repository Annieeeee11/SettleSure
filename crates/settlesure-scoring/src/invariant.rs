//! Hard partition invariant: every bank credit and settlement is matched or excepted exactly once.

use settlesure_types::{
    ExceptionSource, MatchSource, MatchSourceBreakdown, ReconcileResult,
};
use std::collections::HashSet;

#[derive(Debug, Clone, PartialEq)]
pub struct ReconciliationInvariant {
    pub bank_count: usize,
    pub settlement_count: usize,
    pub match_source_breakdown: MatchSourceBreakdown,
    pub matched_count: usize,
    pub bank_exception_count: usize,
    pub settlement_exception_count: usize,
}

impl ReconciliationInvariant {
    pub fn format_terminal_line(&self) -> String {
        let b = &self.match_source_breakdown;
        format!(
            "invariant: {} records → {}+{}+{}+{}+{} matched, {} exceptions = {} ✓",
            self.bank_count,
            b.exact,
            b.fuzzy,
            b.split,
            b.llm,
            b.human,
            self.bank_exception_count,
            self.bank_count,
        )
    }
}

fn matched_bank_ids(result: &ReconcileResult) -> HashSet<String> {
    result
        .matches
        .iter()
        .map(|m| m.bank_credit_id.clone())
        .collect()
}

fn matched_settlement_ids(result: &ReconcileResult) -> HashSet<String> {
    let mut ids = HashSet::new();
    for m in &result.matches {
        ids.insert(m.settlement_id.clone());
        if let Some(ref comps) = m.components {
            for id in comps {
                ids.insert(id.clone());
            }
        }
    }
    ids
}

fn exception_ids_by_source(result: &ReconcileResult, source: ExceptionSource) -> HashSet<String> {
    result
        .exceptions
        .iter()
        .filter(|e| e.source == source)
        .map(|e| e.record_id.clone())
        .collect()
}

fn match_source_breakdown(result: &ReconcileResult) -> MatchSourceBreakdown {
    MatchSourceBreakdown {
        exact: result
            .matches
            .iter()
            .filter(|m| m.matched_by == MatchSource::Exact)
            .count(),
        fuzzy: result
            .matches
            .iter()
            .filter(|m| m.matched_by == MatchSource::Fuzzy)
            .count(),
        split: result
            .matches
            .iter()
            .filter(|m| m.matched_by == MatchSource::Split)
            .count(),
        llm: result
            .matches
            .iter()
            .filter(|m| m.matched_by == MatchSource::Llm)
            .count(),
        human: result
            .matches
            .iter()
            .filter(|m| m.matched_by == MatchSource::Human)
            .count(),
    }
}

/// Verify every bank credit and settlement is accounted for exactly once.
pub fn check_reconciliation_invariant(
    result: &ReconcileResult,
) -> Result<ReconciliationInvariant, String> {
    let breakdown = match_source_breakdown(result);
    let bucket_sum = breakdown.exact
        + breakdown.fuzzy
        + breakdown.split
        + breakdown.llm
        + breakdown.human;

    if bucket_sum != result.matches.len() {
        return Err(format!(
            "match source breakdown sum ({bucket_sum}) != matches.len() ({})",
            result.matches.len()
        ));
    }

    let matched_banks = matched_bank_ids(result);
    let matched_settlements = matched_settlement_ids(result);
    let bank_exceptions = exception_ids_by_source(result, ExceptionSource::Bank);
    let settlement_exceptions = exception_ids_by_source(result, ExceptionSource::Settlement);

    if let Some(id) = matched_banks.intersection(&bank_exceptions).next() {
        return Err(format!(
            "bank credit {id} appears in both matches and exceptions"
        ));
    }
    if let Some(id) = matched_settlements.intersection(&settlement_exceptions).next() {
        return Err(format!(
            "settlement {id} appears in both matches and exceptions"
        ));
    }

    if matched_banks.len() + bank_exceptions.len() != result.bank_count {
        return Err(format!(
            "bank partition violated: {} matched + {} excepted != {} total bank credits",
            matched_banks.len(),
            bank_exceptions.len(),
            result.bank_count
        ));
    }

    if matched_settlements.len() + settlement_exceptions.len() != result.settlement_count {
        return Err(format!(
            "settlement partition violated: {} matched + {} excepted != {} total settlements",
            matched_settlements.len(),
            settlement_exceptions.len(),
            result.settlement_count
        ));
    }

    Ok(ReconciliationInvariant {
        bank_count: result.bank_count,
        settlement_count: result.settlement_count,
        match_source_breakdown: breakdown,
        matched_count: result.matches.len(),
        bank_exception_count: bank_exceptions.len(),
        settlement_exception_count: settlement_exceptions.len(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use settlesure_types::{
        Exception, MatchResult, PassTiming, ReconcileResult,
    };

    fn sample_result() -> ReconcileResult {
        ReconcileResult {
            matches: vec![
                MatchResult {
                    bank_credit_id: "bank_1".into(),
                    settlement_id: "setl_1".into(),
                    components: None,
                    confidence: 1.0,
                    matched_by: MatchSource::Exact,
                    reasoning: None,
                },
                MatchResult {
                    bank_credit_id: "bank_2".into(),
                    settlement_id: "setl_2".into(),
                    components: None,
                    confidence: 0.9,
                    matched_by: MatchSource::Fuzzy,
                    reasoning: None,
                },
                MatchResult {
                    bank_credit_id: "bank_3".into(),
                    settlement_id: "setl_3".into(),
                    components: Some(vec!["setl_3".into(), "setl_4".into()]),
                    confidence: 0.85,
                    matched_by: MatchSource::Split,
                    reasoning: None,
                },
                MatchResult {
                    bank_credit_id: "bank_4".into(),
                    settlement_id: "setl_5".into(),
                    components: None,
                    confidence: 0.8,
                    matched_by: MatchSource::Llm,
                    reasoning: None,
                },
                MatchResult {
                    bank_credit_id: "bank_5".into(),
                    settlement_id: "setl_6".into(),
                    components: None,
                    confidence: 1.0,
                    matched_by: MatchSource::Human,
                    reasoning: None,
                },
            ],
            exceptions: vec![
                Exception {
                    record_id: "bank_6".into(),
                    source: ExceptionSource::Bank,
                    reason: "unclaimed".into(),
                    exception_type: None,
                    related_ids: None,
                },
                Exception {
                    record_id: "setl_7".into(),
                    source: ExceptionSource::Settlement,
                    reason: "pending bank".into(),
                    exception_type: None,
                    related_ids: None,
                },
            ],
            ambiguous_resolved: 1,
            timing: PassTiming {
                exact_ms: 1.0,
                fuzzy_ms: 2.0,
                split_ms: 0.5,
                llm_ms: 0.0,
                total_ms: 3.5,
            },
            bank_count: 6,
            settlement_count: 7,
            payment_count: 10,
        }
    }

    #[test]
    fn happy_path_holds() {
        let result = sample_result();
        let inv = check_reconciliation_invariant(&result).expect("invariant should hold");
        assert_eq!(inv.matched_count, 5);
        assert_eq!(inv.bank_exception_count, 1);
        assert_eq!(inv.match_source_breakdown.exact, 1);
        assert_eq!(inv.match_source_breakdown.fuzzy, 1);
        assert_eq!(inv.match_source_breakdown.split, 1);
        assert_eq!(inv.match_source_breakdown.llm, 1);
        assert_eq!(inv.match_source_breakdown.human, 1);
        assert!(inv.format_terminal_line().contains("6 records"));
        assert!(inv.format_terminal_line().contains("✓"));
    }

    #[test]
    fn violation_when_exception_dropped() {
        let mut result = sample_result();
        result.exceptions.retain(|e| e.record_id != "bank_6");
        let err = check_reconciliation_invariant(&result).unwrap_err();
        assert!(
            err.contains("bank partition") || err.contains("bank gap"),
            "unexpected error: {err}"
        );
    }
}
