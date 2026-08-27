//! Disk-backed LLM verdict cache for reproducible ablations.

use crate::provider::{build_resolve_payload, LlmCallResult, LlmVerdict};
use settlesure_types::AmbiguousCandidate;
use std::collections::HashMap;
use std::fs;
use std::hash::{Hash, Hasher};
use std::path::Path;

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
struct CachedEntry {
    verdict: String,
    reasoning: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    chosen_settlement_ids: Option<Vec<String>>,
}

pub struct VerdictCache {
    path: std::path::PathBuf,
    entries: HashMap<String, CachedEntry>,
    dirty: bool,
}

fn cache_key(pair: &AmbiguousCandidate, model: &str, seed: u32) -> String {
    let payload = build_resolve_payload(pair);
    let mut hasher = std::collections::hash_map::DefaultHasher::new();
    payload.hash(&mut hasher);
    model.hash(&mut hasher);
    seed.hash(&mut hasher);
    format!("{:016x}", hasher.finish())
}

fn candidate_id(pair: &AmbiguousCandidate) -> String {
    format!("{}:{}", pair.bank.id, pair.settlement.settlement_id)
}

impl VerdictCache {
    pub fn load(path: impl AsRef<Path>) -> Self {
        let path = path.as_ref().to_path_buf();
        let entries = fs::read_to_string(&path)
            .ok()
            .and_then(|s| serde_json::from_str(&s).ok())
            .unwrap_or_default();
        Self {
            path,
            entries,
            dirty: false,
        }
    }

    pub fn get(
        &self,
        pair: &AmbiguousCandidate,
        model: &str,
        seed: u32,
    ) -> Option<LlmVerdict> {
        let key = cache_key(pair, model, seed);
        let entry = self.entries.get(&key)?;
        Some(LlmVerdict {
            verdict: match entry.verdict.as_str() {
                "match" => crate::provider::VerdictKind::Match,
                "no_match" => crate::provider::VerdictKind::NoMatch,
                _ => crate::provider::VerdictKind::Unsure,
            },
            reasoning: entry.reasoning.clone(),
            chosen_settlement_ids: entry.chosen_settlement_ids.clone(),
        })
    }

    pub fn insert_from_result(
        &mut self,
        pair: &AmbiguousCandidate,
        model: &str,
        seed: u32,
        result: &LlmCallResult,
    ) {
        let LlmCallResult::Verdict(v) = result else {
            return;
        };
        let key = cache_key(pair, model, seed);
        self.entries.insert(
            key,
            CachedEntry {
                verdict: v.verdict.as_str().to_string(),
                reasoning: v.reasoning.clone(),
                chosen_settlement_ids: v.chosen_settlement_ids.clone(),
            },
        );
        self.dirty = true;
    }

    pub fn save_if_dirty(&mut self) -> std::io::Result<()> {
        if !self.dirty {
            return Ok(());
        }
        if let Some(parent) = self.path.parent() {
            fs::create_dir_all(parent)?;
        }
        let json = serde_json::to_string_pretty(&self.entries)?;
        fs::write(&self.path, json)
    }
}

pub fn candidate_label(pair: &AmbiguousCandidate) -> String {
    candidate_id(pair)
}
