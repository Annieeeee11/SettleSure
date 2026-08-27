//! Ollama local chat provider.

use crate::client::build_http_client;
use crate::provider::{
    build_resolve_payload, map_reqwest_error, parse_verdict_json, LlmError, LlmProvider, LlmVerdict,
    SETTLEMENT_SYSTEM_PROMPT,
};
use async_trait::async_trait;
use settlesure_types::AmbiguousCandidate;
use std::time::Duration;
use tracing::debug;

const DEFAULT_HOST: &str = "http://localhost:11434";

pub async fn is_ollama_reachable(host: Option<&str>, timeout_ms: Option<u64>) -> bool {
    let host = host.unwrap_or(DEFAULT_HOST);
    let timeout_ms = timeout_ms.unwrap_or(800);
    let client = match reqwest::Client::builder()
        .timeout(Duration::from_millis(timeout_ms))
        .build()
    {
        Ok(c) => c,
        Err(_) => return false,
    };
    match client.get(format!("{host}/api/tags")).send().await {
        Ok(res) => res.status().is_success(),
        Err(_) => false,
    }
}

pub struct OllamaProvider {
    host: String,
    model: String,
    seed: u32,
    client: reqwest::Client,
}

impl OllamaProvider {
    pub fn new(model: Option<String>, host: Option<String>, seed: u32) -> Self {
        Self {
            model: model.unwrap_or_else(|| "llama3.2".into()),
            host: host.unwrap_or_else(|| DEFAULT_HOST.into()),
            seed,
            client: build_http_client(),
        }
    }
}

#[async_trait]
impl LlmProvider for OllamaProvider {
    fn name(&self) -> &str {
        "ollama"
    }

    async fn resolve(&self, pair: &AmbiguousCandidate) -> Result<LlmVerdict, LlmError> {
        let user_content = build_resolve_payload(pair);
        debug!(provider = "ollama", model = %self.model, "sending resolve request");

        let body = serde_json::json!({
            "model": self.model,
            "stream": false,
            "format": {
                "type": "object",
                "properties": {
                    "verdict": { "type": "string", "enum": ["match", "no_match", "unsure"] },
                    "reasoning": { "type": "string" },
                    "chosenSettlementIds": {
                        "type": "array",
                        "items": { "type": "string" }
                    }
                },
                "required": ["verdict", "reasoning"]
            },
            "options": { "temperature": 0, "seed": self.seed },
            "messages": [
                { "role": "system", "content": SETTLEMENT_SYSTEM_PROMPT },
                { "role": "user", "content": user_content },
            ],
        });

        let res = self
            .client
            .post(format!("{}/api/chat", self.host))
            .header("content-type", "application/json")
            .json(&body)
            .send()
            .await
            .map_err(map_reqwest_error)?;

        if !res.status().is_success() {
            return Err(LlmError::transport(format!("Ollama HTTP {}", res.status())));
        }

        let value: serde_json::Value = res.json().await.map_err(map_reqwest_error)?;
        let content = value
            .pointer("/message/content")
            .and_then(|v| v.as_str())
            .unwrap_or("");
        Ok(parse_verdict_json(content))
    }
}
