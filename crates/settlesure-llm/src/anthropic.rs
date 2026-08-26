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
    messages_url: String,
}

impl AnthropicProvider {
    pub fn new(api_key: Secret<String>) -> Self {
        Self::with_messages_url(api_key, "https://api.anthropic.com/v1/messages".into())
    }

    pub(crate) fn with_messages_url(api_key: Secret<String>, messages_url: String) -> Self {
        Self {
            api_key,
            client: build_http_client(),
            model: "claude-3-5-haiku-latest".into(),
            messages_url,
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
            .post(&self.messages_url)
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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::provider::{resolve_with_retry, LlmCallResult, LlmProvider};
    use settlesure_types::{BankCredit, Settlement};
    use std::io::Write;
    use std::sync::{Arc, Mutex};
    use tracing_subscriber::EnvFilter;
    use wiremock::matchers::{method, path};
    use wiremock::{Mock, MockServer, ResponseTemplate};

    const FAKE_KEY: &str = "sk-ant-test-fake-key-do-not-use";

    #[derive(Clone)]
    struct LogCapture(Arc<Mutex<Vec<u8>>>);

    impl<'a> tracing_subscriber::fmt::MakeWriter<'a> for LogCapture {
        type Writer = LogWriter;

        fn make_writer(&'a self) -> Self::Writer {
            LogWriter(self.0.clone())
        }
    }

    struct LogWriter(Arc<Mutex<Vec<u8>>>);

    impl Write for LogWriter {
        fn write(&mut self, buf: &[u8]) -> std::io::Result<usize> {
            self.0.lock().unwrap().extend_from_slice(buf);
            Ok(buf.len())
        }

        fn flush(&mut self) -> std::io::Result<()> {
            Ok(())
        }
    }

    fn dummy_candidate() -> AmbiguousCandidate {
        AmbiguousCandidate {
            bank: BankCredit {
                id: "B1".into(),
                utr: "UTR1".into(),
                credited_amount: 100.0,
                credited_at: "2024-01-01".into(),
                currency: "INR".into(),
            },
            settlement: Settlement {
                settlement_id: "S1".into(),
                payment_id: "P1".into(),
                gross_amount: 100.0,
                fee: 0.0,
                tax: 0.0,
                net_amount: 100.0,
                settled_at: "2024-01-01".into(),
                utr: "UTR1".into(),
                currency: "INR".into(),
            },
            score: 0.7,
            reasoning: "test".into(),
            kind: None,
            rivals: None,
            split_options: None,
        }
    }

    fn install_log_capture() -> LogCapture {
        let capture = LogCapture(Arc::new(Mutex::new(Vec::new())));
        let _ = tracing_subscriber::fmt()
            .with_env_filter(EnvFilter::new("debug"))
            .with_writer(capture.clone())
            .with_ansi(false)
            .try_init();
        capture
    }

    fn assert_no_key_leak(blob: &str) {
        assert!(
            !blob.contains(FAKE_KEY),
            "fake API key leaked in output: {blob}"
        );
    }

    #[tokio::test]
    async fn http_401_error_path_does_not_leak_api_key() {
        let mock = MockServer::start().await;
        Mock::given(method("POST"))
            .and(path("/v1/messages"))
            .respond_with(ResponseTemplate::new(401))
            .mount(&mock)
            .await;

        let logs = install_log_capture();
        let url = format!("{}/v1/messages", mock.uri());
        let provider = AnthropicProvider::with_messages_url(
            Secret::new(FAKE_KEY.to_string()),
            url,
        );
        let candidate = dummy_candidate();

        let direct_err = provider.resolve(&candidate).await.unwrap_err().to_string();
        let retry_result = resolve_with_retry(&provider, &candidate).await;
        let retry_msg = match retry_result {
            LlmCallResult::ProviderError { message, .. } => message,
            other => panic!("expected ProviderError, got {other:?}"),
        };

        let log_text = String::from_utf8_lossy(&logs.0.lock().unwrap()).into_owned();
        let combined = format!("{direct_err}\n{retry_msg}\n{log_text}");
        assert_no_key_leak(&combined);
        assert!(direct_err.contains("401"), "expected HTTP 401 in error: {direct_err}");
    }

    #[tokio::test]
    async fn connection_refused_error_path_does_not_leak_api_key() {
        let logs = install_log_capture();
        let provider = AnthropicProvider::with_messages_url(
            Secret::new(FAKE_KEY.to_string()),
            "http://127.0.0.1:1/v1/messages".into(),
        );
        let candidate = dummy_candidate();

        let direct_err = provider.resolve(&candidate).await.unwrap_err().to_string();
        let retry_result = resolve_with_retry(&provider, &candidate).await;
        let retry_msg = match retry_result {
            LlmCallResult::ProviderError { message, attempts } => {
                assert_eq!(attempts, 2, "transport errors should retry once");
                message
            }
            other => panic!("expected ProviderError, got {other:?}"),
        };

        let log_text = String::from_utf8_lossy(&logs.0.lock().unwrap()).into_owned();
        let combined = format!("{direct_err}\n{retry_msg}\n{log_text}");
        assert_no_key_leak(&combined);
    }
}
