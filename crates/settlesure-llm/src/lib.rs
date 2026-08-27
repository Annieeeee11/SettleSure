//! LLM provider trait + Anthropic/Ollama (async, isolated from the engine).

mod anthropic;
mod cache;
mod client;
mod ollama;
mod provider;
mod resolve;

pub use anthropic::AnthropicProvider;
pub use client::{build_http_client, REQUEST_TIMEOUT};
pub use ollama::{is_ollama_reachable, OllamaProvider};
pub use provider::{
    build_resolve_payload, parse_verdict_json, resolve_with_retry, resolve_with_retry_timed,
    LlmCallResult, LlmError, LlmProvider, LlmVerdict, VerdictKind, SETTLEMENT_SYSTEM_PROMPT,
};
pub use resolve::{
    llm_resolve, select_llm_provider, LlmResolveResult, LlmSelectOptions, SelectedLlm,
};
