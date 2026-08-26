//! Shared HTTP client settings for LLM providers.

use std::time::Duration;

/// Total request timeout for LLM inference (connect + response body).
/// Local CPU inference can exceed 30s on cold model load; budget generously.
pub const REQUEST_TIMEOUT: Duration = Duration::from_secs(120);

/// Backoff before retrying a transport-level failure.
pub const TRANSPORT_RETRY_BACKOFF: Duration = Duration::from_secs(2);

/// Initial attempt + one retry on transport errors only.
pub const MAX_LLM_ATTEMPTS: u32 = 2;

pub fn build_http_client() -> reqwest::Client {
    reqwest::Client::builder()
        .timeout(REQUEST_TIMEOUT)
        .build()
        .expect("reqwest client")
}
