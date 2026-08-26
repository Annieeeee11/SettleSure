//! Full port of `src/data/generate.ts` — synthetic SettleSure datasets.

use crate::rng::{create_rng, Mulberry32};
use chrono::{Duration, NaiveDate, TimeZone, Utc};
use settlesure_engine::{levenshtein, normalize_reference, reference_similarity, score_pair};
use settlesure_types::{
    round_money, AmbiguityLevel, BankCredit, Correction, CorrectionDecision, DiscrepancyClass,
    ExceptionSource, GroundTruthLabel, GroundTruthLabelKind, Payment, PaymentStatus,
    ReconcileConfig, Result, SettleSureError, Settlement, DEFAULT_CONFIG,
};
use std::fs;
use std::path::Path;

const UTR_ALPHABET: &[u8] = b"ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/// Fixed demo-correction timestamp for reproducibility.
/// TypeScript used `new Date().toISOString()` (wall clock); Rust uses this constant instead.
const DEMO_CORRECTION_TS: &str = "2026-01-01T00:00:00.000Z";

/// Generated synthetic dataset (TS `GeneratedDataset`).
#[derive(Debug, Clone)]
pub struct GeneratedDataset {
    pub payments: Vec<Payment>,
    pub settlements: Vec<Settlement>,
    pub bank_credits: Vec<BankCredit>,
    pub ground_truth: Vec<GroundTruthLabel>,
    pub demo_corrections: Vec<Correction>,
    pub seed: u32,
}

/// Optional generator knobs; defaults preserve seed-42 reproducibility.
#[derive(Debug, Clone)]
pub struct GenerateDatasetOpts {
    /// Decoy settlement amount offset vs true net (default 0.012 = ±1.2%).
    pub decoy_amount_delta_pct: f64,
    /// Decoy settlement date offset in days (default 2).
    pub decoy_date_offset_days: i64,
    /// True near-dup settlement date offset in days (default 3).
    pub true_date_offset_days: i64,
    /// Multiply each adversarial class count (default 1 = seed-42 layout).
    pub batch_scale: u32,
}

impl Default for GenerateDatasetOpts {
    fn default() -> Self {
        Self {
            // Tighter decoys so true/decoy pairs land in the fuzzy ambiguous band.
            decoy_amount_delta_pct: 0.005,
            decoy_date_offset_days: 2,
            true_date_offset_days: 3,
            batch_scale: 1,
        }
    }
}

fn composite_score(bank: &BankCredit, settlement: &Settlement, cfg: &ReconcileConfig) -> f64 {
    score_pair(bank, settlement, cfg).0
}

/// Mangling that avoids truncated-prefix pairs (which hit the 0.92 ref floor).
fn mangle_non_prefix(utr: &str, target_sim: f64, rng: &mut Mulberry32) -> String {
    let mut best = light_mangle(utr);
    let mut best_diff = (reference_similarity(utr, &best) - target_sim).abs();

    if utr.len() > 5 {
        for i in 2..utr.len().saturating_sub(2) {
            let idx = (rng.next_f64() * 32.0).floor() as usize;
            let ch = UTR_ALPHABET[idx] as char;
            let sub = format!("{}{}{}", &utr[..i], ch, &utr[i + 1..]);
            let sim = reference_similarity(utr, &sub);
            let diff = (sim - target_sim).abs();
            if diff < best_diff {
                best_diff = diff;
                best = sub;
            }
            if i + 2 < utr.len() {
                let del = format!("{}{}", &utr[..i], &utr[i + 2..]);
                let sim2 = reference_similarity(utr, &del);
                let diff2 = (sim2 - target_sim).abs();
                if diff2 < best_diff {
                    best_diff = diff2;
                    best = del;
                }
            }
        }
    }
    best
}

fn is_prefix_pair(full: &str, mangled: &str) -> bool {
    let na = normalize_reference(full);
    let nb = normalize_reference(mangled);
    if na.is_empty() || nb.is_empty() {
        return false;
    }
    let (shorter, longer) = if na.len() <= nb.len() {
        (na.as_str(), nb.as_str())
    } else {
        (nb.as_str(), na.as_str())
    };
    shorter.len() >= 6 && longer.starts_with(shorter)
}

/// Find settlement UTR + date so composite score lands in `[min_score, max_score]`.
fn mangle_for_composite_score(
    bank_utr: &str,
    net: f64,
    bank_date: &str,
    min_score: f64,
    max_score: f64,
    rng: &mut Mulberry32,
) -> (String, String) {
    let bank = BankCredit {
        id: "gen_bank".into(),
        utr: bank_utr.to_string(),
        credited_amount: net,
        credited_at: bank_date.to_string(),
        currency: "INR".into(),
    };
    let cfg = &DEFAULT_CONFIG;
    let mut best: Option<(String, String, f64)> = None;

    for target_sim in [0.55, 0.58, 0.60, 0.62, 0.65, 0.68, 0.70, 0.72] {
        let mangled = mangle_non_prefix(bank_utr, target_sim, rng);
        if is_prefix_pair(bank_utr, &mangled) {
            continue;
        }
        for day_off in 1i64..=3 {
            let settled_at = add_days(bank_date, day_off);
            let settlement = Settlement {
                settlement_id: "gen_setl".into(),
                payment_id: "gen_pay".into(),
                gross_amount: net,
                fee: 0.0,
                tax: 0.0,
                net_amount: net,
                settled_at: settled_at.clone(),
                utr: mangled.clone(),
                currency: "INR".into(),
            };
            let score = composite_score(&bank, &settlement, cfg);
            if score >= min_score && score <= max_score {
                return (mangled, settled_at);
            }
            let diff = if score < min_score {
                min_score - score
            } else {
                score - max_score
            };
            if best.as_ref().is_none_or(|(_, _, d)| diff < *d) {
                best = Some((mangled.clone(), settled_at, diff));
            }
        }
    }

    if let Some((utr, date, _)) = best {
        return (utr, date);
    }
    (
        mangle_non_prefix(bank_utr, 0.65, rng),
        add_days(bank_date, 3),
    )
}

/// Match JS `Math.floor(rng() * (max - min + 1)) + min`.
fn rand_int(rng: &mut Mulberry32, min: i32, max: i32) -> i32 {
    min + (rng.next_f64() * f64::from(max - min + 1)).floor() as i32
}

fn pad(n: u32, width: usize) -> String {
    format!("{:0width$}", n)
}

/// `Date.UTC(2025, 0, 1 + day_offset)` formatted as `YYYY-MM-DD`.
/// Day overflow matches JS (e.g. day 91 rolls into March).
fn format_date_utc_2025(day_offset: i32) -> String {
    // Noon UTC base, then add days — same calendar day as Date.UTC midnight for these offsets.
    let base = Utc
        .with_ymd_and_hms(2025, 1, 1, 12, 0, 0)
        .single()
        .expect("2025-01-01T12:00:00Z");
    let dt = base + Duration::days(i64::from(day_offset));
    dt.format("%Y-%m-%d").to_string()
}

fn add_days(date_str: &str, days: i64) -> String {
    let naive = NaiveDate::parse_from_str(date_str, "%Y-%m-%d")
        .unwrap_or_else(|_| NaiveDate::from_ymd_opt(2025, 1, 1).expect("fallback date"));
    let noon = naive
        .and_hms_opt(12, 0, 0)
        .expect("noon")
        .and_utc();
    let dt = noon + Duration::days(days);
    dt.format("%Y-%m-%d").to_string()
}

fn make_utr(rng: &mut Mulberry32, index: u32) -> String {
    let mut suffix = String::with_capacity(6);
    for _ in 0..6 {
        let idx = (rng.next_f64() * 32.0).floor() as usize;
        suffix.push(UTR_ALPHABET[idx] as char);
    }
    format!("UTR{}{}", pad(index + 1, 6), suffix)
}

fn fee_tax(gross: f64, rng: &mut Mulberry32) -> (f64, f64, f64) {
    let fee = round_money(gross * (0.015 + rng.next_f64() * 0.01));
    let tax = round_money(fee * 0.18);
    let net = round_money(gross - fee - tax);
    (fee, tax, net)
}

fn light_mangle(utr: &str) -> String {
    let head = if utr.len() >= 6 { &utr[..6] } else { utr };
    let tail = if utr.len() > 6 { &utr[6..] } else { "" };
    format!("{head}-{tail}")
}

/// Edit `utr` until normalized Levenshtein similarity ≈ `target_sim` (±0.02).
pub fn mangle_utr_to_similarity(utr: &str, target_sim: f64, rng: &mut Mulberry32) -> String {
    let base = normalize_reference(utr);
    let mut best = utr.to_string();
    let mut best_diff = 1.0_f64;

    let drop_max = 8usize.min(base.len().saturating_sub(4));
    for drop in 1..=drop_max {
        let end = utr.len().saturating_sub(drop).max(4).min(utr.len());
        let cand = &utr[..end];
        let sim = reference_similarity(utr, cand);
        let diff = (sim - target_sim).abs();
        if diff < best_diff {
            best_diff = diff;
            best = cand.to_string();
        }
    }

    if utr.len() > 4 {
        for i in 3..utr.len() - 1 {
            let del = format!("{}{}", &utr[..i], &utr[i + 1..]);
            let sim = reference_similarity(utr, &del);
            let diff = (sim - target_sim).abs();
            if diff < best_diff {
                best_diff = diff;
                best = del;
            }
            let idx = (rng.next_f64() * 32.0).floor() as usize;
            let ch = UTR_ALPHABET[idx] as char;
            let sub = format!("{}{}{}", &utr[..i], ch, &utr[i + 1..]);
            let sim2 = reference_similarity(utr, &sub);
            let diff2 = (sim2 - target_sim).abs();
            if diff2 < best_diff {
                best_diff = diff2;
                best = sub;
            }
        }
    }

    let hyphen = light_mangle(utr);
    let sim_h = reference_similarity(utr, &hyphen);
    if (sim_h - target_sim).abs() < best_diff {
        best = hyphen;
    }

    let max_len = base.len().max(1);
    let target_dist = ((1.0 - target_sim) * max_len as f64).round() as usize;
    if best_diff > 0.04 && target_dist > 0 {
        let end = utr.len().saturating_sub(target_dist).max(4).min(utr.len());
        best = utr[..end].to_string();
    }

    // Parity with TS `void levenshtein` (keep import / silence unused).
    let _ = levenshtein as fn(&str, &str) -> usize;

    best
}

/// Generate the full synthetic dataset for `seed`.
pub fn generate_dataset(seed: u32, opts: GenerateDatasetOpts) -> Result<GeneratedDataset> {
    let decoy_amount_delta_pct = opts.decoy_amount_delta_pct;
    let decoy_date_offset_days = opts.decoy_date_offset_days;
    let true_date_offset_days = opts.true_date_offset_days;
    let mut rng = create_rng(seed);

    let mut payments: Vec<Payment> = Vec::new();
    let mut settlements: Vec<Settlement> = Vec::new();
    let mut bank_credits: Vec<BankCredit> = Vec::new();
    let mut ground_truth: Vec<GroundTruthLabel> = Vec::new();
    let mut demo_corrections: Vec<Correction> = Vec::new();

    let mut pay_seq: u32 = 0;
    let mut set_seq: u32 = 0;
    let mut bank_seq: u32 = 0;
    let mut event_index: u32 = 0;

    let mut next_settlement_id = || {
        set_seq += 1;
        format!("setl_{}", pad(set_seq, 4))
    };
    let mut next_bank_id = || {
        bank_seq += 1;
        format!("bank_{}", pad(bank_seq, 4))
    };

    let class_plan: [(DiscrepancyClass, usize, AmbiguityLevel); 15] = [
        (DiscrepancyClass::Clean, 18, AmbiguityLevel::Clear),
        (DiscrepancyClass::DateShifted, 6, AmbiguityLevel::Clear),
        (DiscrepancyClass::AmountShifted, 5, AmbiguityLevel::Clear),
        (DiscrepancyClass::ReferenceMangled, 3, AmbiguityLevel::Clear),
        (
            DiscrepancyClass::ReferenceMangledBoundary,
            5,
            AmbiguityLevel::Boundary,
        ),
        (
            DiscrepancyClass::FuzzyAmbiguousMatch,
            2,
            AmbiguityLevel::Boundary,
        ),
        (DiscrepancyClass::NearDuplicateDecoy, 3, AmbiguityLevel::Decoy),
        (DiscrepancyClass::BatchedPayout, 2, AmbiguityLevel::Clear),
        (
            DiscrepancyClass::BatchedPayoutAmbiguous,
            2,
            AmbiguityLevel::Decoy,
        ),
        (
            DiscrepancyClass::FeeTaxMismatch,
            3,
            AmbiguityLevel::Unresolvable,
        ),
        (
            DiscrepancyClass::SettlementPendingBank,
            3,
            AmbiguityLevel::Unresolvable,
        ),
        (
            DiscrepancyClass::UnclaimedBankCredit,
            2,
            AmbiguityLevel::Unresolvable,
        ),
        (
            DiscrepancyClass::CurrencyMismatch,
            2,
            AmbiguityLevel::Unresolvable,
        ),
        (
            DiscrepancyClass::UnresolvableNoise,
            3,
            AmbiguityLevel::Unresolvable,
        ),
        (DiscrepancyClass::DuplicateBank, 2, AmbiguityLevel::Clear),
    ];

    let mut push_payment = |amount: f64, currency: &str, date: &str| -> Payment {
        pay_seq += 1;
        let payment_id = format!("pay_{}", pad(pay_seq, 4));
        let order_id = format!("order_{}", pad(pay_seq, 4));
        let p = Payment {
            order_id,
            payment_id,
            amount,
            currency: currency.to_string(),
            status: PaymentStatus::Captured,
            created_at: date.to_string(),
        };
        payments.push(p.clone());
        p
    };

    let mut boundary_auto_left: i32 = 3;

    for &(cls, count, level) in &class_plan {
        let iterations = count * opts.batch_scale.max(1) as usize;
        for _i in 0..iterations {
            let date = format_date_utc_2025(rand_int(&mut rng, 0, 90));
            let gross = round_money(100.0 + rng.next_f64() * 4900.0);
            let currency = "INR";
            let utr = make_utr(&mut rng, event_index);
            event_index += 1;
            let (fee, tax, net) = fee_tax(gross, &mut rng);

            match cls {
                DiscrepancyClass::Clean => {
                    let pay = push_payment(gross, currency, &date);
                    let settlement_id = next_settlement_id();
                    let bank_id = next_bank_id();
                    settlements.push(Settlement {
                        settlement_id: settlement_id.clone(),
                        payment_id: pay.payment_id.clone(),
                        gross_amount: gross,
                        fee,
                        tax,
                        net_amount: net,
                        settled_at: date.clone(),
                        utr: utr.clone(),
                        currency: currency.to_string(),
                    });
                    bank_credits.push(BankCredit {
                        id: bank_id.clone(),
                        utr,
                        credited_amount: net,
                        credited_at: date,
                        currency: currency.to_string(),
                    });
                    ground_truth.push(GroundTruthLabel {
                        bank_credit_id: Some(bank_id),
                        settlement_id: Some(settlement_id),
                        settlement_ids: None,
                        decoy_settlement_id: None,
                        payment_id: Some(pay.payment_id),
                        label: GroundTruthLabelKind::Match,
                        exception_type: None,
                        class: Some(cls),
                        ambiguity_level: level,
                    });
                }
                DiscrepancyClass::DateShifted => {
                    let pay = push_payment(gross, currency, &date);
                    let settlement_id = next_settlement_id();
                    let bank_id = next_bank_id();
                    // TS: randInt(rng, 1, 3) * (rng() < 0.5 ? -1 : 1) — magnitude first.
                    let magnitude = rand_int(&mut rng, 1, 3);
                    let sign = if rng.next_f64() < 0.5 { -1 } else { 1 };
                    let shift = i64::from(magnitude * sign);
                    settlements.push(Settlement {
                        settlement_id: settlement_id.clone(),
                        payment_id: pay.payment_id.clone(),
                        gross_amount: gross,
                        fee,
                        tax,
                        net_amount: net,
                        settled_at: add_days(&date, shift),
                        utr: utr.clone(),
                        currency: currency.to_string(),
                    });
                    bank_credits.push(BankCredit {
                        id: bank_id.clone(),
                        utr,
                        credited_amount: net,
                        credited_at: date,
                        currency: currency.to_string(),
                    });
                    ground_truth.push(GroundTruthLabel {
                        bank_credit_id: Some(bank_id),
                        settlement_id: Some(settlement_id),
                        settlement_ids: None,
                        decoy_settlement_id: None,
                        payment_id: Some(pay.payment_id),
                        label: GroundTruthLabelKind::Match,
                        exception_type: None,
                        class: Some(cls),
                        ambiguity_level: level,
                    });
                }
                DiscrepancyClass::AmountShifted => {
                    let pay = push_payment(gross, currency, &date);
                    let settlement_id = next_settlement_id();
                    let bank_id = next_bank_id();
                    let delta_sign = if rng.next_f64() < 0.5 { -1.0 } else { 1.0 };
                    let delta = round_money(
                        (net * 0.015).min((0.25_f64).max(net * 0.005 + rng.next_f64() * 0.4))
                            * delta_sign,
                    );
                    settlements.push(Settlement {
                        settlement_id: settlement_id.clone(),
                        payment_id: pay.payment_id.clone(),
                        gross_amount: gross,
                        fee,
                        tax,
                        net_amount: net,
                        settled_at: date.clone(),
                        utr: utr.clone(),
                        currency: currency.to_string(),
                    });
                    bank_credits.push(BankCredit {
                        id: bank_id.clone(),
                        utr,
                        credited_amount: round_money(net + delta),
                        credited_at: date,
                        currency: currency.to_string(),
                    });
                    ground_truth.push(GroundTruthLabel {
                        bank_credit_id: Some(bank_id),
                        settlement_id: Some(settlement_id),
                        settlement_ids: None,
                        decoy_settlement_id: None,
                        payment_id: Some(pay.payment_id),
                        label: GroundTruthLabelKind::Match,
                        exception_type: None,
                        class: Some(cls),
                        ambiguity_level: level,
                    });
                }
                DiscrepancyClass::ReferenceMangled => {
                    let pay = push_payment(gross, currency, &date);
                    let settlement_id = next_settlement_id();
                    let bank_id = next_bank_id();
                    settlements.push(Settlement {
                        settlement_id: settlement_id.clone(),
                        payment_id: pay.payment_id.clone(),
                        gross_amount: gross,
                        fee,
                        tax,
                        net_amount: net,
                        settled_at: date.clone(),
                        utr: light_mangle(&utr),
                        currency: currency.to_string(),
                    });
                    bank_credits.push(BankCredit {
                        id: bank_id.clone(),
                        utr,
                        credited_amount: net,
                        credited_at: date,
                        currency: currency.to_string(),
                    });
                    ground_truth.push(GroundTruthLabel {
                        bank_credit_id: Some(bank_id),
                        settlement_id: Some(settlement_id),
                        settlement_ids: None,
                        decoy_settlement_id: None,
                        payment_id: Some(pay.payment_id),
                        label: GroundTruthLabelKind::Match,
                        exception_type: None,
                        class: Some(cls),
                        ambiguity_level: level,
                    });
                }
                DiscrepancyClass::ReferenceMangledBoundary => {
                    let auto_fuzzy = boundary_auto_left > 0;
                    if auto_fuzzy {
                        boundary_auto_left -= 1;
                    }
                    let pay = push_payment(gross, currency, &date);
                    let settlement_id = next_settlement_id();
                    let bank_id = next_bank_id();
                    let (mangled, settled_at) = if auto_fuzzy {
                        (
                            mangle_utr_to_similarity(&utr, 0.78, &mut rng),
                            date.clone(),
                        )
                    } else {
                        mangle_for_composite_score(&utr, net, &date, 0.55, 0.72, &mut rng)
                    };
                    settlements.push(Settlement {
                        settlement_id: settlement_id.clone(),
                        payment_id: pay.payment_id.clone(),
                        gross_amount: gross,
                        fee,
                        tax,
                        net_amount: net,
                        settled_at,
                        utr: mangled,
                        currency: currency.to_string(),
                    });
                    bank_credits.push(BankCredit {
                        id: bank_id.clone(),
                        utr,
                        credited_amount: net,
                        credited_at: date,
                        currency: currency.to_string(),
                    });
                    ground_truth.push(GroundTruthLabel {
                        bank_credit_id: Some(bank_id),
                        settlement_id: Some(settlement_id),
                        settlement_ids: None,
                        decoy_settlement_id: None,
                        payment_id: Some(pay.payment_id),
                        label: GroundTruthLabelKind::Match,
                        exception_type: None,
                        class: Some(cls),
                        ambiguity_level: level,
                    });
                }
                DiscrepancyClass::FuzzyAmbiguousMatch => {
                    let pay_true = push_payment(gross, currency, &date);
                    let true_id = next_settlement_id();
                    let rival_id = next_settlement_id();
                    let bank_id = next_bank_id();
                    let (true_utr, true_date) =
                        mangle_for_composite_score(&utr, net, &date, 0.55, 0.72, &mut rng);
                    let rival_base = format!("{}R", utr);
                    let rival_utr = mangle_non_prefix(&rival_base, 0.66, &mut rng);
                    let rival_net = round_money(net * (1.0 + decoy_amount_delta_pct));
                    let rival_fee = round_money(rival_net * 0.02);
                    let rival_tax = round_money(rival_fee * 0.18);
                    let rival_gross = round_money(rival_net + rival_fee + rival_tax);
                    let pay_rival = push_payment(rival_gross, currency, &date);
                    settlements.push(Settlement {
                        settlement_id: true_id.clone(),
                        payment_id: pay_true.payment_id.clone(),
                        gross_amount: gross,
                        fee,
                        tax,
                        net_amount: net,
                        settled_at: true_date,
                        utr: true_utr,
                        currency: currency.to_string(),
                    });
                    settlements.push(Settlement {
                        settlement_id: rival_id.clone(),
                        payment_id: pay_rival.payment_id.clone(),
                        gross_amount: rival_gross,
                        fee: rival_fee,
                        tax: rival_tax,
                        net_amount: rival_net,
                        settled_at: add_days(&date, decoy_date_offset_days),
                        utr: rival_utr,
                        currency: currency.to_string(),
                    });
                    bank_credits.push(BankCredit {
                        id: bank_id.clone(),
                        utr,
                        credited_amount: net,
                        credited_at: date,
                        currency: currency.to_string(),
                    });
                    ground_truth.push(GroundTruthLabel {
                        bank_credit_id: Some(bank_id),
                        settlement_id: Some(true_id),
                        settlement_ids: None,
                        decoy_settlement_id: Some(rival_id.clone()),
                        payment_id: Some(pay_true.payment_id),
                        label: GroundTruthLabelKind::Match,
                        exception_type: None,
                        class: Some(cls),
                        ambiguity_level: level,
                    });
                    ground_truth.push(GroundTruthLabel {
                        bank_credit_id: None,
                        settlement_id: Some(rival_id),
                        settlement_ids: None,
                        decoy_settlement_id: None,
                        payment_id: Some(pay_rival.payment_id),
                        label: GroundTruthLabelKind::Exception,
                        exception_type: Some(DiscrepancyClass::FuzzyAmbiguousMatch),
                        class: Some(cls),
                        ambiguity_level: level,
                    });
                }
                DiscrepancyClass::NearDuplicateDecoy => {
                    let pay_true = push_payment(gross, currency, &date);
                    let true_id = next_settlement_id();
                    let decoy_id = next_settlement_id();
                    let bank_id = next_bank_id();
                    let true_utr = mangle_non_prefix(&utr, 0.68, &mut rng);
                    let decoy_utr = mangle_non_prefix(&utr, 0.66, &mut rng);
                    let sign = if rng.next_f64() < 0.5 { -1.0 } else { 1.0 };
                    let decoy_net = round_money(net * (1.0 + sign * decoy_amount_delta_pct));
                    let decoy_fee = round_money(decoy_net * 0.02);
                    let decoy_tax = round_money(decoy_fee * 0.18);
                    let decoy_gross = round_money(decoy_net + decoy_fee + decoy_tax);
                    let pay_decoy = push_payment(decoy_gross, currency, &date);
                    let true_settled = add_days(&date, true_date_offset_days);
                    let decoy_settled = add_days(&date, decoy_date_offset_days);
                    settlements.push(Settlement {
                        settlement_id: true_id.clone(),
                        payment_id: pay_true.payment_id.clone(),
                        gross_amount: gross,
                        fee,
                        tax,
                        net_amount: net,
                        settled_at: true_settled,
                        utr: true_utr,
                        currency: currency.to_string(),
                    });
                    settlements.push(Settlement {
                        settlement_id: decoy_id.clone(),
                        payment_id: pay_decoy.payment_id.clone(),
                        gross_amount: decoy_gross,
                        fee: decoy_fee,
                        tax: decoy_tax,
                        net_amount: decoy_net,
                        settled_at: decoy_settled,
                        utr: decoy_utr,
                        currency: currency.to_string(),
                    });
                    bank_credits.push(BankCredit {
                        id: bank_id.clone(),
                        utr,
                        credited_amount: net,
                        credited_at: date,
                        currency: currency.to_string(),
                    });
                    ground_truth.push(GroundTruthLabel {
                        bank_credit_id: Some(bank_id),
                        settlement_id: Some(true_id),
                        settlement_ids: None,
                        decoy_settlement_id: Some(decoy_id.clone()),
                        payment_id: Some(pay_true.payment_id),
                        label: GroundTruthLabelKind::Match,
                        exception_type: None,
                        class: Some(cls),
                        ambiguity_level: level,
                    });
                    ground_truth.push(GroundTruthLabel {
                        bank_credit_id: None,
                        settlement_id: Some(decoy_id),
                        settlement_ids: None,
                        decoy_settlement_id: None,
                        payment_id: Some(pay_decoy.payment_id),
                        label: GroundTruthLabelKind::Exception,
                        exception_type: Some(DiscrepancyClass::NearDuplicateDecoy),
                        class: Some(cls),
                        ambiguity_level: level,
                    });
                }
                DiscrepancyClass::DuplicateBank => {
                    let pay = push_payment(gross, currency, &date);
                    let settlement_id = next_settlement_id();
                    let bank_id = next_bank_id();
                    let dup_bank_id = next_bank_id();
                    settlements.push(Settlement {
                        settlement_id: settlement_id.clone(),
                        payment_id: pay.payment_id.clone(),
                        gross_amount: gross,
                        fee,
                        tax,
                        net_amount: net,
                        settled_at: date.clone(),
                        utr: utr.clone(),
                        currency: currency.to_string(),
                    });
                    bank_credits.push(BankCredit {
                        id: bank_id.clone(),
                        utr: utr.clone(),
                        credited_amount: net,
                        credited_at: date.clone(),
                        currency: currency.to_string(),
                    });
                    bank_credits.push(BankCredit {
                        id: dup_bank_id.clone(),
                        utr,
                        credited_amount: net,
                        credited_at: date,
                        currency: currency.to_string(),
                    });
                    ground_truth.push(GroundTruthLabel {
                        bank_credit_id: Some(bank_id),
                        settlement_id: Some(settlement_id),
                        settlement_ids: None,
                        decoy_settlement_id: None,
                        payment_id: Some(pay.payment_id),
                        label: GroundTruthLabelKind::Match,
                        exception_type: None,
                        class: Some(DiscrepancyClass::Clean),
                        ambiguity_level: AmbiguityLevel::Clear,
                    });
                    ground_truth.push(GroundTruthLabel {
                        bank_credit_id: Some(dup_bank_id),
                        settlement_id: None,
                        settlement_ids: None,
                        decoy_settlement_id: None,
                        payment_id: None,
                        label: GroundTruthLabelKind::Exception,
                        exception_type: Some(DiscrepancyClass::DuplicateBank),
                        class: Some(cls),
                        ambiguity_level: level,
                    });
                }
                DiscrepancyClass::CurrencyMismatch => {
                    let pay = push_payment(gross, "INR", &date);
                    let settlement_id = next_settlement_id();
                    let bank_id = next_bank_id();
                    settlements.push(Settlement {
                        settlement_id: settlement_id.clone(),
                        payment_id: pay.payment_id.clone(),
                        gross_amount: gross,
                        fee,
                        tax,
                        net_amount: net,
                        settled_at: date.clone(),
                        utr: utr.clone(),
                        currency: "INR".to_string(),
                    });
                    bank_credits.push(BankCredit {
                        id: bank_id.clone(),
                        utr,
                        credited_amount: net,
                        credited_at: date,
                        currency: "USD".to_string(),
                    });
                    ground_truth.push(GroundTruthLabel {
                        bank_credit_id: Some(bank_id),
                        settlement_id: None,
                        settlement_ids: None,
                        decoy_settlement_id: None,
                        payment_id: None,
                        label: GroundTruthLabelKind::Exception,
                        exception_type: Some(DiscrepancyClass::CurrencyMismatch),
                        class: Some(cls),
                        ambiguity_level: level,
                    });
                    ground_truth.push(GroundTruthLabel {
                        bank_credit_id: None,
                        settlement_id: Some(settlement_id),
                        settlement_ids: None,
                        decoy_settlement_id: None,
                        payment_id: Some(pay.payment_id),
                        label: GroundTruthLabelKind::Exception,
                        exception_type: Some(DiscrepancyClass::CurrencyMismatch),
                        class: Some(cls),
                        ambiguity_level: level,
                    });
                }
                DiscrepancyClass::FeeTaxMismatch => {
                    let pay = push_payment(gross, currency, &date);
                    let settlement_id = next_settlement_id();
                    let bad_net = round_money(net + 15.0 + rng.next_f64() * 40.0);
                    settlements.push(Settlement {
                        settlement_id: settlement_id.clone(),
                        payment_id: pay.payment_id.clone(),
                        gross_amount: gross,
                        fee,
                        tax,
                        net_amount: bad_net,
                        settled_at: date,
                        utr,
                        currency: currency.to_string(),
                    });
                    ground_truth.push(GroundTruthLabel {
                        bank_credit_id: None,
                        settlement_id: Some(settlement_id),
                        settlement_ids: None,
                        decoy_settlement_id: None,
                        payment_id: Some(pay.payment_id),
                        label: GroundTruthLabelKind::Exception,
                        exception_type: Some(DiscrepancyClass::FeeTaxMismatch),
                        class: Some(cls),
                        ambiguity_level: level,
                    });
                }
                DiscrepancyClass::SettlementPendingBank => {
                    let pay = push_payment(gross, currency, &date);
                    let settlement_id = next_settlement_id();
                    settlements.push(Settlement {
                        settlement_id: settlement_id.clone(),
                        payment_id: pay.payment_id.clone(),
                        gross_amount: gross,
                        fee,
                        tax,
                        net_amount: net,
                        settled_at: date,
                        utr,
                        currency: currency.to_string(),
                    });
                    ground_truth.push(GroundTruthLabel {
                        bank_credit_id: None,
                        settlement_id: Some(settlement_id),
                        settlement_ids: None,
                        decoy_settlement_id: None,
                        payment_id: Some(pay.payment_id),
                        label: GroundTruthLabelKind::Exception,
                        exception_type: Some(DiscrepancyClass::SettlementPendingBank),
                        class: Some(cls),
                        ambiguity_level: level,
                    });
                }
                DiscrepancyClass::UnclaimedBankCredit => {
                    let bank_id = next_bank_id();
                    bank_credits.push(BankCredit {
                        id: bank_id.clone(),
                        utr,
                        credited_amount: net,
                        credited_at: date,
                        currency: currency.to_string(),
                    });
                    ground_truth.push(GroundTruthLabel {
                        bank_credit_id: Some(bank_id),
                        settlement_id: None,
                        settlement_ids: None,
                        decoy_settlement_id: None,
                        payment_id: None,
                        label: GroundTruthLabelKind::Exception,
                        exception_type: Some(DiscrepancyClass::UnclaimedBankCredit),
                        class: Some(cls),
                        ambiguity_level: level,
                    });
                }
                DiscrepancyClass::BatchedPayout => {
                    let n = 3;
                    let mut settlement_ids: Vec<String> = Vec::with_capacity(n);
                    let mut sum_net = 0.0;
                    let batch_date = date.clone();
                    let batch_utr = utr.clone();
                    let parts = [
                        round_money(100.0 + rng.next_f64() * 20.0),
                        round_money(250.0 + rng.next_f64() * 30.0),
                        round_money(400.0 + rng.next_f64() * 40.0),
                    ];
                    for (k, &forced_net) in parts.iter().enumerate().take(n) {
                        let fee_k = round_money(forced_net * 0.02);
                        let tax_k = round_money(fee_k * 0.18);
                        let g = round_money(forced_net + fee_k + tax_k);
                        let pay = push_payment(g, currency, &batch_date);
                        let settlement_id = next_settlement_id();
                        settlement_ids.push(settlement_id.clone());
                        sum_net = round_money(sum_net + forced_net);
                        settlements.push(Settlement {
                            settlement_id,
                            payment_id: pay.payment_id,
                            gross_amount: g,
                            fee: fee_k,
                            tax: tax_k,
                            net_amount: forced_net,
                            settled_at: add_days(&batch_date, (k % 2) as i64),
                            utr: format!("{}_S{}", batch_utr, k + 1),
                            currency: currency.to_string(),
                        });
                    }
                    let bank_id = next_bank_id();
                    bank_credits.push(BankCredit {
                        id: bank_id.clone(),
                        utr: batch_utr,
                        credited_amount: sum_net,
                        credited_at: add_days(&batch_date, 1),
                        currency: currency.to_string(),
                    });
                    ground_truth.push(GroundTruthLabel {
                        bank_credit_id: Some(bank_id),
                        settlement_id: Some(settlement_ids[0].clone()),
                        settlement_ids: Some(settlement_ids),
                        decoy_settlement_id: None,
                        payment_id: None,
                        label: GroundTruthLabelKind::Match,
                        exception_type: None,
                        class: Some(cls),
                        ambiguity_level: level,
                    });
                }
                DiscrepancyClass::BatchedPayoutAmbiguous => {
                    let batch_date = date.clone();
                    let batch_utr = utr.clone();
                    let nets = [100.0, 200.0, 150.0, 150.0];
                    let credit = 300.0;
                    let mut ids: Vec<String> = Vec::with_capacity(4);
                    for (k, &forced_net) in nets.iter().enumerate() {
                        let fee_k = round_money(forced_net * 0.02);
                        let tax_k = round_money(fee_k * 0.18);
                        let g = round_money(forced_net + fee_k + tax_k);
                        let pay = push_payment(g, currency, &batch_date);
                        let settlement_id = next_settlement_id();
                        ids.push(settlement_id.clone());
                        settlements.push(Settlement {
                            settlement_id,
                            payment_id: pay.payment_id,
                            gross_amount: g,
                            fee: fee_k,
                            tax: tax_k,
                            net_amount: forced_net,
                            settled_at: add_days(&batch_date, (k % 2) as i64),
                            utr: format!("{}_S{}", batch_utr, k + 1),
                            currency: currency.to_string(),
                        });
                    }
                    let bank_id = next_bank_id();
                    bank_credits.push(BankCredit {
                        id: bank_id.clone(),
                        utr: batch_utr,
                        credited_amount: credit,
                        credited_at: add_days(&batch_date, 1),
                        currency: currency.to_string(),
                    });
                    ground_truth.push(GroundTruthLabel {
                        bank_credit_id: Some(bank_id.clone()),
                        settlement_id: None,
                        settlement_ids: Some(ids.clone()),
                        decoy_settlement_id: None,
                        payment_id: None,
                        label: GroundTruthLabelKind::Exception,
                        exception_type: Some(DiscrepancyClass::BatchedPayoutAmbiguous),
                        class: Some(cls),
                        ambiguity_level: level,
                    });
                    for sid in &ids {
                        ground_truth.push(GroundTruthLabel {
                            bank_credit_id: None,
                            settlement_id: Some(sid.clone()),
                            settlement_ids: None,
                            decoy_settlement_id: None,
                            payment_id: None,
                            label: GroundTruthLabelKind::Exception,
                            exception_type: Some(DiscrepancyClass::BatchedPayoutAmbiguous),
                            class: Some(cls),
                            ambiguity_level: level,
                        });
                    }
                    let pair = vec![ids[0].clone(), ids[1].clone()];
                    demo_corrections.push(Correction {
                        record_id: bank_id,
                        source: ExceptionSource::Bank,
                        decision: CorrectionDecision::Accept,
                        corrected_match_id: Some(pair[0].clone()),
                        components: Some(pair),
                        score: Some(0.7),
                        ts: DEMO_CORRECTION_TS.to_string(),
                    });
                }
                DiscrepancyClass::UnresolvableNoise => {
                    let bank_id = next_bank_id();
                    let noise_date = "2024-06-15".to_string();
                    let noise_amount = round_money(50000.0 + rng.next_f64() * 20000.0);
                    let noise_utr = format!("NOISE{}XXXXXX", pad(event_index, 8));
                    bank_credits.push(BankCredit {
                        id: bank_id.clone(),
                        utr: noise_utr,
                        credited_amount: noise_amount,
                        credited_at: noise_date,
                        currency: currency.to_string(),
                    });
                    ground_truth.push(GroundTruthLabel {
                        bank_credit_id: Some(bank_id),
                        settlement_id: None,
                        settlement_ids: None,
                        decoy_settlement_id: None,
                        payment_id: None,
                        label: GroundTruthLabelKind::Exception,
                        exception_type: Some(DiscrepancyClass::UnresolvableNoise),
                        class: Some(cls),
                        ambiguity_level: level,
                    });
                }
            }
        }
    }

    if settlements.len() < 50 || bank_credits.len() < 50 {
        return Err(SettleSureError::Message(format!(
            "Dataset too small: settlements={}, bankCredits={}",
            settlements.len(),
            bank_credits.len()
        )));
    }

    Ok(GeneratedDataset {
        payments,
        settlements,
        bank_credits,
        ground_truth,
        demo_corrections,
        seed,
    })
}

fn write_json_pretty(path: &Path, value: &impl serde::Serialize) -> Result<()> {
    let mut body = serde_json::to_string_pretty(value)?;
    body.push('\n');
    fs::write(path, body)?;
    Ok(())
}

/// Write dataset JSON files into `data_dir` (creates the directory if needed).
pub fn write_dataset(dataset: &GeneratedDataset, data_dir: &Path) -> Result<()> {
    fs::create_dir_all(data_dir)?;
    write_json_pretty(&data_dir.join("payments.json"), &dataset.payments)?;
    write_json_pretty(&data_dir.join("settlements.json"), &dataset.settlements)?;
    write_json_pretty(&data_dir.join("bank_credits.json"), &dataset.bank_credits)?;
    write_json_pretty(&data_dir.join("ground_truth.json"), &dataset.ground_truth)?;
    write_json_pretty(
        &data_dir.join("demo_corrections.json"),
        &dataset.demo_corrections,
    )?;
    Ok(())
}

/// Generate with default opts and write to `data_dir`.
pub fn generate_and_write(seed: u32, data_dir: &Path) -> Result<GeneratedDataset> {
    generate_and_write_with_opts(seed, data_dir, GenerateDatasetOpts::default())
}

/// Generate with explicit opts and write to `data_dir`.
pub fn generate_and_write_with_opts(
    seed: u32,
    data_dir: &Path,
    opts: GenerateDatasetOpts,
) -> Result<GeneratedDataset> {
    let dataset = generate_dataset(seed, opts)?;
    write_dataset(&dataset, data_dir)?;
    Ok(dataset)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn seed_42_counts() {
        let d = generate_dataset(42, GenerateDatasetOpts::default()).expect("generate");
        assert!(d.settlements.len() >= 50);
        assert!(d.bank_credits.len() >= 50);
        assert_eq!(d.demo_corrections.len(), 2);
        assert_eq!(d.demo_corrections[0].ts, DEMO_CORRECTION_TS);
        assert_eq!(d.payments[0].payment_id, "pay_0001");
        assert_eq!(d.settlements[0].settlement_id, "setl_0001");
        assert_eq!(d.bank_credits[0].id, "bank_0001");
    }

    #[test]
    fn batch_scale_10_proportional() {
        let d1 = generate_dataset(42, GenerateDatasetOpts::default()).expect("generate");
        let d10 = generate_dataset(
            42,
            GenerateDatasetOpts {
                batch_scale: 10,
                ..GenerateDatasetOpts::default()
            },
        )
        .expect("generate");
        assert_eq!(d10.payments.len(), d1.payments.len() * 10);
        assert_eq!(d10.settlements.len(), d1.settlements.len() * 10);
        assert_eq!(d10.bank_credits.len(), d1.bank_credits.len() * 10);
    }
}
