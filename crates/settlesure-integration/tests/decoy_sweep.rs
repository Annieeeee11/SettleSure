//! Decoy offset sweep — port of scripts/sweep-decoys.ts intent.

use settlesure_data::{generate_dataset, GenerateDatasetOpts};
use settlesure_engine::reconcile_skip_llm;
use settlesure_scoring::score_against_ground_truth;
use settlesure_types::DEFAULT_CONFIG;
use std::fs;
use std::path::PathBuf;

fn pct(n: f64) -> String {
    format!("{:.2}%", n * 100.0)
}

fn run_cell(opts: GenerateDatasetOpts) -> (String, String, String, String) {
    let dataset = generate_dataset(42, opts).expect("generate");
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
    let decoy = &metrics.by_ambiguity_level["decoy"];
    let deferred = if decoy.deferred_total.unwrap_or(0) > 0 {
        format!(
            "{}/{}",
            decoy.correctly_deferred.unwrap_or(0),
            decoy.deferred_total.unwrap_or(0)
        )
    } else {
        "n/a".into()
    };
    (
        deferred,
        pct(metrics.false_positive_rate),
        pct(metrics.precision),
        pct(metrics.recall),
    )
}

/// Accept-band decoy bait must cross the fuzzy accept threshold at generation time.
#[test]
fn accept_band_decoys_cross_threshold() {
    use settlesure_engine::score_pair;
    use settlesure_types::{DiscrepancyClass, GroundTruthLabelKind, DEFAULT_CONFIG};

    let dataset = generate_dataset(42, GenerateDatasetOpts::default()).expect("generate");
    let accept_classes = [
        DiscrepancyClass::AcceptBandDecoyAmountUtr,
        DiscrepancyClass::AcceptBandDecoyUtrAmountTol,
        DiscrepancyClass::AcceptBandDecoyDateWrongRef,
    ];
    for cls in accept_classes {
        let decoy_labels: Vec<_> = dataset
            .ground_truth
            .iter()
            .filter(|g| g.exception_type == Some(cls))
            .collect();
        assert_eq!(decoy_labels.len(), 1, "expected one decoy row for {cls:?}");
        let decoy_id = decoy_labels[0].settlement_id.as_ref().unwrap();
        let decoy = dataset
            .settlements
            .iter()
            .find(|s| &s.settlement_id == decoy_id)
            .expect("decoy settlement");
        let match_label = dataset
            .ground_truth
            .iter()
            .find(|g| g.decoy_settlement_id.as_deref() == Some(decoy_id.as_str()))
            .expect("match row with decoy_settlement_id");
        let bank_id = match_label.bank_credit_id.as_ref().unwrap();
        let bank = dataset
            .bank_credits
            .iter()
            .find(|b| &b.id == bank_id)
            .expect("bank credit");
        let (score, _, _) = score_pair(bank, decoy, &DEFAULT_CONFIG);
        assert!(
            score >= DEFAULT_CONFIG.fuzzy_accept_threshold,
            "{cls:?} decoy score {score:.4} below accept threshold"
        );
        let true_id = match_label.settlement_id.as_ref().unwrap();
        let true_setl = dataset
            .settlements
            .iter()
            .find(|s| &s.settlement_id == true_id)
            .expect("true settlement");
        let (true_score, _, _) = score_pair(bank, true_setl, &DEFAULT_CONFIG);
        assert!(
            true_score > score + 0.01,
            "{cls:?} true {true_score:.4} must beat decoy {score:.4}"
        );
        assert_eq!(match_label.label, GroundTruthLabelKind::Match);
    }
}

#[test]
fn decoy_sweep_default_cell_defers_all() {
    let (deferred, fp, precision, recall) = run_cell(GenerateDatasetOpts::default());
    assert_eq!(deferred, "22/22");
    assert_eq!(fp, "0.00%");
    assert_eq!(precision, "100.00%");
    assert!(recall.starts_with("85.") || recall.starts_with("84.") || recall.starts_with("82."));
}

/// Writes `output/decoy-sweep.md` when RUN_SWEEP=1 (manual / CI optional).
#[test]
fn write_decoy_sweep_markdown_when_requested() {
    if std::env::var("RUN_SWEEP").ok().as_deref() != Some("1") {
        return;
    }
    let amount_deltas = [0.005, 0.01, 0.012, 0.015, 0.02];
    let date_offsets = [1i32, 2, 3];
    let true_date_offsets = [3i32, 4, 5];

    let mut lines = vec![
        "# Near-duplicate decoy offset sweep".into(),
        String::new(),
        "Seed **42**, `--skip-llm`. Varies decoy amount delta and date offset;".into(),
        "true settlement defaults to **+3d**. Default decoy cell is **±1.2% / +2d**.".into(),
        String::new(),
        "| Amount Δ | Date offset (d) | Decoy deferral | FP rate | Precision | Recall |".into(),
        "| ---: | ---: | ---: | ---: | ---: | ---: |".into(),
    ];

    for amount in amount_deltas {
        for days in date_offsets {
            let (deferred, fp, precision, recall) = run_cell(GenerateDatasetOpts {
                decoy_amount_delta_pct: amount,
                decoy_date_offset_days: days as i64,
                ..Default::default()
            });
            lines.push(format!(
                "| {:.1}% | {days} | {deferred} | {fp} | {precision} | {recall} |",
                amount * 100.0
            ));
        }
    }

    lines.push(String::new());
    lines.push("## True settlement date offset".into());
    lines.push(String::new());
    lines.push("| True date offset (d) | Decoy deferral | FP rate | Precision | Recall |".into());
    lines.push("| ---: | ---: | ---: | ---: | ---: |".into());
    for true_days in true_date_offsets {
        let (deferred, fp, precision, recall) = run_cell(GenerateDatasetOpts {
            true_date_offset_days: true_days as i64,
            ..Default::default()
        });
        lines.push(format!(
            "| {true_days} | {deferred} | {fp} | {precision} | {recall} |"
        ));
    }
    lines.push(String::new());

    let root = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../..");
    let out = root.join("output/decoy-sweep.md");
    fs::create_dir_all(out.parent().unwrap()).unwrap();
    fs::write(&out, lines.join("\n")).unwrap();
}
