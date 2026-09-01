//! Shared normalization for messy real-world CSV values.

use chrono::NaiveDate;
use settlesure_types::{Result, SettleSureError};

/// Strip currency symbols, commas, and whitespace from an amount string.
pub fn strip_currency(s: &str) -> String {
    s.trim()
        .trim_start_matches('₹')
        .trim_start_matches('$')
        .trim_start_matches('€')
        .replace(',', "")
        .trim()
        .to_string()
}

/// Parse a currency amount string into f64.
pub fn parse_amount(s: &str, field: &str, line: usize) -> Result<f64> {
    let cleaned = strip_currency(s);
    if cleaned.is_empty() {
        return Err(SettleSureError::Message(format!(
            "line {line}: missing {field}"
        )));
    }
    cleaned.parse::<f64>().map_err(|_| {
        SettleSureError::Message(format!(
            "line {line}: invalid amount for {field}: {s:?}"
        ))
    })
}

/// Trim whitespace; preserve leading zeros (UTRs are opaque strings).
pub fn normalize_utr(s: &str) -> String {
    s.trim().to_string()
}

/// Normalize header names: lowercase, replace spaces/dashes with underscores.
pub fn normalize_header(h: &str) -> String {
    h.trim()
        .to_lowercase()
        .replace([' ', '-'], "_")
}

/// Parse flexible date formats; output YYYY-MM-DD for engine compatibility.
pub fn parse_date_flexible(s: &str, field: &str, line: usize) -> Result<String> {
    let trimmed = s.trim();
    if trimmed.is_empty() {
        return Err(SettleSureError::Message(format!(
            "line {line}: missing {field}"
        )));
    }

    // YYYY-MM-DD
    if let Ok(d) = NaiveDate::parse_from_str(trimmed, "%Y-%m-%d") {
        return Ok(d.format("%Y-%m-%d").to_string());
    }
    // DD/MM/YYYY
    if let Ok(d) = NaiveDate::parse_from_str(trimmed, "%d/%m/%Y") {
        return Ok(d.format("%Y-%m-%d").to_string());
    }
    // DD-MM-YYYY
    if let Ok(d) = NaiveDate::parse_from_str(trimmed, "%d-%m-%Y") {
        return Ok(d.format("%Y-%m-%d").to_string());
    }

    Err(SettleSureError::Message(format!(
        "line {line}: unsupported date format for {field}: {trimmed:?} (use YYYY-MM-DD, DD/MM/YYYY, or DD-MM-YYYY)"
    )))
}

/// Look up a column value by trying multiple header aliases (headers already normalized).
pub fn get_col<'a>(
    row: &'a csv::StringRecord,
    headers: &std::collections::HashMap<String, usize>,
    aliases: &[&str],
    field: &str,
    line: usize,
) -> Result<&'a str> {
    for alias in aliases {
        if let Some(&idx) = headers.get(*alias) {
            let val = row.get(idx).unwrap_or("").trim();
            if !val.is_empty() {
                return Ok(val);
            }
        }
    }
    Err(SettleSureError::Message(format!(
        "line {line}: missing required column {field} (tried: {})",
        aliases.join(", ")
    )))
}

/// Optional column lookup — returns default if not found or empty.
pub fn get_col_opt<'a>(
    row: &'a csv::StringRecord,
    headers: &std::collections::HashMap<String, usize>,
    aliases: &[&str],
) -> Option<&'a str> {
    for alias in aliases {
        if let Some(&idx) = headers.get(*alias) {
            let val = row.get(idx).unwrap_or("").trim();
            if !val.is_empty() {
                return Some(val);
            }
        }
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn strip_currency_handles_rupee_and_commas() {
        assert_eq!(strip_currency("  ₹1,234.50 "), "1234.50");
        assert_eq!(strip_currency("$99.00"), "99.00");
    }

    #[test]
    fn normalize_utr_preserves_leading_zeros() {
        assert_eq!(normalize_utr("  001234567890  "), "001234567890");
    }

    #[test]
    fn parse_date_formats() {
        assert_eq!(
            parse_date_flexible("2025-01-15", "d", 1).unwrap(),
            "2025-01-15"
        );
        assert_eq!(
            parse_date_flexible("15/01/2025", "d", 1).unwrap(),
            "2025-01-15"
        );
        assert_eq!(
            parse_date_flexible("15-01-2025", "d", 1).unwrap(),
            "2025-01-15"
        );
    }

    #[test]
    fn rejects_us_date_format() {
        assert!(parse_date_flexible("01/15/2025", "d", 1).is_err());
    }
}
