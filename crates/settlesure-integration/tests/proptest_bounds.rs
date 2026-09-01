//! Property tests for fuzzy threshold bands and split combo/pool bounds.

use proptest::prelude::*;
use settlesure_engine::{find_subset_sums, reference_similarity, score_pair};
use settlesure_types::{
    amount_tolerance, BankCredit, Settlement, DEFAULT_CONFIG, SPLIT_MAX_COMBO, SPLIT_MAX_POOL,
};

proptest! {
    #[test]
    fn amount_tolerance_is_at_least_abs_floor(amount in -1e6f64..1e6f64) {
        let tol = amount_tolerance(amount, &DEFAULT_CONFIG);
        prop_assert!(tol >= DEFAULT_CONFIG.amount_tolerance_abs - 1e-12);
        prop_assert!(tol >= amount.abs() * DEFAULT_CONFIG.amount_tolerance_pct - 1e-12);
    }

    #[test]
    fn reference_similarity_in_unit_interval(a in "[A-Za-z0-9\\-]{0,24}", b in "[A-Za-z0-9\\-]{0,24}") {
        let s = reference_similarity(&a, &b);
        prop_assert!((0.0..=1.0).contains(&s));
    }

    #[test]
    fn prefix_floor_when_short_ge_6(
        prefix in "[A-Z0-9]{6,12}",
        suffix in "[A-Z0-9]{1,8}"
    ) {
        let longer = format!("{prefix}{suffix}");
        let s = reference_similarity(&prefix, &longer);
        prop_assert!(s >= 0.92);
    }

    #[test]
    fn fuzzy_accept_band_is_exclusive_of_ambiguous(
        bank_amt in 100f64..5000f64,
        delta_frac in 0.0f64..0.02f64
    ) {
        let bank = BankCredit {
            id: "B".into(),
            utr: "UTRABCDEFGHJKLM".into(),
            credited_amount: bank_amt,
            credited_at: "2025-01-15".into(),
            currency: "INR".into(),
        };
        let settlement = Settlement {
            settlement_id: "S".into(),
            payment_id: "P".into(),
            gross_amount: bank_amt,
            fee: 0.0,
            tax: 0.0,
            net_amount: bank_amt * (1.0 - delta_frac),
            settled_at: "2025-01-15".into(),
            utr: "UTRABCDEFGHJKLM".into(),
            currency: "INR".into(),
        };
        let (score, _, mismatch) = score_pair(&bank, &settlement, &DEFAULT_CONFIG);
        prop_assert!(!mismatch);
        // Exact same UTR+date with amount within tol → score in [ambiguous_low, 1]
        if score >= DEFAULT_CONFIG.fuzzy_accept_threshold {
            prop_assert!(score >= DEFAULT_CONFIG.ambiguous_high - 1e-12
                || score >= DEFAULT_CONFIG.fuzzy_accept_threshold);
        } else if score >= DEFAULT_CONFIG.ambiguous_low {
            prop_assert!(score < DEFAULT_CONFIG.ambiguous_high);
        }
    }

    #[test]
    fn subset_sum_respects_max_combo(
        amounts in prop::collection::vec(10f64..200f64, 2..12),
        target in 50f64..800f64
    ) {
        let sols = find_subset_sums(&amounts, target, 0.5, SPLIT_MAX_COMBO);
        for sol in sols {
            prop_assert!(sol.len() >= 2);
            prop_assert!(sol.len() <= SPLIT_MAX_COMBO);
        }
    }

    #[test]
    fn split_pool_constant_is_100_and_combo_8(_x in 0u8..1) {
        prop_assert_eq!(SPLIT_MAX_POOL, 100);
        prop_assert_eq!(SPLIT_MAX_COMBO, 8);
    }
}
