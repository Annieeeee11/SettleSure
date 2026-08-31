//! Metrics and report generation for SettleSure.

mod ansi;
mod invariant;
mod metrics;
mod report;
mod terminal;

pub use ansi::{
    bold, box_frame, cyan, dim, green, red, strip_ansi, visible_width, yellow,
};
pub use invariant::{check_reconciliation_invariant, ReconciliationInvariant};
pub use metrics::{pct, score_against_ground_truth, score_matches, score_slice, ScoreMeta};
pub use report::{
    format_markdown, group_exceptions_for_display, write_report, GroupedExceptionRow,
    KNOWN_LIMITATIONS,
};
pub use terminal::{format_terminal, ReportPaths};
