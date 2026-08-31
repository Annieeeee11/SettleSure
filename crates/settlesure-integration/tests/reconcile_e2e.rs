//! Workspace integration tests — e2e reconcile (seed 42) + merge parity.

use settlesure_data::generate_dataset;
use settlesure_engine::{merge_llm_matches, reconcile_skip_llm};
use settlesure_scoring::{check_reconciliation_invariant, score_against_ground_truth};
use settlesure_types::{
    AmbiguityLevel, MatchResult, MatchSource, Payment, PaymentStatus, ReconcileConfig, Settlement,
    BankCredit, DEFAULT_CONFIG,
};

#[test]
fn seed42_skip_llm_meets_baseline_gates() {
    let dataset = generate_dataset(42, Default::default()).expect("generate");
    let mut cfg = DEFAULT_CONFIG.clone();
    cfg.skip_llm = true;
    cfg.seed = Some(42);
    let result = reconcile_skip_llm(
        &dataset.payments,
        &dataset.settlements,
        &dataset.bank_credits,
        &cfg,
        &[],
    );
    let metrics = score_against_ground_truth(&result, &dataset.ground_truth, 42, false, "none");

    assert_eq!(metrics.precision, 1.0);
    assert_eq!(metrics.false_positive_rate, 0.0);
    assert!(metrics.recall >= 0.84);
    assert!(metrics.match_rate >= 0.84);
    assert!(metrics.recall < 1.0, "seed-42 skip-llm should leave LLM-tier cases unresolved");

    for level in AmbiguityLevel::ALL {
        let slice = metrics
            .by_ambiguity_level
            .get(level.as_str())
            .unwrap_or_else(|| panic!("missing slice {}", level.as_str()));
        let _ = slice.match_rate;
        let _ = slice.precision;
        let _ = slice.recall;
    }

    let decoy = &metrics.by_ambiguity_level["decoy"];
    if decoy.deferred_total.unwrap_or(0) > 0 {
        assert_eq!(decoy.correctly_deferred, decoy.deferred_total);
    }

    assert_eq!(metrics.match_source_breakdown.exact, 23);
    assert_eq!(metrics.match_source_breakdown.fuzzy, 17);
    assert_eq!(metrics.match_source_breakdown.split, 2);
    assert_eq!(metrics.match_source_breakdown.llm, 0);
    assert_eq!(metrics.match_source_breakdown.human, 0);
    assert!(check_reconciliation_invariant(&result).is_ok());
    // Fuzzy bucket pre-filter parity: see fuzzy_bucket_parity.rs
}

#[test]
fn seed42_does_not_split_match_duplicate_bank() {
    let dataset = generate_dataset(42, Default::default()).expect("generate");
    let dup_bank_id = dataset
        .ground_truth
        .iter()
        .find(|g| g.exception_type == Some(settlesure_types::DiscrepancyClass::DuplicateBank))
        .and_then(|g| g.bank_credit_id.clone())
        .expect("duplicate bank GT row");
    let mut cfg = DEFAULT_CONFIG.clone();
    cfg.skip_llm = true;
    cfg.seed = Some(42);
    let result = reconcile_skip_llm(
        &dataset.payments,
        &dataset.settlements,
        &dataset.bank_credits,
        &cfg,
        &[],
    );

    assert!(!result
        .matches
        .iter()
        .any(|m| m.bank_credit_id == dup_bank_id));

    let ex = result
        .exceptions
        .iter()
        .find(|e| e.record_id == dup_bank_id)
        .expect("duplicate bank exception");
    assert_eq!(
        ex.exception_type,
        Some(settlesure_types::DiscrepancyClass::DuplicateBank)
    );
    assert_eq!(ex.source, settlesure_types::ExceptionSource::Bank);
    assert!(ex.reason.to_lowercase().contains("duplicate bank credit"));
}

#[test]
fn reserves_utr_on_split_pool_enqueue() {
    let date = "2025-01-15";
    let payments = vec![
        Payment {
            order_id: "order_1".into(),
            payment_id: "pay_1".into(),
            amount: 102.36,
            currency: "INR".into(),
            status: PaymentStatus::Captured,
            created_at: date.into(),
        },
        Payment {
            order_id: "order_2".into(),
            payment_id: "pay_2".into(),
            amount: 51.18,
            currency: "INR".into(),
            status: PaymentStatus::Captured,
            created_at: date.into(),
        },
        Payment {
            order_id: "order_3".into(),
            payment_id: "pay_3".into(),
            amount: 51.18,
            currency: "INR".into(),
            status: PaymentStatus::Captured,
            created_at: date.into(),
        },
    ];
    let settlements = vec![
        Settlement {
            settlement_id: "setl_1".into(),
            payment_id: "pay_1".into(),
            gross_amount: 102.36,
            fee: 2.0,
            tax: 0.36,
            net_amount: 100.0,
            settled_at: date.into(),
            utr: "SETL_UTR_AAAA".into(),
            currency: "INR".into(),
        },
        Settlement {
            settlement_id: "setl_2".into(),
            payment_id: "pay_2".into(),
            gross_amount: 51.18,
            fee: 1.0,
            tax: 0.18,
            net_amount: 50.0,
            settled_at: date.into(),
            utr: "SETL_UTR_BBBB".into(),
            currency: "INR".into(),
        },
        Settlement {
            settlement_id: "setl_3".into(),
            payment_id: "pay_3".into(),
            gross_amount: 51.18,
            fee: 1.0,
            tax: 0.18,
            net_amount: 50.0,
            settled_at: date.into(),
            utr: "SETL_UTR_CCCC".into(),
            currency: "INR".into(),
        },
    ];
    let bank_credits = vec![
        BankCredit {
            id: "bank_dup_a".into(),
            utr: "SHARED_UTR_999".into(),
            credited_amount: 100.0,
            credited_at: date.into(),
            currency: "INR".into(),
        },
        BankCredit {
            id: "bank_dup_b".into(),
            utr: "SHARED_UTR_999".into(),
            credited_amount: 100.0,
            credited_at: date.into(),
            currency: "INR".into(),
        },
    ];

    let mut cfg = ReconcileConfig {
        skip_llm: true,
        seed: Some(42),
        ..DEFAULT_CONFIG.clone()
    };
    let _ = &mut cfg;
    let result = reconcile_skip_llm(&payments, &settlements, &bank_credits, &cfg, &[]);

    let matched_dup = result
        .matches
        .iter()
        .filter(|m| m.bank_credit_id.starts_with("bank_dup_"))
        .count();
    assert!(matched_dup <= 1);

    let dup_ex = result.exceptions.iter().find(|e| {
        e.exception_type == Some(settlesure_types::DiscrepancyClass::DuplicateBank)
            && e.record_id.starts_with("bank_dup_")
    });
    assert!(dup_ex.is_some());
    assert!(dup_ex
        .unwrap()
        .related_ids
        .as_ref()
        .unwrap()[0]
        .starts_with("bank_dup_"));
}

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
fn merge_rejects_claimed_component() {
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
}

#[test]
fn merge_first_claim_wins() {
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
    assert_eq!(exceptions[0].record_id, "bank_2");
}
