//! Ambiguous-bucket LLM resolution — port of `src/engine/llmResolve.ts`.
//!
//! This crate does **not** depend on `settlesure-engine` (avoids cycles).
//! Map [`LlmResolveResult`] to `settlesure_engine::LlmPassResult` in the CLI:
//! ```ignore
//! use settlesure_engine::LlmPassResult;
//! use settlesure_llm::LlmResolveResult;
//!
//! fn to_engine(r: LlmResolveResult) -> LlmPassResult {
//!     LlmPassResult {
//!         matches: r.matches,
//!         exceptions: r.exceptions,
//!         enabled: r.enabled,
//!         provider_name: r.provider_name,
//!         call_stats: r.call_stats,
//!     }
//! }
//! ```

use crate::anthropic::AnthropicProvider;
use crate::cache::{candidate_label, VerdictCache};
use crate::ollama::{is_ollama_reachable, OllamaProvider};
use crate::openai_compat::OpenAiCompatProvider;
use crate::provider::{resolve_with_retry_timed, LlmCallResult, LlmProvider, VerdictKind};
use settlesure_types::{
    AmbiguousCandidate, AmbiguousKind, DiscrepancyClass, Exception, ExceptionSource, LlmCallStats,
    LlmProviderChoice, LlmVerdictLogEntry, MatchResult, MatchSource, Secret,
};
use std::collections::HashSet;
use std::path::PathBuf;
use tracing::{info, warn};

/// Same shape as engine `LlmPassResult` — convert at the CLI boundary.
#[derive(Debug, Clone, Default)]
pub struct LlmResolveResult {
    pub matches: Vec<MatchResult>,
    pub exceptions: Vec<Exception>,
    pub enabled: bool,
    pub provider_name: String,
    pub call_stats: Option<LlmCallStats>,
}

pub struct LlmSelectOptions {
    pub skip_llm: bool,
    pub llm_provider: Option<LlmProviderChoice>,
    pub llm_model: Option<String>,
    pub seed: u32,
    pub anthropic_api_key: Option<Secret<String>>,
    pub openai_api_key: Option<Secret<String>>,
    pub llm_base_url: Option<String>,
    pub llm_cache: bool,
    pub llm_cache_path: Option<PathBuf>,
}

pub struct SelectedLlm {
    pub provider: Option<Box<dyn LlmProvider>>,
    pub name: String,
}

struct CallStatsAccumulator {
    call_count: usize,
    verdict_match: usize,
    verdict_no_match: usize,
    verdict_unsure: usize,
    provider_errors: usize,
    latencies_ms: Vec<f64>,
    verdict_log: Vec<LlmVerdictLogEntry>,
}

impl CallStatsAccumulator {
    fn new() -> Self {
        Self {
            call_count: 0,
            verdict_match: 0,
            verdict_no_match: 0,
            verdict_unsure: 0,
            provider_errors: 0,
            latencies_ms: Vec::new(),
            verdict_log: Vec::new(),
        }
    }

    fn record(&mut self, result: &LlmCallResult, latency_ms: f64, candidate_id: &str) {
        self.call_count += 1;
        self.latencies_ms.push(latency_ms);
        let (verdict_str, reasoning) = match result {
            LlmCallResult::Verdict(v) => {
                let vs = v.verdict.as_str().to_string();
                match v.verdict {
                    VerdictKind::Match => self.verdict_match += 1,
                    VerdictKind::NoMatch => self.verdict_no_match += 1,
                    VerdictKind::Unsure => self.verdict_unsure += 1,
                }
                (vs, v.reasoning.clone())
            }
            LlmCallResult::ProviderError { message, .. } => {
                self.provider_errors += 1;
                ("provider_error".into(), message.clone())
            }
        };
        self.verdict_log.push(LlmVerdictLogEntry {
            candidate_id: candidate_id.to_string(),
            verdict: verdict_str,
            reasoning,
            latency_ms: (latency_ms * 1000.0).round() / 1000.0,
        });
    }

    fn finish(self) -> LlmCallStats {
        let (min, max, mean) = if self.latencies_ms.is_empty() {
            (0.0, 0.0, 0.0)
        } else {
            let min = self
                .latencies_ms
                .iter()
                .copied()
                .fold(f64::INFINITY, f64::min);
            let max = self
                .latencies_ms
                .iter()
                .copied()
                .fold(f64::NEG_INFINITY, f64::max);
            let sum: f64 = self.latencies_ms.iter().sum();
            let mean = (sum / self.latencies_ms.len() as f64 * 1000.0).round() / 1000.0;
            (
                (min * 1000.0).round() / 1000.0,
                (max * 1000.0).round() / 1000.0,
                mean,
            )
        };
        LlmCallStats {
            call_count: self.call_count,
            verdict_match: self.verdict_match,
            verdict_no_match: self.verdict_no_match,
            verdict_unsure: self.verdict_unsure,
            provider_errors: self.provider_errors,
            latency_ms_min: min,
            latency_ms_max: max,
            latency_ms_mean: mean,
            verdict_log: if self.verdict_log.is_empty() {
                None
            } else {
                Some(self.verdict_log)
            },
        }
    }
}

fn openai_model_name(options: &LlmSelectOptions) -> String {
    let raw = options
        .llm_model
        .clone()
        .unwrap_or_else(|| "gpt-4o-mini".into());
    if raw == "llama3.2" {
        "gpt-4o-mini".into()
    } else {
        raw
    }
}

pub async fn select_llm_provider(options: &LlmSelectOptions) -> SelectedLlm {
    if options.skip_llm || options.llm_provider == Some(LlmProviderChoice::None) {
        return SelectedLlm {
            provider: None,
            name: "none".into(),
        };
    }

    let seed = options.seed;

    if options.llm_provider == Some(LlmProviderChoice::Anthropic) {
        let Some(ref key) = options.anthropic_api_key else {
            warn!("Requested anthropic provider but API key missing.");
            return SelectedLlm {
                provider: None,
                name: "none".into(),
            };
        };
        return SelectedLlm {
            provider: Some(Box::new(AnthropicProvider::new(key.clone()))),
            name: "anthropic".into(),
        };
    }

    if options.llm_provider == Some(LlmProviderChoice::OpenAi) {
        let Some(ref key) = options.openai_api_key else {
            warn!("Requested openai provider but OPENAI_API_KEY missing.");
            return SelectedLlm {
                provider: None,
                name: "none".into(),
            };
        };
        return SelectedLlm {
            provider: Some(Box::new(OpenAiCompatProvider::new(
                key.clone(),
                Some(openai_model_name(options)),
                options.llm_base_url.clone(),
            ))),
            name: "openai".into(),
        };
    }

    if options.llm_provider == Some(LlmProviderChoice::Ollama) {
        if !is_ollama_reachable(None, None).await {
            warn!("Requested ollama provider but localhost:11434 unreachable.");
            return SelectedLlm {
                provider: None,
                name: "none".into(),
            };
        }
        return SelectedLlm {
            provider: Some(Box::new(OllamaProvider::new(
                options.llm_model.clone(),
                None,
                seed,
            ))),
            name: "ollama".into(),
        };
    }

    // Auto-select: Anthropic key > OpenAI key > Ollama reachable > none
    if let Some(ref key) = options.anthropic_api_key {
        return SelectedLlm {
            provider: Some(Box::new(AnthropicProvider::new(key.clone()))),
            name: "anthropic".into(),
        };
    }
    if let Some(ref key) = options.openai_api_key {
        return SelectedLlm {
            provider: Some(Box::new(OpenAiCompatProvider::new(
                key.clone(),
                Some(openai_model_name(options)),
                options.llm_base_url.clone(),
            ))),
            name: "openai".into(),
        };
    }
    if is_ollama_reachable(None, None).await {
        return SelectedLlm {
            provider: Some(Box::new(OllamaProvider::new(
                options.llm_model.clone(),
                None,
                seed,
            ))),
            name: "ollama".into(),
        };
    }
    SelectedLlm {
        provider: None,
        name: "none".into(),
    }
}

fn option_set_key(ids: &[String]) -> String {
    let mut sorted = ids.to_vec();
    sorted.sort();
    sorted.join(",")
}

fn is_valid_split_choice(chosen: Option<&[String]>, options: &[Vec<String>]) -> bool {
    let Some(chosen) = chosen else {
        return false;
    };
    if chosen.len() < 2 {
        return false;
    }
    let key = option_set_key(chosen);
    options.iter().any(|opt| option_set_key(opt) == key)
}

fn unique_flat(options: &[Vec<String>]) -> Vec<String> {
    let mut seen = HashSet::new();
    options
        .iter()
        .flatten()
        .filter(|&id| seen.insert(id.clone()))
        .cloned()
        .collect()
}

fn push_pair_exceptions(
    exceptions: &mut Vec<Exception>,
    bank_id: &str,
    settlement_id: &str,
    reason: &str,
    related_extra: &[String],
) {
    let mut bank_related = vec![settlement_id.to_string()];
    bank_related.extend(related_extra.iter().cloned());
    let mut setl_related = vec![bank_id.to_string()];
    setl_related.extend(related_extra.iter().cloned());
    exceptions.push(Exception {
        record_id: bank_id.into(),
        source: ExceptionSource::Bank,
        reason: reason.into(),
        exception_type: None,
        related_ids: Some(bank_related),
    });
    exceptions.push(Exception {
        record_id: settlement_id.into(),
        source: ExceptionSource::Settlement,
        reason: reason.into(),
        exception_type: None,
        related_ids: Some(setl_related),
    });
}

fn rival_ids(a: &AmbiguousCandidate) -> Vec<String> {
    a.rivals
        .as_ref()
        .map(|r| {
            r.iter()
                .map(|x| x.settlement.settlement_id.clone())
                .collect()
        })
        .unwrap_or_default()
}

fn push_provider_error_exceptions(
    exceptions: &mut Vec<Exception>,
    a: &AmbiguousCandidate,
    message: &str,
    is_split: bool,
) {
    let reason = format!("LLM unavailable — provider error: {message}");
    if is_split {
        exceptions.push(Exception {
            record_id: a.bank.id.clone(),
            source: ExceptionSource::Bank,
            reason,
            exception_type: Some(DiscrepancyClass::BatchedPayout),
            related_ids: Some(unique_flat(a.split_options.as_ref().unwrap())),
        });
    } else {
        push_pair_exceptions(
            exceptions,
            &a.bank.id,
            &a.settlement.settlement_id,
            &reason,
            &rival_ids(a),
        );
    }
}

fn push_declined_exceptions(
    exceptions: &mut Vec<Exception>,
    a: &AmbiguousCandidate,
    reasoning: &str,
    is_split: bool,
) {
    let reason = if is_split {
        format!("ambiguous — LLM declined (split) — {reasoning}")
    } else {
        format!("ambiguous — LLM declined — {reasoning}")
    };
    if is_split {
        exceptions.push(Exception {
            record_id: a.bank.id.clone(),
            source: ExceptionSource::Bank,
            reason,
            exception_type: Some(DiscrepancyClass::BatchedPayout),
            related_ids: Some(unique_flat(a.split_options.as_ref().unwrap())),
        });
    } else {
        push_pair_exceptions(
            exceptions,
            &a.bank.id,
            &a.settlement.settlement_id,
            &reason,
            &rival_ids(a),
        );
    }
}

/// Resolve only the ambiguous bucket via the selected LLM provider.
pub async fn llm_resolve(
    ambiguous: &[AmbiguousCandidate],
    options: &LlmSelectOptions,
) -> LlmResolveResult {
    let mut matches = Vec::new();
    let mut exceptions = Vec::new();

    if ambiguous.is_empty() {
        return LlmResolveResult {
            matches,
            exceptions,
            enabled: false,
            provider_name: "none".into(),
            call_stats: None,
        };
    }

    let SelectedLlm { provider, name } = select_llm_provider(options).await;

    info!(
        ambiguous = ambiguous.len(),
        provider = %name,
        est_calls = ambiguous.len(),
        "LLM pass"
    );

    let Some(provider) = provider else {
        for a in ambiguous {
            if a.kind == Some(AmbiguousKind::Split) && a.split_options.is_some() {
                let all_ids = unique_flat(a.split_options.as_ref().unwrap());
                exceptions.push(Exception {
                    record_id: a.bank.id.clone(),
                    source: ExceptionSource::Bank,
                    reason: format!("ambiguous split — LLM unavailable: {}", a.reasoning),
                    exception_type: Some(DiscrepancyClass::BatchedPayout),
                    related_ids: Some(all_ids),
                });
            } else {
                let related_extra = rival_ids(a);
                push_pair_exceptions(
                    &mut exceptions,
                    &a.bank.id,
                    &a.settlement.settlement_id,
                    "ambiguous — LLM unavailable",
                    &related_extra,
                );
            }
        }
        return LlmResolveResult {
            matches,
            exceptions,
            enabled: false,
            provider_name: "none".into(),
            call_stats: None,
        };
    };

    let mut stats = CallStatsAccumulator::new();
    let model_name = options.llm_model.as_deref().unwrap_or("llama3.2");
    let mut cache = if options.llm_cache {
        Some(VerdictCache::load(
            options
                .llm_cache_path
                .clone()
                .unwrap_or_else(|| PathBuf::from("output/llm-cache.json")),
        ))
    } else {
        None
    };

    // Ollama serves one request at a time on typical local installs — keep sequential.
    for a in ambiguous {
        let is_split = a.kind == Some(AmbiguousKind::Split)
            && a.split_options.as_ref().is_some_and(|o| !o.is_empty());

        let label = candidate_label(a);
        let (call_result, latency_ms) = if let Some(ref cache_ref) = cache {
            if let Some(cached) = cache_ref.get(a, model_name, options.seed) {
                (LlmCallResult::Verdict(cached), 0.0)
            } else {
                let (result, lat) = resolve_with_retry_timed(provider.as_ref(), a).await;
                if let Some(ref mut c) = cache {
                    c.insert_from_result(a, model_name, options.seed, &result);
                }
                (result, lat)
            }
        } else {
            resolve_with_retry_timed(provider.as_ref(), a).await
        };
        stats.record(&call_result, latency_ms, &label);

        match call_result {
            LlmCallResult::Verdict(verdict) => match verdict.verdict {
                VerdictKind::Match => {
                    if is_split {
                        let split_options = a.split_options.as_ref().unwrap();
                        if is_valid_split_choice(
                            verdict.chosen_settlement_ids.as_deref(),
                            split_options,
                        ) {
                            let mut components = verdict.chosen_settlement_ids.unwrap();
                            components.sort();
                            let settlement_id = components[0].clone();
                            matches.push(MatchResult {
                                bank_credit_id: a.bank.id.clone(),
                                settlement_id,
                                components: Some(components),
                                confidence: a.score.max(0.8),
                                matched_by: MatchSource::Llm,
                                reasoning: Some(format!(
                                    "LLM verdict: match (split) — {}",
                                    verdict.reasoning
                                )),
                            });
                        } else {
                            exceptions.push(Exception {
                                record_id: a.bank.id.clone(),
                                source: ExceptionSource::Bank,
                                reason: format!(
                                    "LLM verdict: match but invalid/missing chosenSettlementIds — {}",
                                    verdict.reasoning
                                ),
                                exception_type: Some(DiscrepancyClass::BatchedPayout),
                                related_ids: Some(unique_flat(split_options)),
                            });
                        }
                    } else {
                        matches.push(MatchResult {
                            bank_credit_id: a.bank.id.clone(),
                            settlement_id: a.settlement.settlement_id.clone(),
                            components: None,
                            confidence: a.score.max(0.8),
                            matched_by: MatchSource::Llm,
                            reasoning: Some(format!(
                                "LLM verdict: match — {}",
                                verdict.reasoning
                            )),
                        });
                    }
                }
                VerdictKind::NoMatch => {
                    if is_split {
                        exceptions.push(Exception {
                            record_id: a.bank.id.clone(),
                            source: ExceptionSource::Bank,
                            reason: format!(
                                "LLM verdict: no_match (split) — {}",
                                verdict.reasoning
                            ),
                            exception_type: Some(DiscrepancyClass::BatchedPayout),
                            related_ids: Some(unique_flat(a.split_options.as_ref().unwrap())),
                        });
                    } else {
                        push_pair_exceptions(
                            &mut exceptions,
                            &a.bank.id,
                            &a.settlement.settlement_id,
                            &format!("LLM verdict: no_match — {}", verdict.reasoning),
                            &rival_ids(a),
                        );
                    }
                }
                VerdictKind::Unsure => {
                    push_declined_exceptions(&mut exceptions, a, &verdict.reasoning, is_split);
                }
            },
            LlmCallResult::ProviderError { message, .. } => {
                push_provider_error_exceptions(&mut exceptions, a, &message, is_split);
            }
        }
    }

    if let Some(ref mut cache) = cache {
        let _ = cache.save_if_dirty();
    }

    LlmResolveResult {
        matches,
        exceptions,
        enabled: true,
        provider_name: name,
        call_stats: Some(stats.finish()),
    }
}
