//! HTTP handlers and shared API state.

mod handlers;
mod idempotency;
mod openapi;

pub use handlers::router;
pub use idempotency::IdempotencyStore;
pub use openapi::openapi_spec;

use std::sync::Arc;

pub const MAX_BATCH_RECORDS: usize = 20_000;
pub const IDEMPOTENCY_TTL_SECS: u64 = 86_400;

#[derive(Clone)]
pub struct ApiState {
    pub version: String,
    pub api_key: Option<String>,
    pub idempotency: Arc<IdempotencyStore>,
}

impl ApiState {
    pub fn from_env() -> Self {
        let version = std::env::var("SETTLESURE_VERSION")
            .unwrap_or_else(|_| env!("CARGO_PKG_VERSION").to_string());
        let api_key = std::env::var("API_KEY").ok().filter(|s| !s.is_empty());
        Self {
            version,
            api_key,
            idempotency: Arc::new(IdempotencyStore::new(IDEMPOTENCY_TTL_SECS)),
        }
    }
}
