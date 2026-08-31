//! Terminal report formatting — port of `src/scoring/terminalReport.ts`.

use crate::ansi::{bold, box_frame, cyan, dim, green, red, visible_width, yellow};
use crate::invariant::ReconciliationInvariant;
use crate::metrics::pct;
use crate::report::group_exceptions_for_display;
use settlesure_types::{AmbiguityLevel, FullReport};

const EXCEPTION_PREVIEW: usize = 20;
const LABEL_W: usize = 20;

fn metric_color(label: &str, value: f64) -> String {
    let text = pct(value);
    if label == "FP rate" {
        if value <= 0.03 {
            return green(&text);
        }
        if value <= 0.05 {
            return yellow(&text);
        }
        return red(&text);
    }
    if value >= 0.95 {
        return green(&text);
    }
    if value >= 0.88 {
        return cyan(&text);
    }
    yellow(&text)
}

fn row(label: &str, value: &str, label_width: usize) -> String {
    let padded = format!("{label:<label_width$}");
    format!("{}   {value}", dim(&padded))
}

fn fit_width(lines: &[String]) -> usize {
    let mut max = 0usize;
    for line in lines {
        max = max.max(visible_width(line) + 2);
    }
    max.max(24)
}

fn pad_label(s: &str, w: usize) -> String {
    format!("{s:<w$}")
}

fn capitalize(s: &str) -> String {
    let mut chars = s.chars();
    match chars.next() {
        None => String::new(),
        Some(c) => c.to_uppercase().collect::<String>() + chars.as_str(),
    }
}

pub struct ReportPaths<'a> {
    pub json_path: Option<&'a str>,
    pub md_path: Option<&'a str>,
}

pub fn format_terminal(
    report: &FullReport,
    paths: Option<ReportPaths<'_>>,
    invariant: Option<&ReconciliationInvariant>,
) -> String {
    let m = &report.metrics;
    let mut out: Vec<String> = Vec::new();

    out.push(String::new());

    let llm_label = if m.llm_enabled {
        green(m.llm_provider.as_deref().unwrap_or("on"))
    } else {
        yellow("none")
    };
    out.push(format!(
        "{}seed {} · {} pay / {} setl / {} bank · LLM: {llm_label}",
        dim("  status  "),
        bold(&m.seed.to_string()),
        m.payment_count,
        m.settlement_count,
        m.bank_count,
    ));
    if let Some(inv) = invariant {
        out.push(format!(
            "{}{}",
            dim("  "),
            green(&inv.format_terminal_line())
        ));
    }
    out.push(String::new());

    let metrics_body = vec![
        row("Match rate", &metric_color("Match rate", m.match_rate), LABEL_W),
        row("Precision", &metric_color("Precision", m.precision), LABEL_W),
        row("Recall", &metric_color("Recall", m.recall), LABEL_W),
        row("FP rate", &metric_color("FP rate", m.false_positive_rate), LABEL_W),
        row("Exception acc", &pct(m.exception_accuracy), LABEL_W),
        String::new(),
        row("GT matches", &m.true_match_count.to_string(), LABEL_W),
        row("Predicted", &m.predicted_match_count.to_string(), LABEL_W),
        row(
            "TP / FP / FN",
            &format!(
                "{} / {} / {}",
                m.true_positive, m.false_positive, m.false_negative
            ),
            LABEL_W,
        ),
        row("True exceptions", &m.true_exception_count.to_string(), LABEL_W),
        row(
            "Pred. exceptions",
            &m.predicted_exception_count.to_string(),
            LABEL_W,
        ),
        row(
            "Correctly flagged",
            &m.correctly_flagged_exceptions.to_string(),
            LABEL_W,
        ),
        String::new(),
        row(
            "Runtime",
            &dim(&format!(
                "{:.1} ms · {} rec/s",
                m.timing.total_ms, m.throughput_records_per_sec
            )),
            LABEL_W,
        ),
    ];
    let metrics_width = fit_width(&metrics_body);
    out.push(box_frame(
        &bold("headline metrics"),
        &metrics_body,
        metrics_width,
    ));
    out.push(String::new());

    let src = &m.match_source_breakdown;
    let sources_body = vec![
        format!(
            "{} {}  ·  {} {}  ·  {} {}  ·  {} {}  ·  {} {}",
            cyan("Exact"),
            src.exact,
            cyan("Fuzzy"),
            src.fuzzy,
            cyan("Split"),
            src.split,
            cyan("LLM"),
            src.llm,
            cyan("Human"),
            src.human,
        ),
        dim(&format!(
            "timing  exact {:.1} · fuzzy {:.1} · split {:.1} · llm {:.1} ms",
            m.timing.exact_ms, m.timing.fuzzy_ms, m.timing.split_ms, m.timing.llm_ms
        )),
    ];
    out.push(box_frame(
        "match sources",
        &sources_body,
        fit_width(&sources_body),
    ));
    out.push(String::new());

    let mut diff_body: Vec<String> = Vec::new();
    for level in AmbiguityLevel::ALL {
        let key = level.as_str();
        let Some(s) = m.by_ambiguity_level.get(key) else {
            continue;
        };
        let label = capitalize(key);
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
        diff_body.push(format!(
            "{}  match {:>7}    prec {:>7}    deferred {:>7}",
            pad_label(&label, 14),
            mr,
            pr,
            deferred
        ));
    }
    out.push(box_frame(
        "by difficulty",
        &diff_body,
        fit_width(&diff_body),
    ));
    out.push(String::new());

    if let Some(ref r) = m.robustness {
        let rob_body = vec![
            dim(&format!(
                "seeds {}",
                r.seeds
                    .iter()
                    .map(|s| s.to_string())
                    .collect::<Vec<_>>()
                    .join(", ")
            )),
            format!(
                "match  mean {}  min {}  max {}",
                pct(r.match_rate.mean),
                pct(r.match_rate.min),
                pct(r.match_rate.max)
            ),
            format!(
                "prec   mean {}  min {}  max {}",
                pct(r.precision.mean),
                pct(r.precision.min),
                pct(r.precision.max)
            ),
            format!(
                "recall mean {}  min {}  max {}",
                pct(r.recall.mean),
                pct(r.recall.min),
                pct(r.recall.max)
            ),
            format!(
                "FP     mean {}  min {}  max {}",
                pct(r.false_positive_rate.mean),
                pct(r.false_positive_rate.min),
                pct(r.false_positive_rate.max)
            ),
        ];
        out.push(box_frame("robustness", &rob_body, fit_width(&rob_body)));
        out.push(String::new());
    }

    if let Some(ref a) = m.llm_ablation {
        let mut body = vec![
            if !a.provider_available {
                yellow("provider unavailable — with-LLM fell back to none")
            } else {
                dim(&format!(
                    "provider {}",
                    a.with_llm.provider.as_deref().unwrap_or("")
                ))
            },
            String::new(),
            format!(
                "{}{}{}",
                format!("{:12}", ""),
                format!("{:>12}", bold("With LLM")),
                format!("{:>12}", bold("Without")),
            ),
            format!(
                "match rate  {:>12}{:>12}",
                pct(a.with_llm.match_rate),
                pct(a.without_llm.match_rate)
            ),
            format!(
                "precision   {:>12}{:>12}",
                pct(a.with_llm.precision),
                pct(a.without_llm.precision)
            ),
            format!(
                "recall      {:>12}{:>12}",
                pct(a.with_llm.recall),
                pct(a.without_llm.recall)
            ),
            format!(
                "FP rate     {:>12}{:>12}",
                pct(a.with_llm.false_positive_rate),
                pct(a.without_llm.false_positive_rate)
            ),
            format!(
                "LLM matches {:>12}{:>12}",
                a.with_llm.llm_matches, a.without_llm.llm_matches
            ),
        ];
        if let Some(ref stats) = a.call_stats {
            body.push(String::new());
            body.push(dim(&format!(
                "calls {} — match {} / no_match {} / declined {} / provider err {}",
                stats.call_count,
                stats.verdict_match,
                stats.verdict_no_match,
                stats.verdict_unsure,
                stats.provider_errors,
            )));
            body.push(dim(&format!(
                "latency min {:.0}ms  mean {:.0}ms  max {:.0}ms",
                stats.latency_ms_min, stats.latency_ms_mean, stats.latency_ms_max
            )));
        }
        out.push(box_frame("LLM ablation", &body, fit_width(&body)));
        out.push(String::new());
    }

    if let Some(threshold) = m.suggested_fuzzy_threshold {
        out.push(dim(&format!(
            "  tip  suggested fuzzyAcceptThreshold={threshold} (logged only, not auto-applied)"
        )));
        out.push(String::new());
    }

    let grouped = group_exceptions_for_display(&report.exceptions);
    let preview = &grouped[..grouped.len().min(EXCEPTION_PREVIEW)];
    let mut ex_body: Vec<String> = Vec::new();
    if preview.is_empty() {
        ex_body.push(green("none"));
    } else {
        for e in preview {
            let id = format!("{:<20}", e.record_ids.join(","));
            let src_name = format!("{:<14}", e.source);
            ex_body.push(format!("{}   {}   {}", cyan(&id), dim(&src_name), e.reason));
        }
        if grouped.len() > EXCEPTION_PREVIEW {
            ex_body.push(dim(&format!(
                "… and {} more groups (see output/report.md)",
                grouped.len() - EXCEPTION_PREVIEW
            )));
        }
    }
    out.push(box_frame(
        &format!(
            "exceptions ({} groups / {} records)",
            grouped.len(),
            report.exceptions.len()
        ),
        &ex_body,
        fit_width(&ex_body),
    ));
    out.push(String::new());

    out.push(dim(
        "  limitations  bounded split · no FX · near-dups need LLM/human — full list in report.md",
    ));
    if let Some(paths) = paths {
        if paths.json_path.is_some() || paths.md_path.is_some() {
            out.push(String::new());
            if let Some(p) = paths.json_path {
                out.push(dim(&format!("  wrote  {p}")));
            }
            if let Some(p) = paths.md_path {
                out.push(dim(&format!("  wrote  {p}")));
            }
        }
    }
    out.push(String::new());

    out.join("\n")
}
