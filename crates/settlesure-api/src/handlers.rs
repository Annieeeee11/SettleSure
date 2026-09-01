//! Route handlers.

use crate::{ApiState, MAX_BATCH_RECORDS};
use axum::{
    body::Bytes,
    extract::State,
    http::{header, HeaderMap, StatusCode},
    response::{IntoResponse, Response},
    routing::{get, post},
    Json, Router,
};
use settlesure_engine::{reconcile_batch, ReconcileBatchOptions};
use settlesure_scoring::{score_operational_with_banks, KNOWN_LIMITATIONS};
use settlesure_types::{
    BankCredit, FullReport, Payment, Settlement, DEFAULT_CONFIG,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReconcileRequest {
    pub payments: Vec<Payment>,
    pub settlements: Vec<Settlement>,
    #[serde(alias = "bank_transactions")]
    pub bank_transactions: Vec<BankCredit>,
}

pub fn router(state: Arc<ApiState>) -> Router {
    Router::new()
        .route("/api/health", get(health))
        .route("/api/v1/reconcile", post(reconcile))
        .route("/openapi.json", get(openapi))
        .with_state(state)
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct HealthResponse {
    status: &'static str,
    version: String,
}

async fn health(State(state): State<Arc<ApiState>>) -> Json<HealthResponse> {
    Json(HealthResponse {
        status: "ok",
        version: state.version.clone(),
    })
}

async fn openapi() -> Json<serde_json::Value> {
    Json(crate::openapi_spec())
}

async fn reconcile(
    State(state): State<Arc<ApiState>>,
    headers: HeaderMap,
    body: Bytes,
) -> Response {
    if let Some(resp) = check_api_key(&state, &headers) {
        return resp;
    }

    if let Some(key) = headers.get("idempotency-key").and_then(|v| v.to_str().ok()) {
        if let Some(cached) = state.idempotency.get(key) {
            if let Ok(json) = serde_json::from_slice::<serde_json::Value>(&cached) {
                return (StatusCode::OK, Json(json)).into_response();
            }
        }
    }

    let req: ReconcileRequest = match serde_json::from_slice(&body) {
        Ok(r) => r,
        Err(e) => {
            return error_response(
                StatusCode::BAD_REQUEST,
                &format!("invalid JSON body: {e}"),
            );
        }
    };

    let total = req.payments.len() + req.settlements.len() + req.bank_transactions.len();
    if total > MAX_BATCH_RECORDS {
        return error_response(
            StatusCode::PAYLOAD_TOO_LARGE,
            &format!(
                "batch size {total} exceeds limit of {MAX_BATCH_RECORDS} records (payments + settlements + bank_transactions)"
            ),
        );
    }

    if req.settlements.is_empty() || req.bank_transactions.is_empty() || req.payments.is_empty() {
        return error_response(
            StatusCode::UNPROCESSABLE_ENTITY,
            "payments, settlements, and bank_transactions must each be non-empty",
        );
    }

    let result = reconcile_batch(
        &req.payments,
        &req.settlements,
        &req.bank_transactions,
        &DEFAULT_CONFIG,
        &ReconcileBatchOptions {
            skip_llm: true,
            corrections: vec![],
        },
    );

    let metrics = score_operational_with_banks(
        &result,
        &req.bank_transactions,
        0,
        false,
        "none",
    );

    let report = FullReport {
        metrics,
        matches: result.matches,
        exceptions: result.exceptions,
        known_limitations: KNOWN_LIMITATIONS.iter().map(|s| (*s).to_string()).collect(),
    };

    let json = match serde_json::to_value(&report) {
        Ok(v) => v,
        Err(e) => {
            return error_response(
                StatusCode::INTERNAL_SERVER_ERROR,
                &format!("failed to serialize report: {e}"),
            );
        }
    };

    if let Some(key) = headers.get("idempotency-key").and_then(|v| v.to_str().ok()) {
        if let Ok(bytes) = serde_json::to_vec(&json) {
            state.idempotency.put(key.to_string(), bytes);
        }
    }

    (StatusCode::OK, Json(json)).into_response()
}

fn check_api_key(state: &ApiState, headers: &HeaderMap) -> Option<Response> {
    let Some(ref expected) = state.api_key else {
        return None;
    };
    let provided = headers
        .get("x-api-key")
        .and_then(|v| v.to_str().ok());
    match provided {
        Some(k) if k == expected => None,
        _ => Some(error_response(
            StatusCode::UNAUTHORIZED,
            "missing or invalid X-API-Key header",
        )),
    }
}

fn error_response(status: StatusCode, message: &str) -> Response {
    (
        status,
        [(header::CONTENT_TYPE, "application/json")],
        serde_json::json!({ "error": message }).to_string(),
    )
        .into_response()
}
