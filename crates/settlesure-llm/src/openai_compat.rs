//! OpenAI-compatible chat completions provider (BYOK).

use crate::client::build_http_client;
use crate::provider::{
    build_resolve_payload, map_reqwest_error, parse_verdict_json, LlmError, LlmProvider, LlmVerdict,
    SETTLEMENT_SYSTEM_PROMPT,
};
use async_trait::async_trait;
use settlesure_types::{AmbiguousCandidate, Secret};
use tracing::debug;

const DEFAULT_BASE_URL: &str = "https://api.openai.com/v1";
const DEFAULT_MODEL: &str = "gpt-4o-mini";

pub struct OpenAiCompatProvider {
    api_key: Secret<String>,
    client: reqwest::Client,
    model: String,
    chat_url: String,
}

fn normalize_chat_url(base_url: &str) -> String {
    let trimmed = base_url.trim_end_matches('/');
    if trimmed.ends_with("/chat/completions") {
        trimmed.to_string()
    } else {
        format!("{trimmed}/chat/completions")
    }
}

impl OpenAiCompatProvider {
    pub fn new(api_key: Secret<String>, model: Option<String>, base_url: Option<String>) -> Self {
        let base = base_url.unwrap_or_else(|| DEFAULT_BASE_URL.into());
        Self::with_chat_url(
            api_key,
            model.unwrap_or_else(|| DEFAULT_MODEL.into()),
            normalize_chat_url(&base),
        )
    }

    pub(crate) fn with_chat_url(
        api_key: Secret<String>,
        model: String,
        chat_url: String,
    ) -> Self {
        Self {
            api_key,
            client: build_http_client(),
            model,
            chat_url,
        }
    }
}

#[async_trait]
impl LlmProvider for OpenAiCompatProvider {
    fn name(&self) -> &str {
        "openai"
    }

    async fn resolve(&self, pair: &AmbiguousCandidate) -> Result<LlmVerdict, LlmError> {
        let user_content = build_resolve_payload(pair);
        debug!(provider = "openai", model = %self.model, "sending resolve request");

        let body = serde_json::json!({
            "model": self.model,
            "temperature": 0,
            "response_format": { "type": "json_object" },
            "messages": [
                { "role": "system", "content": SETTLEMENT_SYSTEM_PROMPT },
                { "role": "user", "content": user_content },
            ],
        });

        let res = self
            .client
            .post(&self.chat_url)
            .header("Authorization", format!("Bearer {}", self.api_key.expose()))
            .header("content-type", "application/json")
            .json(&body)
            .send()
            .await
            .map_err(map_reqwest_error)?;

        if !res.status().is_success() {
            let status = res.status();
            let _ = res.text().await;
            return Err(LlmError::transport(format!("OpenAI HTTP {status}")));
        }

        let value: serde_json::Value = res.json().await.map_err(map_reqwest_error)?;
        let content = value
            .pointer("/choices/0/message/content")
            .and_then(|v| v.as_str())
            .unwrap_or("");
        Ok(parse_verdict_json(content))
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

    const FAKE_KEY: &str = "sk-test-fake-openai-key-do-not-use";

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
            .and(path("/v1/chat/completions"))
            .respond_with(ResponseTemplate::new(401))
            .mount(&mock)
            .await;

        let logs = install_log_capture();
        let url = format!("{}/v1/chat/completions", mock.uri());
        let provider = OpenAiCompatProvider::with_chat_url(
            Secret::new(FAKE_KEY.to_string()),
            "gpt-4o-mini".into(),
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
        let provider = OpenAiCompatProvider::with_chat_url(
            Secret::new(FAKE_KEY.to_string()),
            "gpt-4o-mini".into(),
            "http://127.0.0.1:1/v1/chat/completions".into(),
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
