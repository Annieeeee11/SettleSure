//! Pass 3: bounded subset-sum split matching.

use crate::fuzzy::days_apart;
use settlesure_types::{
    amount_tolerance, round_money, AmbiguousCandidate, AmbiguousKind, BankCredit, Exception,
    MatchResult, MatchSource, ReconcileConfig, Settlement, DEFAULT_CONFIG, SPLIT_MAX_COMBO,
    SPLIT_MAX_POOL,
};
use std::collections::HashSet;

/// Find all subsets (by index) of size 2..max_combo summing to target within tol.
pub fn find_subset_sums(
    amounts: &[f64],
    target: f64,
    tol: f64,
    max_combo: usize,
) -> Vec<Vec<usize>> {
    let mut solutions = Vec::new();
    let mut chosen = Vec::new();

    fn dfs(
        start: usize,
        chosen: &mut Vec<usize>,
        sum: f64,
        ctx: &DfsCtx<'_>,
        solutions: &mut Vec<Vec<usize>>,
    ) {
        if chosen.len() >= 2 && (sum - ctx.target).abs() <= ctx.tol {
            solutions.push(chosen.clone());
        }
        if chosen.len() >= ctx.max_combo {
            return;
        }
        for i in start..ctx.amounts.len() {
            let next = round_money(sum + ctx.amounts[i]);
            if next > ctx.target + ctx.tol {
                continue;
            }
            chosen.push(i);
            dfs(i + 1, chosen, next, ctx, solutions);
            chosen.pop();
        }
    }

    struct DfsCtx<'a> {
        amounts: &'a [f64],
        target: f64,
        tol: f64,
        max_combo: usize,
    }

    let ctx = DfsCtx {
        amounts,
        target,
        tol,
        max_combo,
    };
    dfs(0, &mut chosen, 0.0, &ctx, &mut solutions);
    solutions
}

pub struct SplitMatchResult {
    pub matches: Vec<MatchResult>,
    pub ambiguous: Vec<AmbiguousCandidate>,
    pub exceptions: Vec<Exception>,
    pub remaining_bank: Vec<BankCredit>,
    pub remaining_settlements: Vec<Settlement>,
}

pub fn split_match(
    bank_pool: &[BankCredit],
    settlement_pool: &[Settlement],
    config: &ReconcileConfig,
) -> SplitMatchResult {
    debug_assert_eq!(config.split_max_pool, SPLIT_MAX_POOL);
    debug_assert_eq!(config.split_max_combo, SPLIT_MAX_COMBO);

    let mut matches = Vec::new();
    let mut ambiguous = Vec::new();
    let exceptions = Vec::new();
    let mut used_settlements: HashSet<String> = HashSet::new();
    let mut resolved_bank: HashSet<String> = HashSet::new();

    for bank in bank_pool {
        if resolved_bank.contains(&bank.id) {
            continue;
        }

        let mut candidates: Vec<Settlement> = settlement_pool
            .iter()
            .filter(|s| {
                !used_settlements.contains(&s.settlement_id)
                    && s.currency == bank.currency
                    && days_apart(&s.settled_at, &bank.credited_at) <= config.split_date_window_days
            })
            .cloned()
            .collect();

        let linked: Vec<Settlement> = candidates
            .iter()
            .filter(|s| s.utr.starts_with(&format!("{}_S", bank.utr)))
            .cloned()
            .collect();
        if linked.len() >= 2 {
            candidates = linked;
        }

        if candidates.len() < 2 {
            continue;
        }

        candidates.truncate(config.split_max_pool);
        let amounts: Vec<f64> = candidates.iter().map(|s| s.net_amount).collect();
        let tol = amount_tolerance(bank.credited_amount, config);
        let solutions = find_subset_sums(&amounts, bank.credited_amount, tol, config.split_max_combo);

        if solutions.is_empty() {
            continue;
        }

        if solutions.len() > 1 {
            let split_options: Vec<Vec<String>> = solutions
                .iter()
                .take(5)
                .map(|sol| {
                    let mut ids: Vec<String> = sol
                        .iter()
                        .map(|&i| candidates[i].settlement_id.clone())
                        .collect();
                    ids.sort();
                    ids
                })
                .collect();
            let primary = candidates[solutions[0][0]].clone();
            let reasoning = format!(
                "ambiguous split — multiple settlement combinations sum to credit: {}",
                split_options
                    .iter()
                    .map(|ids| ids.join("+"))
                    .collect::<Vec<_>>()
                    .join(" | ")
            );
            ambiguous.push(AmbiguousCandidate {
                bank: bank.clone(),
                settlement: primary,
                score: 0.5,
                reasoning,
                rivals: None,
                split_options: Some(split_options),
                kind: Some(AmbiguousKind::Split),
            });
            resolved_bank.insert(bank.id.clone());
            continue;
        }

        let sol = &solutions[0];
        let components: Vec<String> = sol
            .iter()
            .map(|&i| candidates[i].settlement_id.clone())
            .collect();
        for id in &components {
            used_settlements.insert(id.clone());
        }
        resolved_bank.insert(bank.id.clone());

        matches.push(MatchResult {
            bank_credit_id: bank.id.clone(),
            settlement_id: components[0].clone(),
            components: Some(components.clone()),
            confidence: 1.0,
            matched_by: MatchSource::Split,
            reasoning: Some(format!(
                "Unique subset-sum: {} = {}",
                components.join(" + "),
                bank.credited_amount
            )),
        });
    }

    SplitMatchResult {
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
            .filter(|s| !used_settlements.contains(&s.settlement_id))
            .cloned()
            .collect(),
    }
}

pub fn split_match_default(
    bank_pool: &[BankCredit],
    settlement_pool: &[Settlement],
) -> SplitMatchResult {
    split_match(bank_pool, settlement_pool, &DEFAULT_CONFIG)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn bank(id: &str, amount: f64, utr: &str) -> BankCredit {
        BankCredit {
            id: id.into(),
            utr: utr.into(),
            credited_amount: amount,
            credited_at: "2025-01-15".into(),
            currency: "INR".into(),
        }
    }

    fn settlement(id: &str, net: f64, utr: &str) -> Settlement {
        Settlement {
            settlement_id: id.into(),
            payment_id: "pay_x".into(),
            gross_amount: net + 20.0,
            fee: 15.0,
            tax: 5.0,
            net_amount: net,
            settled_at: "2025-01-14".into(),
            utr: utr.into(),
            currency: "INR".into(),
        }
    }

    #[test]
    fn finds_exact_sum() {
        let sols = find_subset_sums(&[100.0, 200.0, 50.0], 300.0, 0.01, 6);
        assert!(!sols.is_empty());
        assert!(sols.iter().any(|s| s.len() == 2));
    }

    #[test]
    fn empty_when_no_solution() {
        assert!(find_subset_sums(&[10.0, 20.0, 30.0], 100.0, 0.01, 6).is_empty());
    }

    #[test]
    fn unique_subset_sum() {
        let r = split_match_default(
            &[bank("B1", 300.0, "UTRBATCH01")],
            &[
                settlement("S1", 100.0, "UTRBATCH01_S1"),
                settlement("S2", 200.0, "UTRBATCH01_S2"),
                settlement("S3", 50.0, "OTHER"),
            ],
        );
        assert_eq!(r.matches.len(), 1);
        assert_eq!(r.matches[0].matched_by, MatchSource::Split);
        let mut comps = r.matches[0].components.clone().unwrap();
        comps.sort();
        assert_eq!(comps, vec!["S1", "S2"]);
    }

    #[test]
    fn ambiguous_multi_combo() {
        let r = split_match_default(
            &[bank("B1", 300.0, "UTRMULTI")],
            &[
                settlement("S1", 100.0, "UTRMULTI_S1"),
                settlement("S2", 200.0, "UTRMULTI_S2"),
                settlement("S3", 150.0, "UTRMULTI_S3"),
                settlement("S4", 150.0, "UTRMULTI_S4"),
            ],
        );
        assert!(r.matches.is_empty());
        assert!(r.exceptions.is_empty());
        assert_eq!(r.ambiguous.len(), 1);
        assert_eq!(r.ambiguous[0].kind, Some(AmbiguousKind::Split));
        assert!(r.ambiguous[0].split_options.as_ref().unwrap().len() >= 2);
    }

    #[test]
    fn leaves_pool_when_no_solution() {
        let r = split_match_default(
            &[bank("B1", 999.0, "UTRNONE")],
            &[
                settlement("S1", 100.0, "UTRNONE_S1"),
                settlement("S2", 200.0, "UTRNONE_S2"),
            ],
        );
        assert!(r.matches.is_empty());
        assert_eq!(r.remaining_bank.len(), 1);
    }
}
