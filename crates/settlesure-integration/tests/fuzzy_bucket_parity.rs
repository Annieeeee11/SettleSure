//! Bucket pre-filter must enumerate the same fuzzy candidate pairs as brute force.

use proptest::prelude::*;
use settlesure_engine::{fuzzy_candidate_pair_keys_brute, fuzzy_candidate_pair_keys_bucketed};
use settlesure_types::{BankCredit, Settlement, DEFAULT_CONFIG};

fn valid_date(day: u32) -> String {
    format!("2025-01-{day:02}")
}

proptest! {
    #[test]
    fn bucketed_candidates_match_brute_force(
        bank_count in 1usize..8,
        setl_count in 1usize..12,
        seed in 0u32..10_000,
    ) {
        let mut banks = Vec::new();
        for i in 0..bank_count {
            let day = (i as u32 % 28) + 1;
            banks.push(BankCredit {
                id: format!("bank_{i}"),
                utr: format!("UTR{i:04}ABCDEFGH"),
                credited_amount: 100.0 + (i as f64 * 137.0),
                credited_at: valid_date(day),
                currency: if i % 5 == 0 { "USD".into() } else { "INR".into() },
            });
        }
        let mut settlements = Vec::new();
        for j in 0..setl_count {
            let day = ((j + seed as usize) % 28) + 1;
            let net = 100.0 + (j as f64 * 89.0);
            settlements.push(Settlement {
                settlement_id: format!("setl_{j}"),
                payment_id: format!("pay_{j}"),
                gross_amount: net * 1.02,
                fee: net * 0.01,
                tax: net * 0.005,
                net_amount: net,
                settled_at: valid_date(day as u32),
                utr: format!("UTR{j:04}XYZWVU"),
                currency: if j % 7 == 0 { "EUR".into() } else { "INR".into() },
            });
        }

        let brute = fuzzy_candidate_pair_keys_brute(&banks, &settlements, &DEFAULT_CONFIG);
        let bucketed = fuzzy_candidate_pair_keys_bucketed(&banks, &settlements, &DEFAULT_CONFIG);
        prop_assert!(
            brute == bucketed,
            "brute={brute:?} bucketed={bucketed:?} seed={seed}"
        );
    }
}

#[test]
fn seed42_bucketed_matches_brute_on_generated_data() {
    use settlesure_data::generate_dataset;
    let dataset = generate_dataset(42, Default::default()).expect("generate");
    let brute = fuzzy_candidate_pair_keys_brute(
        &dataset.bank_credits,
        &dataset.settlements,
        &DEFAULT_CONFIG,
    );
    let bucketed = fuzzy_candidate_pair_keys_bucketed(
        &dataset.bank_credits,
        &dataset.settlements,
        &DEFAULT_CONFIG,
    );
    assert_eq!(brute, bucketed, "seed-42 fuzzy bucket parity");
}
