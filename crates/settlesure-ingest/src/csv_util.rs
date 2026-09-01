//! Shared CSV reading helpers.

use settlesure_types::{Result, SettleSureError};
use std::collections::HashMap;
use std::path::Path;

use crate::normalize::normalize_header;

pub struct CsvTable {
    pub headers: HashMap<String, usize>,
    pub records: Vec<csv::StringRecord>,
}

pub fn read_csv_table(path: &Path) -> Result<CsvTable> {
    let mut reader = csv::Reader::from_path(path).map_err(|e| {
        SettleSureError::Message(format!("failed to read {}: {e}", path.display()))
    })?;
    let raw_headers = reader.headers().map_err(|e| {
        SettleSureError::Message(format!("failed to read headers from {}: {e}", path.display()))
    })?;
    let mut headers = HashMap::new();
    for (i, h) in raw_headers.iter().enumerate() {
        headers.insert(normalize_header(h), i);
    }
    let mut records = Vec::new();
    for result in reader.records() {
        let record = result.map_err(|e| {
            SettleSureError::Message(format!("CSV parse error in {}: {e}", path.display()))
        })?;
        records.push(record);
    }
    Ok(CsvTable { headers, records })
}
