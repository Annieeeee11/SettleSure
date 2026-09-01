//! Ground-truth scoring — port of `src/scoring/metrics.ts`.

use settlesure_types::{
    AmbiguityLevel, AmbiguitySliceMetrics, DiscrepancyClass, Exception, GroundTruthLabel,
    GroundTruthLabelKind, MatchResult, MatchSource, MatchSourceBreakdown, PassTiming,
    ReconcileResult, ScoreReport,
};
use std::collections::{BTreeMap, HashSet};

fn sorted_set_key(ids: &[String]) -> String {
    let mut sorted = ids.to_vec();
    sorted.sort();
    sorted.join(",")
}

fn match_equals_gt(m: &MatchResult, g: &GroundTruthLabel) -> bool {
    let Some(ref bank_id) = g.bank_credit_id else {
        return false;
    };
    if m.bank_credit_id != *bank_id {
        return false;
    }
    if let Some(ref settlement_ids) = g.settlement_ids {
        if settlement_ids.len() > 1 && g.label == GroundTruthLabelKind::Match {
            let comps = m
                .components
                .clone()
                .unwrap_or_else(|| vec![m.settlement_id.clone()]);
            return sorted_set_key(&comps) == sorted_set_key(settlement_ids);
        }
    }
    g.settlement_id
        .as_ref()
        .is_some_and(|sid| m.settlement_id == *sid)
}

/// Score one ambiguity-level slice. Logic matches TypeScript `scoreSlice` exactly.
pub fn score_slice(
    level: AmbiguityLevel,
    result: &ReconcileResult,
    ground_truth: &[GroundTruthLabel],
) -> AmbiguitySliceMetrics {
    let level_gt: Vec<&GroundTruthLabel> = ground_truth
        .iter()
        .filter(|g| g.ambiguity_level == level)
        .collect();
    let true_matches: Vec<&GroundTruthLabel> = level_gt
        .iter()
        .copied()
        .filter(|g| g.label == GroundTruthLabelKind::Match)
        .collect();

    let level_bank_ids: HashSet<&str> = level_gt
        .iter()
        .filter_map(|g| g.bank_credit_id.as_deref())
        .collect();
    let level_settlement_ids: HashSet<&str> = level_gt
        .iter()
        .filter_map(|g| g.settlement_id.as_deref())
        .collect();

    let predicted: Vec<&MatchResult> = result
        .matches
        .iter()
        .filter(|m| {
            level_bank_ids.contains(m.bank_credit_id.as_str())
                || level_settlement_ids.contains(m.settlement_id.as_str())
                || m.components.as_ref().is_some_and(|comps| {
                    comps
                        .iter()
                        .any(|id| level_settlement_ids.contains(id.as_str()))
                })
        })
        .collect();

    let mut true_positive = 0usize;
    let mut false_positive = 0usize;
    let mut claimed: HashSet<usize> = HashSet::new();

    for m in &predicted {
        let idx = true_matches.iter().enumerate().find_map(|(i, g)| {
            if !claimed.contains(&i) && match_equals_gt(m, g) {
                Some(i)
            } else {
                None
            }
        });
        if let Some(idx) = idx {
            true_positive += 1;
            claimed.insert(idx);
        } else {
            false_positive += 1;
        }
    }

    let precision = if predicted.is_empty() {
        1.0
    } else {
        true_positive as f64 / predicted.len() as f64
    };
    let recall = if true_matches.is_empty() {
        1.0
    } else {
        true_positive as f64 / true_matches.len() as f64
    };

    let mut correctly_deferred = 0usize;
    let mut deferred_total = 0usize;
    if level == AmbiguityLevel::Decoy || level == AmbiguityLevel::Unresolvable {
        let exception_rows: Vec<&GroundTruthLabel> = level_gt
            .iter()
            .copied()
            .filter(|g| g.label == GroundTruthLabelKind::Exception)
            .collect();
        deferred_total = exception_rows.len();
        for g in &exception_rows {
            let wrongly_matched = (g
                .bank_credit_id
                .as_ref()
                .is_some_and(|bid| result.matches.iter().any(|m| m.bank_credit_id == *bid)))
                || (g.settlement_id.as_ref().is_some_and(|sid| {
                    result.matches.iter().any(|m| {
                        m.settlement_id == *sid
                            || m.components
                                .as_ref()
                                .is_some_and(|c| c.iter().any(|id| id == sid))
                    })
                }));

            if matches!(
                g.exception_type,
                Some(
                    DiscrepancyClass::NearDuplicateDecoy
                        | DiscrepancyClass::AcceptBandDecoyAmountUtr
                        | DiscrepancyClass::AcceptBandDecoyUtrAmountTol
                        | DiscrepancyClass::AcceptBandDecoyDateWrongRef
                )
            ) {
                if let Some(sid) = g.settlement_id.as_ref() {
                    let decoy_picked = result.matches.iter().any(|m| {
                        m.settlement_id == *sid
                            || m.components
                                .as_ref()
                                .is_some_and(|c| c.iter().any(|id| id == sid))
                    });
                    if !decoy_picked {
                        correctly_deferred += 1;
                    }
                }
                continue;
            }
            if !wrongly_matched {
                correctly_deferred += 1;
            }
        }

        for g in &true_matches {
            let Some(ref decoy_id) = g.decoy_settlement_id else {
                continue;
            };
            deferred_total += 1;
            let picked_decoy = g.bank_credit_id.as_ref().is_some_and(|bid| {
                result.matches.iter().any(|m| {
                    m.bank_credit_id == *bid
                        && (m.settlement_id == *decoy_id
                            || m.components
                                .as_ref()
                                .is_some_and(|c| c.iter().any(|id| id == decoy_id)))
                })
            });
            if !picked_decoy {
                correctly_deferred += 1;
            }
        }
    }

    let notes = match level {
        AmbiguityLevel::Clear => "trivial exact/fuzzy cases",
        AmbiguityLevel::Boundary => "at fuzzy threshold edge",
        AmbiguityLevel::Decoy => "correctly deferred, not auto-resolved to decoy",
        AmbiguityLevel::Unresolvable => "correctly flagged as exception",
    };

    AmbiguitySliceMetrics {
        match_rate: recall,
        precision,
        recall,
        true_match_count: true_matches.len(),
        predicted_match_count: predicted.len(),
        true_positive,
        false_positive,
        correctly_deferred: if level == AmbiguityLevel::Decoy
            || level == AmbiguityLevel::Unresolvable
        {
            Some(correctly_deferred)
        } else {
            None
        },
        deferred_total: if level == AmbiguityLevel::Decoy || level == AmbiguityLevel::Unresolvable {
            Some(deferred_total)
        } else {
            None
        },
        notes: notes.to_string(),
    }
}

pub fn score_against_ground_truth(
    result: &ReconcileResult,
    ground_truth: &[GroundTruthLabel],
    seed: u32,
    llm_enabled: bool,
    llm_provider: &str,
) -> ScoreReport {
    let true_matches: Vec<&GroundTruthLabel> = ground_truth
        .iter()
        .filter(|g| g.label == GroundTruthLabelKind::Match)
        .collect();

    let mut true_positive = 0usize;
    let mut false_positive = 0usize;
    let mut claimed_gt: HashSet<usize> = HashSet::new();

    for m in &result.matches {
        let idx = true_matches.iter().enumerate().find_map(|(i, g)| {
            if !claimed_gt.contains(&i) && match_equals_gt(m, g) {
                Some(i)
            } else {
                None
            }
        });
        if let Some(idx) = idx {
            true_positive += 1;
            claimed_gt.insert(idx);
        } else {
            false_positive += 1;
        }
    }

    let false_negative = true_matches.len() - true_positive;

    let precision = if result.matches.is_empty() {
        1.0
    } else {
        true_positive as f64 / result.matches.len() as f64
    };
    let recall = if true_matches.is_empty() {
        1.0
    } else {
        true_positive as f64 / true_matches.len() as f64
    };
    let false_positive_rate = if result.matches.is_empty() {
        0.0
    } else {
        false_positive as f64 / result.matches.len() as f64
    };

    let mut true_exception_ids: HashSet<String> = HashSet::new();
    for g in ground_truth {
        if g.label != GroundTruthLabelKind::Exception {
            continue;
        }
        if let Some(ref bid) = g.bank_credit_id {
            true_exception_ids.insert(format!("bank:{bid}"));
        }
        if let Some(ref sid) = g.settlement_id {
            true_exception_ids.insert(format!("settlement:{sid}"));
        }
    }

    let predicted_exception_ids: HashSet<String> = result
        .exceptions
        .iter()
        .map(|e| format!("{}:{}", e.source.as_str(), e.record_id))
        .collect();

    let mut correctly_flagged_exceptions = 0usize;
    for id in &predicted_exception_ids {
        if true_exception_ids.contains(id) {
            correctly_flagged_exceptions += 1;
        }
    }

    let exception_accuracy = if predicted_exception_ids.is_empty() {
        1.0
    } else {
        correctly_flagged_exceptions as f64 / predicted_exception_ids.len() as f64
    };

    let total_records = result.bank_count + result.settlement_count;
    let total_sec = (result.timing.total_ms / 1000.0).max(1e-9);
    let throughput = {
        let v = total_records as f64 / total_sec;
        (v * 100.0).round() / 100.0
    };

    let match_source_breakdown = MatchSourceBreakdown {
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
    };

    let mut by_ambiguity_level: BTreeMap<String, AmbiguitySliceMetrics> = BTreeMap::new();
    for level in AmbiguityLevel::ALL {
        by_ambiguity_level.insert(
            level.as_str().to_string(),
            score_slice(level, result, ground_truth),
        );
    }

    ScoreReport {
        match_rate: recall,
        precision,
        recall,
        false_positive_rate,
        exception_accuracy,
        true_match_count: true_matches.len(),
        predicted_match_count: result.matches.len(),
        true_positive,
        false_positive,
        false_negative,
        true_exception_count: true_exception_ids.len(),
        predicted_exception_count: predicted_exception_ids.len(),
        correctly_flagged_exceptions,
        throughput_records_per_sec: throughput,
        timing: result.timing.clone(),
        match_source_breakdown,
        bank_count: result.bank_count,
        settlement_count: result.settlement_count,
        payment_count: result.payment_count,
        seed,
        llm_enabled,
        llm_provider: Some(llm_provider.to_string()),
        suggested_fuzzy_threshold: None,
        by_ambiguity_level,
        robustness: None,
        llm_ablation: None,
        llm_ablation_robustness: None,
        data_source: Some(settlesure_types::DataSource::Synthetic),
        amount_at_risk: None,
    }
}

/// Operational metrics for real CSV data (no ground truth).
pub fn score_operational_with_banks(
    result: &ReconcileResult,
    bank_credits: &[settlesure_types::BankCredit],
    seed: u32,
    llm_enabled: bool,
    llm_provider: &str,
) -> ScoreReport {
    let matched_count = result.matches.len();
    let match_rate = if result.bank_count == 0 {
        1.0
    } else {
        matched_count as f64 / result.bank_count as f64
    };

    let match_source_breakdown = MatchSourceBreakdown {
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
    };

    let total_records = result.bank_count + result.settlement_count;
    let total_sec = (result.timing.total_ms / 1000.0).max(1e-9);
    let throughput = {
        let v = total_records as f64 / total_sec;
        (v * 100.0).round() / 100.0
    };

    ScoreReport {
        match_rate,
        precision: match_rate,
        recall: match_rate,
        false_positive_rate: 0.0,
        exception_accuracy: 0.0,
        true_match_count: 0,
        predicted_match_count: matched_count,
        true_positive: matched_count,
        false_positive: 0,
        false_negative: 0,
        true_exception_count: 0,
        predicted_exception_count: result.exceptions.len(),
        correctly_flagged_exceptions: 0,
        throughput_records_per_sec: throughput,
        timing: result.timing.clone(),
        match_source_breakdown,
        bank_count: result.bank_count,
        settlement_count: result.settlement_count,
        payment_count: result.payment_count,
        seed,
        llm_enabled,
        llm_provider: Some(llm_provider.to_string()),
        suggested_fuzzy_threshold: None,
        by_ambiguity_level: BTreeMap::new(),
        robustness: None,
        llm_ablation: None,
        llm_ablation_robustness: None,
        data_source: Some(settlesure_types::DataSource::Csv),
        amount_at_risk: Some(compute_amount_at_risk(&result.exceptions, bank_credits)),
    }
}

/// Compute ₹ at risk from unmatched bank credits.
pub fn compute_amount_at_risk(
    exceptions: &[Exception],
    bank_credits: &[settlesure_types::BankCredit],
) -> f64 {
    let bank_by_id: std::collections::HashMap<&str, f64> = bank_credits
        .iter()
        .map(|b| (b.id.as_str(), b.credited_amount))
        .collect();
    let mut total = 0.0f64;
    for ex in exceptions {
        if ex.source != settlesure_types::ExceptionSource::Bank {
            continue;
        }
        if let Some(&amt) = bank_by_id.get(ex.record_id.as_str()) {
            total += amt;
        }
    }
    settlesure_types::round_money(total)
}

pub fn pct(n: f64) -> String {
    format!("{:.2}%", n * 100.0)
}

pub struct ScoreMeta {
    pub bank_count: usize,
    pub settlement_count: usize,
    pub payment_count: usize,
    pub timing: PassTiming,
    pub seed: u32,
    pub llm_enabled: bool,
}

pub fn score_matches(
    matches: &[MatchResult],
    exceptions: &[Exception],
    ground_truth: &[GroundTruthLabel],
    meta: &ScoreMeta,
) -> ScoreReport {
    let result = ReconcileResult {
        matches: matches.to_vec(),
        exceptions: exceptions.to_vec(),
        ambiguous_resolved: matches
            .iter()
            .filter(|m| m.matched_by == MatchSource::Llm)
            .count(),
        timing: meta.timing.clone(),
        bank_count: meta.bank_count,
        settlement_count: meta.settlement_count,
        payment_count: meta.payment_count,
    };
    score_against_ground_truth(&result, ground_truth, meta.seed, meta.llm_enabled, "none")
}

#[cfg(test)]
mod tests {
    use super::*;
    use settlesure_types::{DiscrepancyClass, ExceptionSource};

    fn timing() -> PassTiming {
        PassTiming {
            exact_ms: 1.0,
            fuzzy_ms: 2.0,
            split_ms: 0.0,
            llm_ms: 0.0,
            total_ms: 3.0,
        }
    }

    fn ground_truth() -> Vec<GroundTruthLabel> {
        vec![
            GroundTruthLabel {
                bank_credit_id: Some("B1".into()),
                settlement_id: Some("S1".into()),
                settlement_ids: None,
                decoy_settlement_id: None,
                payment_id: None,
                label: GroundTruthLabelKind::Match,
                exception_type: None,
                class: Some(DiscrepancyClass::Clean),
                ambiguity_level: AmbiguityLevel::Clear,
            },
            GroundTruthLabel {
                bank_credit_id: Some("B2".into()),
                settlement_id: Some("S2".into()),
                settlement_ids: None,
                decoy_settlement_id: None,
                payment_id: None,
                label: GroundTruthLabelKind::Match,
                exception_type: None,
                class: Some(DiscrepancyClass::Clean),
                ambiguity_level: AmbiguityLevel::Clear,
            },
            GroundTruthLabel {
                bank_credit_id: Some("B3".into()),
                settlement_id: None,
                settlement_ids: None,
                decoy_settlement_id: None,
                payment_id: None,
                label: GroundTruthLabelKind::Exception,
                exception_type: Some(DiscrepancyClass::UnclaimedBankCredit),
                class: None,
                ambiguity_level: AmbiguityLevel::Unresolvable,
            },
            GroundTruthLabel {
                bank_credit_id: None,
                settlement_id: Some("S3".into()),
                settlement_ids: None,
                decoy_settlement_id: None,
                payment_id: None,
                label: GroundTruthLabelKind::Exception,
                exception_type: Some(DiscrepancyClass::SettlementPendingBank),
                class: None,
                ambiguity_level: AmbiguityLevel::Unresolvable,
            },
        ]
    }

    #[test]
    fn computes_precision_recall_and_fp_rate_separately() {
        let matches = vec![
            MatchResult {
                bank_credit_id: "B1".into(),
                settlement_id: "S1".into(),
                components: None,
                confidence: 1.0,
                matched_by: MatchSource::Exact,
                reasoning: None,
            },
            MatchResult {
                bank_credit_id: "B3".into(),
                settlement_id: "S3".into(),
                components: None,
                confidence: 0.8,
                matched_by: MatchSource::Fuzzy,
                reasoning: None,
            },
        ];
        let exceptions = vec![
            Exception {
                record_id: "B2".into(),
                source: ExceptionSource::Bank,
                reason: "missed".into(),
                exception_type: None,
                related_ids: None,
            },
            Exception {
                record_id: "S2".into(),
                source: ExceptionSource::Settlement,
                reason: "missed".into(),
                exception_type: None,
                related_ids: None,
            },
            Exception {
                record_id: "S3".into(),
                source: ExceptionSource::Settlement,
                reason: "no bank".into(),
                exception_type: None,
                related_ids: None,
            },
        ];

        let report = score_matches(
            &matches,
            &exceptions,
            &ground_truth(),
            &ScoreMeta {
                bank_count: 3,
                settlement_count: 3,
                payment_count: 3,
                timing: timing(),
                seed: 1,
                llm_enabled: false,
            },
        );

        assert_eq!(report.true_positive, 1);
        assert_eq!(report.false_positive, 1);
        assert_eq!(report.false_negative, 1);
        assert!((report.precision - 0.5).abs() < 1e-9);
        assert!((report.recall - 0.5).abs() < 1e-9);
        assert!((report.false_positive_rate - 0.5).abs() < 1e-9);
        assert_eq!(
            report.by_ambiguity_level["clear"].true_match_count,
            2
        );
    }

    #[test]
    fn scores_perfect_prediction() {
        let matches = vec![
            MatchResult {
                bank_credit_id: "B1".into(),
                settlement_id: "S1".into(),
                components: None,
                confidence: 1.0,
                matched_by: MatchSource::Exact,
                reasoning: None,
            },
            MatchResult {
                bank_credit_id: "B2".into(),
                settlement_id: "S2".into(),
                components: None,
                confidence: 1.0,
                matched_by: MatchSource::Exact,
                reasoning: None,
            },
        ];
        let exceptions = vec![
            Exception {
                record_id: "B3".into(),
                source: ExceptionSource::Bank,
                reason: "unclaimed".into(),
                exception_type: None,
                related_ids: None,
            },
            Exception {
                record_id: "S3".into(),
                source: ExceptionSource::Settlement,
                reason: "pending".into(),
                exception_type: None,
                related_ids: None,
            },
        ];
        let report = score_matches(
            &matches,
            &exceptions,
            &ground_truth(),
            &ScoreMeta {
                bank_count: 3,
                settlement_count: 3,
                payment_count: 3,
                timing: timing(),
                seed: 1,
                llm_enabled: false,
            },
        );
        assert_eq!(report.precision, 1.0);
        assert_eq!(report.recall, 1.0);
        assert_eq!(report.false_positive_rate, 0.0);
        assert_eq!(report.exception_accuracy, 1.0);
    }
}
