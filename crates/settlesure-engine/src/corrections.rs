//! Human corrections load + fuzzy threshold suggestion.

use settlesure_types::{Correction, CorrectionDecision, Result};
use std::fs;
use std::path::Path;

pub fn load_corrections(path: &Path) -> Result<Vec<Correction>> {
    if !path.exists() {
        return Ok(Vec::new());
    }
    let raw = fs::read_to_string(path)?;
    match serde_json::from_str::<Vec<Correction>>(&raw) {
        Ok(v) => Ok(v),
        Err(_) => Ok(Vec::new()),
    }
}

/// Prefer `output/corrections.json`; fall back to `data/demo_corrections.json`.
pub fn load_corrections_with_fallback(
    output_path: &Path,
    demo_path: &Path,
) -> Result<Vec<Correction>> {
    let primary = load_corrections(output_path)?;
    if !primary.is_empty() {
        return Ok(primary);
    }
    load_corrections(demo_path)
}

/// If humans consistently accept scores in 0.65–0.75, suggest lowering threshold.
pub fn suggest_fuzzy_threshold(corrections: &[Correction]) -> Option<f64> {
    let accepts: Vec<f64> = corrections
        .iter()
        .filter(|c| c.decision == CorrectionDecision::Accept)
        .filter_map(|c| c.score)
        .filter(|s| *s >= 0.65 && *s < 0.75)
        .collect();
    if accepts.len() < 3 {
        return None;
    }
    let avg = accepts.iter().sum::<f64>() / accepts.len() as f64;
    Some(((0.5_f64).max(avg - 0.05) * 100.0).round() / 100.0)
}
