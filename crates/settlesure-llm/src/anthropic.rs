//! Anthropic Messages API provider (reqwest).

use crate::client::build_http_client;
use crate::provider::{
    build_resolve_payload, map_reqwest_error, parse_verdict_json, LlmError, LlmProvider, LlmVerdict,
    SETTLEMENT_SYSTEM_PROMPT,
};
use async_trait::async_trait;
use settlesure_types::{AmbiguousCandidate, Secret};
use tracing::debug;

pub struct AnthropicProvider {
    api_key: Secret<String>,
    client: reqwest::Client,
    model: String,
}

impl AnthropicProvider {
    pub fn new(api_key: Secret<String>) -> Self {
        Self {
            api_key,
            client: build_http_client(),
            model: "claude-3-5-haiku-latest".into(),
        }
    }
}

#[async_trait]
impl LlmProvider for AnthropicProvider {
    fn name(&self) -> &str {
        "anthropic"
    }

    async fn resolve(&self, pair: &AmbiguousCandidate) -> Result<LlmVerdict, LlmError> {
        let user_content = build_resolve_payload(pair);
        debug!(provider = "anthropic", "sending resolve request");

        let body = serde_json::json!({
            "model": self.model,
            "max_tokens": 200,
            "temperature": 0,
            "system": SETTLEMENT_SYSTEM_PROMPT,
            "messages": [{ "role": "user", "content": user_content }],
        });

        let res = self
            .client
            .post("https://api.anthropic.com/v1/messages")
            .header("x-api-key", self.api_key.expose())
            .header("anthropic-version", "2023-06-01")
            .header("content-type", "application/json")
            .json(&body)
            .send()
            .await
            .map_err(map_reqwest_error)?;

        if !res.status().is_success() {
            let status = res.status();
            let _ = res.text().await;
            return Err(LlmError::transport(format!("Anthropic HTTP {status}")));
        }

        let value: serde_json::Value = res.json().await.map_err(map_reqwest_error)?;

        let text = value
            .get("content")
            .and_then(|c| c.as_array())
            .map(|arr| {
                arr.iter()
                    .filter(|b| b.get("type").and_then(|t| t.as_str()) == Some("text"))
                    .filter_map(|b| b.get("text").and_then(|t| t.as_str()))
                    .collect::<Vec<_>>()
                    .join("\n")
            })
            .unwrap_or_default();

        Ok(parse_verdict_json(&text))
    }
}
