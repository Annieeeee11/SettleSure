//! Markdown/JSON report generation — port of `src/scoring/report.ts`.

use crate::metrics::pct;
use settlesure_types::{AmbiguityLevel, Exception, FullReport, Result as SsResult};
use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::{Path, PathBuf};

pub const KNOWN_LIMITATIONS: &[&str] = &[
    "Split matching uses bounded subset-sum (max pool 25, max combo 6) — demo-scale only.",
    "Ambiguous multi-solution batches are routed to the LLM/human tier (not auto-picked).",
    "No FX conversion — currency mismatches are never auto-resolved.",
    "Fuzzy matching uses net/credited amount, settlement/credit dates, and UTR similarity (prefix-aware).",
    "Duplicate bank credits: first claim (exact/fuzzy/split-pool enqueue) wins; same-UTR leftovers are blocked before split and flagged as exceptions.",
    "Near-duplicate decoys and boundary UTR mangles are intentional hard cases for LLM/human tiers.",
    "Ollama LLM calls use temperature 0 and a fixed seed for reproducibility; Anthropic uses temperature 0.",
];

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct GroupedExceptionRow {
    pub record_ids: Vec<String>,
    pub source: String,
    pub reason: String,
}

/// Collapse related exception rows for human-readable reports (metrics stay per-record).
pub fn group_exceptions_for_display(exceptions: &[Exception]) -> Vec<GroupedExceptionRow> {
    let mut parent: HashMap<String, String> = HashMap::new();

    fn find(parent: &mut HashMap<String, String>, x: &str) -> String {
        let p = parent.get(x).cloned().unwrap_or_else(|| x.to_string());
        if p != x {
            let root = find(parent, &p);
            parent.insert(x.to_string(), root.clone());
            root
        } else {
            p
        }
    }

    fn union(parent: &mut HashMap<String, String>, a: &str, b: &str) {
        let ra = find(parent, a);
        let rb = find(parent, b);
        if ra != rb {
            parent.insert(ra, rb);
        }
    }

    for e in exceptions {
        let key = format!("{}:{}", e.source.as_str(), e.record_id);
        parent.entry(key.clone()).or_insert_with(|| key.clone());
        for rid in e.related_ids.iter().flatten() {
            let mut candidates = vec![format!("bank:{rid}"), format!("settlement:{rid}")];
            if rid.contains(':') {
                candidates.push(rid.clone());
            }
            for c in candidates {
                let exists = exceptions
                    .iter()
                    .any(|x| format!("{}:{}", x.source.as_str(), x.record_id) == c);
                if exists {
                    parent.entry(c.clone()).or_insert_with(|| c.clone());
                    union(&mut parent, &key, &c);
                }
            }
        }
    }

    let mut groups: HashMap<String, Vec<&Exception>> = HashMap::new();
    let mut group_order: Vec<String> = Vec::new();
    for e in exceptions {
        let key = format!("{}:{}", e.source.as_str(), e.record_id);
        let root = find(&mut parent, &key);
        if !groups.contains_key(&root) {
            group_order.push(root.clone());
        }
        groups.entry(root).or_default().push(e);
    }

    let mut rows = Vec::new();
    for root in group_order {
        let members = &groups[&root];
        // Preserve first-seen order like TS Set insertion
        let mut ids = Vec::new();
        let mut seen_ids = HashSet::new();
        let mut sources = Vec::new();
        let mut seen_sources = HashSet::new();
        for m in members {
            if seen_ids.insert(m.record_id.clone()) {
                ids.push(m.record_id.clone());
            }
            let src = m.source.as_str().to_string();
            if seen_sources.insert(src.clone()) {
                sources.push(src);
            }
        }
        rows.push(GroupedExceptionRow {
            record_ids: ids,
            source: sources.join("+"),
            reason: members[0].reason.clone(),
        });
    }
    rows
}

fn capitalize(s: &str) -> String {
    let mut chars = s.chars();
    match chars.next() {
        None => String::new(),
        Some(c) => c.to_uppercase().collect::<String>() + chars.as_str(),
    }
}

pub fn format_markdown(report: &FullReport) -> String {
    let m = &report.metrics;
    let mut lines: Vec<String> = Vec::new();

    lines.push("# Payment Gateway Settlement Reconciliation Report".into());
    lines.push(String::new());
    lines.push(
        "Razorpay-style 3-way flow: **Payment → Settlement → Bank payout credit** (UTR join)."
            .into(),
    );
    lines.push(String::new());
    lines.push(format!(
        "Seed: `{}` · Payments: {} · Settlements: {} · Bank credits: {}",
        m.seed, m.payment_count, m.settlement_count, m.bank_count
    ));
    let llm_line = if m.llm_enabled {
        format!(
            "LLM pass: enabled ({})",
            m.llm_provider.as_deref().unwrap_or("anthropic")
        )
    } else {
        "LLM pass: disabled / unavailable".into()
    };
    lines.push(llm_line);
    lines.push(String::new());

    lines.push("## Headline metrics".into());
    lines.push(String::new());
    lines.push("| Metric | Value |".into());
    lines.push("| --- | --- |".into());
    lines.push(format!(
        "| Match rate (recall on true matches) | {} |",
        pct(m.match_rate)
    ));
    lines.push(format!("| Precision | {} |", pct(m.precision)));
    lines.push(format!("| Recall | {} |", pct(m.recall)));
    lines.push(format!(
        "| False positive rate | {} |",
        pct(m.false_positive_rate)
    ));
    lines.push(format!(
        "| Exception accuracy | {} |",
        pct(m.exception_accuracy)
    ));
    lines.push(format!(
        "| Throughput | {} records/sec |",
        m.throughput_records_per_sec
    ));
    lines.push(format!(
        "| Runtime (total) | {:.2} ms |",
        m.timing.total_ms
    ));
    lines.push(String::new());

    lines.push("### Counts".into());
    lines.push(String::new());
    lines.push(format!(
        "- True matches in ground truth: {}",
        m.true_match_count
    ));
    lines.push(format!("- Predicted matches: {}", m.predicted_match_count));
    lines.push(format!("- True positives: {}", m.true_positive));
    lines.push(format!("- False positives: {}", m.false_positive));
    lines.push(format!("- False negatives: {}", m.false_negative));
    lines.push(format!(
        "- True exception records: {}",
        m.true_exception_count
    ));
    lines.push(format!(
        "- Predicted exception records: {}",
        m.predicted_exception_count
    ));
    lines.push(format!(
        "- Correctly flagged exceptions: {}",
        m.correctly_flagged_exceptions
    ));
    lines.push(String::new());

    lines.push("## Match-source breakdown".into());
    lines.push(String::new());
    lines.push("| Pass | Count |".into());
    lines.push("| --- | ---: |".into());
    lines.push(format!("| Exact | {} |", m.match_source_breakdown.exact));
    lines.push(format!("| Fuzzy | {} |", m.match_source_breakdown.fuzzy));
    lines.push(format!("| Split | {} |", m.match_source_breakdown.split));
    lines.push(format!("| LLM | {} |", m.match_source_breakdown.llm));
    lines.push(format!("| Human | {} |", m.match_source_breakdown.human));
    lines.push(String::new());
    lines.push("| Pass timing | ms |".into());
    lines.push("| --- | ---: |".into());
    lines.push(format!("| Exact | {:.2} |", m.timing.exact_ms));
    lines.push(format!("| Fuzzy | {:.2} |", m.timing.fuzzy_ms));
    lines.push(format!("| Split | {:.2} |", m.timing.split_ms));
    lines.push(format!("| LLM | {:.2} |", m.timing.llm_ms));
    lines.push(format!("| Total | {:.2} |", m.timing.total_ms));
    lines.push(String::new());

    lines.push("## Accuracy by case difficulty".into());
    lines.push(String::new());
    lines.push("| Difficulty | Match rate | Precision | Deferred | Notes |".into());
    lines.push("| --- | --- | --- | --- | --- |".into());
    for level in AmbiguityLevel::ALL {
        let key = level.as_str();
        let Some(s) = m.by_ambiguity_level.get(key) else {
            continue;
        };
        let deferred = if s.deferred_total.unwrap_or(0) > 0 {
            pct(s.correctly_deferred.unwrap_or(0) as f64 / s.deferred_total.unwrap() as f64)
        } else {
            "—".into()
        };
        let mr = if s.true_match_count == 0
            && (level == AmbiguityLevel::Decoy || level == AmbiguityLevel::Unresolvable)
        {
            "—".into()
        } else {
            pct(s.match_rate)
        };
        let pr = if s.true_match_count == 0 && s.predicted_match_count == 0 {
            "—".into()
        } else {
            pct(s.precision)
        };
        lines.push(format!(
            "| {} | {} | {} | {} | {} |",
            capitalize(key),
            mr,
            pr,
            deferred,
            s.notes
        ));
    }
    lines.push(String::new());

    if let Some(ref r) = m.robustness {
        lines.push("## Robustness across seeds".into());
        lines.push(String::new());
        lines.push(format!(
            "Seeds: {}",
            r.seeds
                .iter()
                .map(|s| s.to_string())
                .collect::<Vec<_>>()
                .join(", ")
        ));
        lines.push(String::new());
        lines.push("| Metric | Mean | Min | Max |".into());
        lines.push("| --- | ---: | ---: | ---: |".into());
        lines.push(format!(
            "| Match rate | {} | {} | {} |",
            pct(r.match_rate.mean),
            pct(r.match_rate.min),
            pct(r.match_rate.max)
        ));
        lines.push(format!(
            "| Precision | {} | {} | {} |",
            pct(r.precision.mean),
            pct(r.precision.min),
            pct(r.precision.max)
        ));
        lines.push(format!(
            "| Recall | {} | {} | {} |",
            pct(r.recall.mean),
            pct(r.recall.min),
            pct(r.recall.max)
        ));
        lines.push(format!(
            "| FP rate | {} | {} | {} |",
            pct(r.false_positive_rate.mean),
            pct(r.false_positive_rate.min),
            pct(r.false_positive_rate.max)
        ));
        lines.push(String::new());
    }

    if let Some(ref a) = m.llm_ablation {
        lines.push("## LLM ablation".into());
        lines.push(String::new());
        if !a.provider_available {
            lines.push(
                "_No LLM provider available — with-LLM run fell back to none._".into(),
            );
            lines.push(String::new());
        }
        lines.push("| | With LLM | Without LLM |".into());
        lines.push("| --- | ---: | ---: |".into());
        lines.push(format!(
            "| Match rate | {} | {} |",
            pct(a.with_llm.match_rate),
            pct(a.without_llm.match_rate)
        ));
        lines.push(format!(
            "| Precision | {} | {} |",
            pct(a.with_llm.precision),
            pct(a.without_llm.precision)
        ));
        lines.push(format!(
            "| Recall | {} | {} |",
            pct(a.with_llm.recall),
            pct(a.without_llm.recall)
        ));
        lines.push(format!(
            "| FP rate | {} | {} |",
            pct(a.with_llm.false_positive_rate),
            pct(a.without_llm.false_positive_rate)
        ));
        lines.push(format!(
            "| LLM matches | {} | {} |",
            a.with_llm.llm_matches, a.without_llm.llm_matches
        ));
        lines.push(format!(
            "| Provider | {} | none |",
            a.with_llm.provider.as_deref().unwrap_or("")
        ));
        lines.push(String::new());
    }

    if let Some(threshold) = m.suggested_fuzzy_threshold {
        lines.push("## Suggested fuzzy threshold (from human corrections)".into());
        lines.push(String::new());
        lines.push(format!(
            "Logged suggestion only (not auto-applied): `fuzzyAcceptThreshold` → **{threshold}**"
        ));
        lines.push(String::new());
    }

    lines.push("## Exception list".into());
    lines.push(String::new());
    if report.exceptions.is_empty() {
        lines.push("_No exceptions._".into());
    } else {
        let grouped = group_exceptions_for_display(&report.exceptions);
        lines.push("| Record ID(s) | Source | Reason |".into());
        lines.push("| --- | --- | --- |".into());
        for e in &grouped {
            let reason = e.reason.replace('|', "\\|");
            lines.push(format!(
                "| {} | {} | {} |",
                e.record_ids.join(", "),
                e.source,
                reason
            ));
        }
        lines.push(String::new());
        lines.push(format!(
            "_Grouped by relatedIds for display ({} groups from {} per-record flags). Scoring still uses per-record exceptions._",
            grouped.len(),
            report.exceptions.len()
        ));
    }
    lines.push(String::new());

    lines.push("## Known limitations".into());
    lines.push(String::new());
    for lim in &report.known_limitations {
        lines.push(format!("- {lim}"));
    }
    lines.push(String::new());

    lines.join("\n")
}

/// Write `report.json` and `report.md` under `output_dir`.
/// Returns `(json_path, md_path, markdown)`.
pub fn write_report(report: &FullReport, output_dir: &Path) -> SsResult<(PathBuf, PathBuf, String)> {
    fs::create_dir_all(output_dir)?;
    let json_path = output_dir.join("report.json");
    let md_path = output_dir.join("report.md");
    let markdown = format_markdown(report);

    let json = serde_json::to_string_pretty(report)?;
    fs::write(&json_path, format!("{json}\n"))?;
    fs::write(&md_path, &markdown)?;

    Ok((json_path, md_path, markdown))
}
