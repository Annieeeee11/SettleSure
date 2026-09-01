//! Pass 2: fuzzy scoring and greedy assignment.

use crate::reference::reference_similarity;
use crate::release_gate::{fuzzy_eligible_for_auto_release, hold_fuzzy_match_for_review};
use settlesure_types::{
    amount_tolerance, AmbiguousCandidate, AmbiguousKind, AmbiguousRival, BankCredit,
    DiscrepancyClass, Exception, ExceptionSource, MatchResult, MatchSource, ReconcileConfig,
    Settlement, DEFAULT_CONFIG,
};
use std::collections::{HashMap, HashSet};

fn parse_date_ms(date_str: &str) -> i64 {
    // YYYY-MM-DD at 12:00:00Z — matches TS `new Date(`${date}T12:00:00Z`)`
    let parts: Vec<&str> = date_str.split('-').collect();
    if parts.len() != 3 {
        return 0;
    }
    let y: i64 = parts[0].parse().unwrap_or(0);
    let m: i64 = parts[1].parse().unwrap_or(1);
    let d: i64 = parts[2].parse().unwrap_or(1);
    // Approximate epoch days via chrono-free civil date → days since 1970
    days_from_civil(y, m, d) * 86_400_000 + 12 * 3_600_000
}

/// Howard Hinnant civil_from_days inverse — days since Unix epoch.
fn days_from_civil(y: i64, m: i64, d: i64) -> i64 {
    let y = if m <= 2 { y - 1 } else { y };
    let era = if y >= 0 { y } else { y - 399 } / 400;
    let yoe = y - era * 400;
    let mp = if m > 2 { m - 3 } else { m + 9 };
    let doy = (153 * mp + 2) / 5 + d - 1;
    let doe = yoe * 365 + yoe / 4 - yoe / 100 + doy;
    era * 146_097 + doe - 719_468
}

/// Absolute day difference between two `YYYY-MM-DD` strings (noon UTC).
pub fn days_apart(a: &str, b: &str) -> f64 {
    ((parse_date_ms(a) - parse_date_ms(b)) as f64).abs() / (1000.0 * 60.0 * 60.0 * 24.0)
}

fn amount_score(bank_amount: f64, settlement_amount: f64, config: &ReconcileConfig) -> f64 {
    let diff = (bank_amount - settlement_amount).abs();
    let tol = amount_tolerance(bank_amount, config);
    if diff == 0.0 {
        return 1.0;
    }
    if diff > tol {
        return 0.0;
    }
    1.0 - diff / tol
}

fn date_score(bank_date: &str, settlement_date: &str, config: &ReconcileConfig) -> f64 {
    let days = days_apart(bank_date, settlement_date);
    if days == 0.0 {
        return 1.0;
    }
    if days > config.date_window_days {
        return 0.0;
    }
    1.0 - days / (config.date_window_days + 1.0)
}

pub fn score_pair(
    bank: &BankCredit,
    settlement: &Settlement,
    config: &ReconcileConfig,
) -> (f64, String, bool) {
    if bank.currency != settlement.currency {
        return (
            0.0,
            "currency mismatch, not auto-resolved".into(),
            true,
        );
    }

    let a = amount_score(bank.credited_amount, settlement.net_amount, config);
    let d = date_score(&bank.credited_at, &settlement.settled_at, config);
    let r = reference_similarity(&bank.utr, &settlement.utr);

    if a == 0.0 || d == 0.0 {
        return (
            0.0,
            "no counterpart within date/amount window".into(),
            false,
        );
    }

    let score =
        config.weight_amount * a + config.weight_date * d + config.weight_reference * r;

    let mut parts = Vec::new();
    if a < 1.0 {
        parts.push(format!("amount delta within tolerance (score {a:.2})"));
    }
    if d < 1.0 {
        parts.push(format!(
            "date off by {:.0}d",
            days_apart(&bank.credited_at, &settlement.settled_at)
        ));
    }
    if r < 1.0 {
        parts.push(format!("UTR similarity {r:.2}"));
    }
    if parts.is_empty() {
        parts.push("near-exact fuzzy agreement".into());
    }

    (score, parts.join("; "), false)
}

pub struct FuzzyMatchResult {
    pub matches: Vec<MatchResult>,
    pub ambiguous: Vec<AmbiguousCandidate>,
    pub exceptions: Vec<Exception>,
    pub remaining_bank: Vec<BankCredit>,
    pub remaining_settlements: Vec<Settlement>,
}

struct Scored {
    bank: BankCredit,
    settlement: Settlement,
    score: f64,
    reason: String,
    currency_mismatch: bool,
}

type BucketKey = (String, i64, i64);

type PairKey = (String, String);

const MIN_REF_SIMILARITY: f64 = 0.65;

fn pair_key(bank: &BankCredit, settlement: &Settlement) -> PairKey {
    (bank.id.clone(), settlement.settlement_id.clone())
}

fn is_cross_currency_mismatch_pair(bank: &BankCredit, settlement: &Settlement) -> bool {
    bank.currency != settlement.currency
        && bank.utr == settlement.utr
        && bank.credited_at == settlement.settled_at
        && bank.credited_amount == settlement.net_amount
}

fn push_candidate_if_eligible(
    candidates: &mut Vec<Scored>,
    bank: &BankCredit,
    settlement: &Settlement,
    config: &ReconcileConfig,
) {
    if is_cross_currency_mismatch_pair(bank, settlement) {
        candidates.push(Scored {
            bank: bank.clone(),
            settlement: settlement.clone(),
            score: 0.0,
            reason: "currency mismatch, not auto-resolved".into(),
            currency_mismatch: true,
        });
        return;
    }

    let (score, reason, currency_mismatch) = score_pair(bank, settlement, config);
    if currency_mismatch {
        return;
    }

    let ref_sim = reference_similarity(&bank.utr, &settlement.utr);
    if ref_sim < MIN_REF_SIMILARITY {
        return;
    }

    if score >= config.ambiguous_low {
        candidates.push(Scored {
            bank: bank.clone(),
            settlement: settlement.clone(),
            score,
            reason,
            currency_mismatch: false,
        });
    }
}

fn collect_scored_candidates_brute(
    bank_pool: &[BankCredit],
    settlement_pool: &[Settlement],
    config: &ReconcileConfig,
) -> Vec<Scored> {
    let mut candidates = Vec::new();
    for bank in bank_pool {
        for settlement in settlement_pool {
            push_candidate_if_eligible(&mut candidates, bank, settlement, config);
        }
    }
    candidates
}

fn collect_scored_candidates_bucketed(
    bank_pool: &[BankCredit],
    settlement_pool: &[Settlement],
    config: &ReconcileConfig,
) -> Vec<Scored> {
    let mut candidates = Vec::new();
    let settlement_index = build_settlement_index(settlement_pool, config);

    for bank in bank_pool {
        let settlement_indices = candidate_settlement_indices(bank, &settlement_index, config);
        for idx in settlement_indices {
            push_candidate_if_eligible(
                &mut candidates,
                bank,
                &settlement_pool[idx],
                config,
            );
        }
    }

    // Cross-currency pairs are not in the same currency bucket.
    for bank in bank_pool {
        for settlement in settlement_pool {
            if is_cross_currency_mismatch_pair(bank, settlement) {
                candidates.push(Scored {
                    bank: bank.clone(),
                    settlement: settlement.clone(),
                    score: 0.0,
                    reason: "currency mismatch, not auto-resolved".into(),
                    currency_mismatch: true,
                });
            }
        }
    }

    candidates
}

/// Pre-greedy candidate pair keys — brute O(banks × settlements). Test-only parity oracle.
#[doc(hidden)]
pub fn fuzzy_candidate_pair_keys_brute(
    bank_pool: &[BankCredit],
    settlement_pool: &[Settlement],
    config: &ReconcileConfig,
) -> HashSet<PairKey> {
    collect_scored_candidates_brute(bank_pool, settlement_pool, config)
        .iter()
        .map(|c| pair_key(&c.bank, &c.settlement))
        .collect()
}

/// Pre-greedy candidate pair keys — bucketed pre-filter (production path).
#[doc(hidden)]
pub fn fuzzy_candidate_pair_keys_bucketed(
    bank_pool: &[BankCredit],
    settlement_pool: &[Settlement],
    config: &ReconcileConfig,
) -> HashSet<PairKey> {
    collect_scored_candidates_bucketed(bank_pool, settlement_pool, config)
        .iter()
        .map(|c| pair_key(&c.bank, &c.settlement))
        .collect()
}

fn amount_bucket(amount: f64, config: &ReconcileConfig) -> i64 {
    let width = amount_tolerance(amount, config).max(0.01);
    (amount / width).floor() as i64
}

fn date_bucket(date: &str, config: &ReconcileConfig) -> i64 {
    let window_ms = (config.date_window_days * 86_400_000.0).max(1.0) as i64;
    parse_date_ms(date) / window_ms
}

fn build_settlement_index(
    settlement_pool: &[Settlement],
    config: &ReconcileConfig,
) -> HashMap<BucketKey, Vec<usize>> {
    let mut index: HashMap<BucketKey, Vec<usize>> = HashMap::new();
    for (idx, settlement) in settlement_pool.iter().enumerate() {
        let key = (
            settlement.currency.clone(),
            amount_bucket(settlement.net_amount, config),
            date_bucket(&settlement.settled_at, config),
        );
        index.entry(key).or_default().push(idx);
    }
    index
}

fn candidate_settlement_indices(
    bank: &BankCredit,
    index: &HashMap<BucketKey, Vec<usize>>,
    config: &ReconcileConfig,
) -> Vec<usize> {
    let base_a = amount_bucket(bank.credited_amount, config);
    let base_d = date_bucket(&bank.credited_at, config);
    let mut out = Vec::new();
    let mut seen = HashSet::new();
    for da in -1..=1 {
        for dd in -1..=1 {
            let key = (
                bank.currency.clone(),
                base_a + da,
                base_d + dd,
            );
            if let Some(idxs) = index.get(&key) {
                for &idx in idxs {
                    if seen.insert(idx) {
                        out.push(idx);
                    }
                }
            }
        }
    }
    out
}

pub fn fuzzy_match(
    bank_pool: &[BankCredit],
    settlement_pool: &[Settlement],
    config: &ReconcileConfig,
) -> FuzzyMatchResult {
    let mut matches = Vec::new();
    let mut ambiguous = Vec::new();
    let mut exceptions = Vec::new();
    let mut used_settlement: HashSet<String> = HashSet::new();
    let mut resolved_bank: HashSet<String> = HashSet::new();

    let mut candidates =
        collect_scored_candidates_bucketed(bank_pool, settlement_pool, config);

    candidates.sort_by(|a, b| b.score.partial_cmp(&a.score).unwrap_or(std::cmp::Ordering::Equal));

    let mut currency_mismatch_bank: HashSet<String> = HashSet::new();
    let mut currency_mismatch_settlement: HashSet<String> = HashSet::new();

    // Process candidates in score order — need index access for rivals, so clone scores list
    let candidates_snapshot = candidates
        .iter()
        .map(|c| {
            (
                c.bank.id.clone(),
                c.settlement.settlement_id.clone(),
                c.score,
                c.reason.clone(),
                c.currency_mismatch,
                c.bank.clone(),
                c.settlement.clone(),
            )
        })
        .collect::<Vec<_>>();

    for c in &candidates {
        if c.currency_mismatch {
            if c.bank.utr == c.settlement.utr
                && c.bank.credited_at == c.settlement.settled_at
                && c.bank.credited_amount == c.settlement.net_amount
            {
                currency_mismatch_bank.insert(c.bank.id.clone());
                currency_mismatch_settlement.insert(c.settlement.settlement_id.clone());
            }
            continue;
        }
        if resolved_bank.contains(&c.bank.id)
            || used_settlement.contains(&c.settlement.settlement_id)
        {
            continue;
        }

        if c.score >= config.fuzzy_accept_threshold {
            let scores_for_bank: Vec<f64> = candidates_snapshot
                .iter()
                .filter(|(_, _, score, _, cm, bank, _)| {
                    !*cm && bank.id == c.bank.id && *score >= config.ambiguous_low
                })
                .map(|(_, _, score, _, _, _, _)| *score)
                .collect();
            let mut sorted = scores_for_bank;
            sorted.sort_by(|a, b| b.partial_cmp(a).unwrap_or(std::cmp::Ordering::Equal));
            let runner_up = if sorted.len() >= 2 {
                Some(sorted[1])
            } else {
                None
            };

            if fuzzy_eligible_for_auto_release(
                &c.bank,
                &c.settlement,
                c.score,
                runner_up,
                config,
            ) {
                resolved_bank.insert(c.bank.id.clone());
                used_settlement.insert(c.settlement.settlement_id.clone());
                matches.push(MatchResult {
                    bank_credit_id: c.bank.id.clone(),
                    settlement_id: c.settlement.settlement_id.clone(),
                    components: None,
                    confidence: (c.score * 10000.0).round() / 10000.0,
                    matched_by: MatchSource::Fuzzy,
                    reasoning: Some(c.reason.clone()),
                });
            } else {
                resolved_bank.insert(c.bank.id.clone());
                used_settlement.insert(c.settlement.settlement_id.clone());
                exceptions.push(hold_fuzzy_match_for_review(
                    &c.bank.id,
                    &c.settlement.settlement_id,
                    "score margin too narrow or amount not exact — requires human review",
                ));
                exceptions.push(Exception {
                    record_id: c.settlement.settlement_id.clone(),
                    source: ExceptionSource::Settlement,
                    reason: "paired bank credit held for human review (release gate)".into(),
                    exception_type: None,
                    related_ids: Some(vec![c.bank.id.clone()]),
                });
            }
        } else if c.score >= config.ambiguous_low && c.score < config.ambiguous_high {
            resolved_bank.insert(c.bank.id.clone());

            const TOP_K: usize = 3;
            let mut for_bank: Vec<_> = candidates_snapshot
                .iter()
                .filter(|(_, _, score, _, cm, bank, sett)| {
                    !*cm
                        && bank.id == c.bank.id
                        && *score >= config.ambiguous_low
                        && !used_settlement.contains(&sett.settlement_id)
                })
                .collect();
            for_bank.sort_by(|a, b| b.2.partial_cmp(&a.2).unwrap_or(std::cmp::Ordering::Equal));
            let top: Vec<_> = for_bank.into_iter().take(TOP_K).collect();
            let primary = top.first().map(|t| t.6.clone()).unwrap_or_else(|| c.settlement.clone());
            let primary_bank = top.first().map(|t| t.5.clone()).unwrap_or_else(|| c.bank.clone());
            let primary_score = top.first().map(|t| t.2).unwrap_or(c.score);
            let primary_reason = top
                .first()
                .map(|t| t.3.clone())
                .unwrap_or_else(|| c.reason.clone());

            used_settlement.insert(primary.settlement_id.clone());
            let rivals: Vec<AmbiguousRival> = top
                .iter()
                .skip(1)
                .map(|t| AmbiguousRival {
                    settlement: t.6.clone(),
                    score: (t.2 * 10000.0).round() / 10000.0,
                    reasoning: t.3.clone(),
                })
                .collect();

            ambiguous.push(AmbiguousCandidate {
                bank: primary_bank,
                settlement: primary,
                score: (primary_score * 10000.0).round() / 10000.0,
                reasoning: primary_reason,
                rivals: if rivals.is_empty() { None } else { Some(rivals) },
                split_options: None,
                kind: Some(AmbiguousKind::Fuzzy),
            });
        }
    }

    for bank in bank_pool {
        if resolved_bank.contains(&bank.id) {
            continue;
        }
        if currency_mismatch_bank.contains(&bank.id) {
            exceptions.push(Exception {
                record_id: bank.id.clone(),
                source: ExceptionSource::Bank,
                reason: "currency mismatch, not auto-resolved".into(),
                exception_type: Some(DiscrepancyClass::CurrencyMismatch),
                related_ids: None,
            });
            resolved_bank.insert(bank.id.clone());
        }
    }

    for settlement in settlement_pool {
        if used_settlement.contains(&settlement.settlement_id) {
            continue;
        }
        if currency_mismatch_settlement.contains(&settlement.settlement_id) {
            exceptions.push(Exception {
                record_id: settlement.settlement_id.clone(),
                source: ExceptionSource::Settlement,
                reason: "currency mismatch, not auto-resolved".into(),
                exception_type: Some(DiscrepancyClass::CurrencyMismatch),
                related_ids: None,
            });
            used_settlement.insert(settlement.settlement_id.clone());
        }
    }

    FuzzyMatchResult {
        matches,
        ambiguous,
        exceptions,
        remaining_bank: bank_pool
            .iter()
            .filter(|b| !resolved_bank.contains(&b.id))
            .cloned()
            .collect(),
        remaining_settlements: settlement_pool
            .iter()
            .filter(|s| !used_settlement.contains(&s.settlement_id))
            .cloned()
            .collect(),
    }
}

pub fn fuzzy_match_default(
    bank_pool: &[BankCredit],
    settlement_pool: &[Settlement],
) -> FuzzyMatchResult {
    fuzzy_match(bank_pool, settlement_pool, &DEFAULT_CONFIG)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn bank(id: &str) -> BankCredit {
        BankCredit {
            id: id.into(),
            utr: "UTR000001ABCDEF".into(),
            credited_amount: 1000.0,
            credited_at: "2025-01-15".into(),
            currency: "INR".into(),
        }
    }

    fn settlement(id: &str) -> Settlement {
        Settlement {
            settlement_id: id.into(),
            payment_id: "pay_0001".into(),
            gross_amount: 1050.0,
            fee: 40.0,
            tax: 10.0,
            net_amount: 1000.0,
            settled_at: "2025-01-15".into(),
            utr: "UTR000001ABCDEF".into(),
            currency: "INR".into(),
        }
    }

    #[test]
    fn accepts_date_shifted() {
        let mut b = bank("B1");
        b.credited_at = "2025-01-15".into();
        let mut s = settlement("S1");
        s.settled_at = "2025-01-17".into();
        let r = fuzzy_match_default(&[b], &[s]);
        assert_eq!(r.matches.len(), 1);
        assert_eq!(r.matches[0].matched_by, MatchSource::Fuzzy);
    }

    #[test]
    fn accepts_amount_within_tol() {
        let mut b = bank("B1");
        b.credited_amount = 1000.0;
        let mut s = settlement("S1");
        s.net_amount = 1010.0;
        let r = fuzzy_match_default(&[b], &[s]);
        assert_eq!(r.matches.len(), 1);
    }

    #[test]
    fn flags_currency_mismatch() {
        let mut b = bank("B1");
        b.currency = "USD".into();
        let r = fuzzy_match_default(&[b], &[settlement("S1")]);
        assert!(r.matches.is_empty());
        assert!(r.exceptions.iter().any(|e| e.reason.contains("currency")));
    }

    #[test]
    fn leaves_unmatched_in_remaining() {
        let mut b = bank("B1");
        b.credited_at = "2025-01-01".into();
        b.credited_amount = 100.0;
        let mut s = settlement("S1");
        s.settled_at = "2025-02-01".into();
        s.net_amount = 5000.0;
        let r = fuzzy_match_default(&[b], &[s]);
        assert!(r.matches.is_empty());
        assert_eq!(r.remaining_bank.len(), 1);
        assert_eq!(r.remaining_settlements.len(), 1);
    }
}
