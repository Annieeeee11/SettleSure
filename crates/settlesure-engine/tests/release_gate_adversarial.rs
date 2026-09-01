//! Adversarial release-gate integration tests.

use settlesure_engine::{fuzzy_match, reconcile_skip_llm, FUZZY_ACCEPT_THRESHOLD_FLOOR};
use settlesure_types::{
    BankCredit, MatchSource, Payment, ReconcileConfig, Settlement, DEFAULT_CONFIG,
};

fn cfg() -> ReconcileConfig {
    let mut c = DEFAULT_CONFIG.clone();
    c.fuzzy_accept_threshold = FUZZY_ACCEPT_THRESHOLD_FLOOR;
    c
}

#[test]
fn narrow_margin_fuzzy_routes_to_release_gate_not_auto_match() {
    let bank = BankCredit {
        id: "B_MARGIN".into(),
        utr: "UTRMARGIN123456".into(),
        credited_amount: 1000.0,
        credited_at: "2025-01-15".into(),
        currency: "INR".into(),
    };
    let settlements = vec![
        Settlement {
            settlement_id: "S_TOP".into(),
            payment_id: "pay_1".into(),
            gross_amount: 1020.0,
            fee: 15.0,
            tax: 5.0,
            net_amount: 1000.0,
            settled_at: "2025-01-15".into(),
            utr: "UTRMARGIN123456".into(),
            currency: "INR".into(),
        },
        Settlement {
            settlement_id: "S_RUNNER".into(),
            payment_id: "pay_2".into(),
            gross_amount: 1020.0,
            fee: 15.0,
            tax: 5.0,
            net_amount: 1000.0,
            settled_at: "2025-01-15".into(),
            utr: "UTRMARGIN12345X".into(),
            currency: "INR".into(),
        },
    ];

    let result = fuzzy_match(&[bank.clone()], &settlements, &cfg());
    assert!(
        result.matches.is_empty(),
        "near-tied fuzzy candidates must not auto-release"
    );
    assert!(
        result.exceptions.iter().any(|e| e.reason.contains("release gate"))
            || result.exceptions.iter().any(|e| e.reason.contains("human review")),
        "expected release-gate exception, got: {:?}",
        result.exceptions
    );
}

#[test]
fn llm_match_without_utr_corroboration_is_held() {
    let payments = vec![Payment {
        order_id: "o1".into(),
        payment_id: "pay_1".into(),
        amount: 1000.0,
        currency: "INR".into(),
        status: settlesure_types::PaymentStatus::Captured,
        created_at: "2025-01-10".into(),
    }];
    let settlements = vec![Settlement {
        settlement_id: "S1".into(),
        payment_id: "pay_1".into(),
        gross_amount: 1020.0,
        fee: 15.0,
        tax: 5.0,
        net_amount: 1000.0,
        settled_at: "2025-01-15".into(),
        utr: "UTRDIFFERENT99".into(),
        currency: "INR".into(),
    }];
    let bank = vec![BankCredit {
        id: "B1".into(),
        utr: "UTRORIGINAL123".into(),
        credited_amount: 1000.0,
        credited_at: "2025-01-15".into(),
        currency: "INR".into(),
    }];

    let result = reconcile_skip_llm(&payments, &settlements, &bank, &cfg(), &[]);
    assert!(
        !result.matches.iter().any(|m| m.matched_by == MatchSource::Llm),
        "LLM tier skipped; no spurious LLM matches"
    );
}
