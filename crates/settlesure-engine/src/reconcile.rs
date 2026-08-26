//! Orchestrates integrity → exact → fuzzy → dup-UTR → split → LLM merge.

use crate::exact::exact_match;
use crate::fuzzy::{days_apart, fuzzy_match};
use crate::integrity::integrity_check;
use crate::split::split_match;
use settlesure_types::{
    amount_tolerance, AmbiguousCandidate, BankCredit, Correction, CorrectionDecision,
    DiscrepancyClass, Exception, ExceptionSource, LlmCallStats, MatchResult, MatchSource, Payment,
    ReconcileConfig, ReconcileResult, Settlement, DEFAULT_CONFIG,
};
use std::collections::{HashMap, HashSet};
use std::time::Instant;

/// Settlement ids claimed by a match (primary + components).
pub fn settlement_ids_of(m: &MatchResult) -> Vec<String> {
    m.components
        .clone()
        .unwrap_or_else(|| vec![m.settlement_id.clone()])
}

/// Result of the isolated LLM pass (produced outside this crate).
#[derive(Debug, Clone, Default)]
pub struct LlmPassResult {
    pub matches: Vec<MatchResult>,
    pub exceptions: Vec<Exception>,
    pub enabled: bool,
    pub provider_name: String,
    pub call_stats: Option<LlmCallStats>,
}

/// Accept LLM matches in array order only when settlements are free.
pub fn merge_llm_matches(
    prior_matches: &[MatchResult],
    llm_matches: &[MatchResult],
) -> (Vec<MatchResult>, Vec<Exception>) {
    let mut claimed: HashSet<String> = HashSet::new();
    for m in prior_matches {
        for id in settlement_ids_of(m) {
            claimed.insert(id);
        }
    }

    let mut accepted = Vec::new();
    let mut exceptions = Vec::new();

    for m in llm_matches {
        let ids = settlement_ids_of(m);
        let conflicts: Vec<String> = ids
            .iter()
            .filter(|id| claimed.contains(*id))
            .cloned()
            .collect();
        if !conflicts.is_empty() {
            exceptions.push(Exception {
                record_id: m.bank_credit_id.clone(),
                source: ExceptionSource::Bank,
                reason: "LLM-chosen combination conflicts with an already-claimed settlement"
                    .into(),
                exception_type: None,
                related_ids: Some(conflicts),
            });
            continue;
        }
        for id in ids {
            claimed.insert(id);
        }
        accepted.push(m.clone());
    }

    (accepted, exceptions)
}

fn reason_for_leftover_bank(bank: &BankCredit, settlements: &[Settlement]) -> Exception {
    let looks_batched = settlements
        .iter()
        .any(|s| s.utr.starts_with(&format!("{}_S", bank.utr)));
    if looks_batched {
        return Exception {
            record_id: bank.id.clone(),
            source: ExceptionSource::Bank,
            reason: "batched payout — no unique subset-sum within window".into(),
            exception_type: Some(DiscrepancyClass::BatchedPayout),
            related_ids: None,
        };
    }

    let cfg = &DEFAULT_CONFIG;
    let any_plausible = settlements.iter().any(|s| {
        if s.currency != bank.currency {
            return false;
        }
        let days = days_apart(&s.settled_at, &bank.credited_at);
        if days > cfg.date_window_days {
            return false;
        }
        let tol = amount_tolerance(bank.credited_amount, cfg);
        (s.net_amount - bank.credited_amount).abs() <= tol
    });

    if !any_plausible {
        return Exception {
            record_id: bank.id.clone(),
            source: ExceptionSource::Bank,
            reason: "no plausible counterpart in window".into(),
            exception_type: Some(DiscrepancyClass::UnresolvableNoise),
            related_ids: None,
        };
    }

    Exception {
        record_id: bank.id.clone(),
        source: ExceptionSource::Bank,
        reason: "UTR present in bank feed but no matching settlement (unclaimed credit)".into(),
        exception_type: Some(DiscrepancyClass::UnclaimedBankCredit),
        related_ids: None,
    }
}

fn reason_for_leftover_settlement(settlement_id: &str) -> Exception {
    Exception {
        record_id: settlement_id.into(),
        source: ExceptionSource::Settlement,
        reason: "settlement present, bank credit missing (payout may be in transit)".into(),
        exception_type: Some(DiscrepancyClass::SettlementPendingBank),
        related_ids: None,
    }
}

fn merge_config(partial: &ReconcileConfig) -> ReconcileConfig {
    // Callers pass a full config built by the CLI; still fill named defaults for safety.
    let mut cfg = DEFAULT_CONFIG.clone();
    cfg.date_window_days = partial.date_window_days;
    cfg.amount_tolerance_pct = partial.amount_tolerance_pct;
    cfg.amount_tolerance_abs = partial.amount_tolerance_abs;
    cfg.fuzzy_accept_threshold = partial.fuzzy_accept_threshold;
    cfg.ambiguous_low = partial.ambiguous_low;
    cfg.ambiguous_high = partial.ambiguous_high;
    cfg.weight_amount = partial.weight_amount;
    cfg.weight_date = partial.weight_date;
    cfg.weight_reference = partial.weight_reference;
    cfg.skip_llm = partial.skip_llm;
    cfg.split_date_window_days = partial.split_date_window_days;
    cfg.split_max_pool = partial.split_max_pool;
    cfg.split_max_combo = partial.split_max_combo;
    cfg.llm_provider = partial.llm_provider;
    cfg.llm_model = partial.llm_model.clone();
    cfg.seed = partial.seed;
    cfg.apply_corrections = partial.apply_corrections;
    cfg
}

/// Deterministic passes + LLM merge. `resolve_llm` is supplied by the CLI/llm crate
/// so this crate stays network-free.
pub fn reconcile(
    payments: &[Payment],
    settlements: &[Settlement],
    bank_credits: &[BankCredit],
    config: &ReconcileConfig,
    corrections: &[Correction],
    resolve_llm: impl FnOnce(&[AmbiguousCandidate]) -> LlmPassResult,
) -> ReconcileResult {
    let cfg = merge_config(config);
    let total_start = Instant::now();

    let rejected: HashSet<String> = corrections
        .iter()
        .filter(|c| c.decision == CorrectionDecision::Reject)
        .map(|c| format!("{}:{}", c.source.as_str(), c.record_id))
        .collect();

    let mut human_matches: Vec<MatchResult> = Vec::new();
    for c in corrections {
        if c.decision != CorrectionDecision::Accept {
            continue;
        }
        let Some(ref corrected) = c.corrected_match_id else {
            continue;
        };
        let (bank_credit_id, settlement_id) = if c.source == ExceptionSource::Bank {
            (c.record_id.clone(), corrected.clone())
        } else {
            (corrected.clone(), c.record_id.clone())
        };
        human_matches.push(MatchResult {
            bank_credit_id,
            settlement_id,
            components: c.components.clone(),
            confidence: 1.0,
            matched_by: MatchSource::Human,
            reasoning: Some("Accepted by human correction".into()),
        });
    }
    let human_bank: HashSet<String> = human_matches.iter().map(|m| m.bank_credit_id.clone()).collect();
    let human_settlement: HashSet<String> = human_matches
        .iter()
        .flat_map(settlement_ids_of)
        .collect();

    let (integrity_exceptions, flagged) = integrity_check(payments, settlements);
    let settlement_pool: Vec<Settlement> = settlements
        .iter()
        .filter(|s| {
            !flagged.contains(&s.settlement_id)
                && !human_settlement.contains(&s.settlement_id)
                && !rejected.contains(&format!("settlement:{}", s.settlement_id))
        })
        .cloned()
        .collect();
    let bank_pool: Vec<BankCredit> = bank_credits
        .iter()
        .filter(|b| {
            !human_bank.contains(&b.id) && !rejected.contains(&format!("bank:{}", b.id))
        })
        .cloned()
        .collect();

    let t0 = Instant::now();
    let (exact_matches, rem_bank, rem_setl) = exact_match(&bank_pool, &settlement_pool);
    let exact_ms = t0.elapsed().as_secs_f64() * 1000.0;

    let t1 = Instant::now();
    let pass2 = fuzzy_match(&rem_bank, &rem_setl, &cfg);
    let fuzzy_ms = t1.elapsed().as_secs_f64() * 1000.0;

    let bank_by_id: HashMap<&str, &BankCredit> =
        bank_credits.iter().map(|b| (b.id.as_str(), b)).collect();
    let mut claimed_utr_to_bank: HashMap<String, String> = HashMap::new();
    for m in human_matches
        .iter()
        .chain(exact_matches.iter())
        .chain(pass2.matches.iter())
    {
        if let Some(bank) = bank_by_id.get(m.bank_credit_id.as_str()) {
            claimed_utr_to_bank
                .entry(bank.utr.clone())
                .or_insert_with(|| bank.id.clone());
        }
    }

    let mut split_bank_pool = Vec::new();
    let mut duplicate_exceptions = Vec::new();
    for bank in &pass2.remaining_bank {
        if let Some(winner_id) = claimed_utr_to_bank.get(&bank.utr) {
            duplicate_exceptions.push(Exception {
                record_id: bank.id.clone(),
                source: ExceptionSource::Bank,
                reason: format!("duplicate bank credit — UTR already settled by {winner_id}"),
                exception_type: Some(DiscrepancyClass::DuplicateBank),
                related_ids: Some(vec![winner_id.clone()]),
            });
        } else {
            claimed_utr_to_bank.insert(bank.utr.clone(), bank.id.clone());
            split_bank_pool.push(bank.clone());
        }
    }

    let t_split = Instant::now();
    let pass_split = split_match(&split_bank_pool, &pass2.remaining_settlements, &cfg);
    let split_ms = t_split.elapsed().as_secs_f64() * 1000.0;

    let mut ambiguous = pass2.ambiguous;
    ambiguous.extend(pass_split.ambiguous);

    let t_llm = Instant::now();
    let pass3 = resolve_llm(&ambiguous);
    let llm_ms = t_llm.elapsed().as_secs_f64() * 1000.0;

    let prior_matches: Vec<MatchResult> = human_matches
        .into_iter()
        .chain(exact_matches)
        .chain(pass2.matches)
        .chain(pass_split.matches)
        .collect();
    let (llm_accepted, llm_conflict) = merge_llm_matches(&prior_matches, &pass3.matches);

    let matches: Vec<MatchResult> = prior_matches
        .into_iter()
        .chain(llm_accepted.iter().cloned())
        .collect();

    let matched_bank: HashSet<String> = matches.iter().map(|m| m.bank_credit_id.clone()).collect();
    let mut matched_settlement: HashSet<String> = HashSet::new();
    for m in &matches {
        matched_settlement.insert(m.settlement_id.clone());
        if let Some(ref comps) = m.components {
            for id in comps {
                matched_settlement.insert(id.clone());
            }
        }
    }

    let mut leftover_exceptions = Vec::new();
    for b in &pass_split.remaining_bank {
        if matched_bank.contains(&b.id) {
            continue;
        }
        leftover_exceptions.push(reason_for_leftover_bank(b, settlements));
    }
    for s in &pass_split.remaining_settlements {
        if matched_settlement.contains(&s.settlement_id) {
            continue;
        }
        leftover_exceptions.push(reason_for_leftover_settlement(&s.settlement_id));
    }

    for c in corrections {
        if c.decision != CorrectionDecision::Reject {
            continue;
        }
        leftover_exceptions.push(Exception {
            record_id: c.record_id.clone(),
            source: c.source,
            reason: "permanently rejected by human correction".into(),
            exception_type: None,
            related_ids: None,
        });
    }

    let mut exceptions: Vec<Exception> = integrity_exceptions
        .into_iter()
        .chain(pass2.exceptions)
        .chain(duplicate_exceptions)
        .chain(pass_split.exceptions)
        .chain(pass3.exceptions)
        .chain(llm_conflict)
        .chain(leftover_exceptions)
        .filter(|e| {
            !(e.source == ExceptionSource::Bank && matched_bank.contains(&e.record_id)
                || e.source == ExceptionSource::Settlement
                    && matched_settlement.contains(&e.record_id))
        })
        .collect();

    let mut seen: HashSet<String> = HashSet::new();
    let mut deduped = Vec::new();
    for e in exceptions.drain(..) {
        let key = format!("{}:{}", e.source.as_str(), e.record_id);
        if seen.contains(&key) {
            continue;
        }
        seen.insert(key);
        deduped.push(e);
    }

    for b in bank_credits {
        if matched_bank.contains(&b.id) {
            continue;
        }
        let key = format!("bank:{}", b.id);
        if seen.contains(&key) {
            continue;
        }
        seen.insert(key);
        deduped.push(reason_for_leftover_bank(b, settlements));
    }
    for s in settlements {
        if matched_settlement.contains(&s.settlement_id) {
            continue;
        }
        let key = format!("settlement:{}", s.settlement_id);
        if seen.contains(&key) {
            continue;
        }
        seen.insert(key);
        deduped.push(reason_for_leftover_settlement(&s.settlement_id));
    }

    let settlement_by_id: HashMap<&str, &Settlement> = settlements
        .iter()
        .map(|s| (s.settlement_id.as_str(), s))
        .collect();
    let bank_by_utr: HashMap<&str, &BankCredit> =
        bank_credits.iter().map(|b| (b.utr.as_str(), b)).collect();

    // Collect indices to update relatedIds for fee_tax linkage
    let mut related_updates: Vec<(usize, Vec<String>)> = Vec::new();
    for (i, e) in deduped.iter().enumerate() {
        if e.source != ExceptionSource::Settlement
            || e.exception_type != Some(DiscrepancyClass::FeeTaxMismatch)
        {
            continue;
        }
        let Some(setl) = settlement_by_id.get(e.record_id.as_str()) else {
            continue;
        };
        let Some(bank) = bank_by_utr.get(setl.utr.as_str()) else {
            continue;
        };
        let Some(j) = deduped
            .iter()
            .position(|x| x.source == ExceptionSource::Bank && x.record_id == bank.id)
        else {
            continue;
        };
        let mut setl_related = e.related_ids.clone().unwrap_or_default();
        setl_related.push(bank.id.clone());
        setl_related.sort();
        setl_related.dedup();
        related_updates.push((i, setl_related));

        let mut bank_related = deduped[j].related_ids.clone().unwrap_or_default();
        bank_related.push(e.record_id.clone());
        bank_related.sort();
        bank_related.dedup();
        related_updates.push((j, bank_related));
    }
    for (idx, ids) in related_updates {
        deduped[idx].related_ids = Some(ids);
    }

    let total_ms = total_start.elapsed().as_secs_f64() * 1000.0;

    ReconcileResult {
        matches,
        exceptions: deduped,
        ambiguous_resolved: llm_accepted.len(),
        timing: settlesure_types::PassTiming {
            exact_ms: (exact_ms * 1000.0).round() / 1000.0,
            fuzzy_ms: (fuzzy_ms * 1000.0).round() / 1000.0,
            split_ms: (split_ms * 1000.0).round() / 1000.0,
            llm_ms: (llm_ms * 1000.0).round() / 1000.0,
            total_ms: (total_ms * 1000.0).round() / 1000.0,
        },
        bank_count: bank_credits.len(),
        settlement_count: settlements.len(),
        payment_count: payments.len(),
    }
}

/// Convenience: reconcile with empty LLM (skip).
pub fn reconcile_skip_llm(
    payments: &[Payment],
    settlements: &[Settlement],
    bank_credits: &[BankCredit],
    config: &ReconcileConfig,
    corrections: &[Correction],
) -> ReconcileResult {
    let mut cfg = config.clone();
    cfg.skip_llm = true;
    reconcile(
        payments,
        settlements,
        bank_credits,
        &cfg,
        corrections,
        |ambiguous| {
            let mut exceptions = Vec::new();
            for a in ambiguous {
                if a.kind == Some(settlesure_types::AmbiguousKind::Split)
                    && a.split_options.is_some()
                {
                    let all_ids: Vec<String> = a
                        .split_options
                        .as_ref()
                        .unwrap()
                        .iter()
                        .flatten()
                        .cloned()
                        .collect::<HashSet<_>>()
                        .into_iter()
                        .collect();
                    exceptions.push(Exception {
                        record_id: a.bank.id.clone(),
                        source: ExceptionSource::Bank,
                        reason: format!("ambiguous split — LLM unavailable: {}", a.reasoning),
                        exception_type: Some(DiscrepancyClass::BatchedPayout),
                        related_ids: Some(all_ids),
                    });
                } else {
                    let mut related = vec![a.settlement.settlement_id.clone()];
                    if let Some(ref rivals) = a.rivals {
                        for r in rivals {
                            related.push(r.settlement.settlement_id.clone());
                        }
                    }
                    exceptions.push(Exception {
                        record_id: a.bank.id.clone(),
                        source: ExceptionSource::Bank,
                        reason: "ambiguous — LLM unavailable".into(),
                        exception_type: None,
                        related_ids: Some(related.clone()),
                    });
                    exceptions.push(Exception {
                        record_id: a.settlement.settlement_id.clone(),
                        source: ExceptionSource::Settlement,
                        reason: "ambiguous — LLM unavailable".into(),
                        exception_type: None,
                        related_ids: Some(vec![a.bank.id.clone()]),
                    });
                }
            }
            LlmPassResult {
                matches: vec![],
                exceptions,
                enabled: false,
                provider_name: "none".into(),
                call_stats: None,
            }
        },
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    fn match_result(
        bank: &str,
        setl: &str,
        source: MatchSource,
        components: Option<Vec<&str>>,
    ) -> MatchResult {
        MatchResult {
            bank_credit_id: bank.into(),
            settlement_id: setl.into(),
            components: components.map(|c| c.into_iter().map(String::from).collect()),
            confidence: 1.0,
            matched_by: source,
            reasoning: Some("test".into()),
        }
    }

    #[test]
    fn rejects_claimed_component() {
        let prior = vec![match_result(
            "bank_A",
            "setl_1",
            MatchSource::Split,
            Some(vec!["setl_1", "setl_2"]),
        )];
        let llm = vec![match_result(
            "bank_B",
            "setl_2",
            MatchSource::Llm,
            Some(vec!["setl_2", "setl_3"]),
        )];
        let (accepted, exceptions) = merge_llm_matches(&prior, &llm);
        assert!(accepted.is_empty());
        assert_eq!(exceptions.len(), 1);
        assert_eq!(exceptions[0].record_id, "bank_B");
        assert!(exceptions[0]
            .related_ids
            .as_ref()
            .unwrap()
            .contains(&"setl_2".to_string()));
    }

    #[test]
    fn first_claim_wins() {
        let llm = vec![
            match_result(
                "bank_1",
                "setl_a",
                MatchSource::Llm,
                Some(vec!["setl_a", "setl_b"]),
            ),
            match_result(
                "bank_2",
                "setl_b",
                MatchSource::Llm,
                Some(vec!["setl_b", "setl_c"]),
            ),
        ];
        let (accepted, exceptions) = merge_llm_matches(&[], &llm);
        assert_eq!(accepted.len(), 1);
        assert_eq!(accepted[0].bank_credit_id, "bank_1");
        assert_eq!(exceptions.len(), 1);
        assert_eq!(exceptions[0].record_id, "bank_2");
    }

    #[test]
    fn accepts_free_settlements() {
        let prior = vec![match_result("bank_A", "setl_1", MatchSource::Exact, None)];
        let llm = vec![match_result("bank_B", "setl_9", MatchSource::Llm, None)];
        let (accepted, exceptions) = merge_llm_matches(&prior, &llm);
        assert_eq!(accepted.len(), 1);
        assert!(exceptions.is_empty());
    }
}
