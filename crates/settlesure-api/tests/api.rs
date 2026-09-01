//! HTTP API integration tests.

use axum::body::Body;
use axum::http::{Request, StatusCode};
use settlesure_api::{router, ApiState};
use std::sync::Arc;
use tower::ServiceExt;

fn app() -> axum::Router {
    let state = Arc::new(ApiState {
        version: "test".into(),
        api_key: Some("test-key".into()),
        idempotency: Arc::new(settlesure_api::IdempotencyStore::new(3600)),
    });
    router(state)
}

#[tokio::test]
async fn health_returns_ok() {
    let app = app();
    let res = app
        .oneshot(
            Request::builder()
                .uri("/api/health")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(res.status(), StatusCode::OK);
}

#[tokio::test]
async fn reconcile_requires_api_key() {
    let app = app();
    let body = include_str!("../../../examples/request.json");
    let res = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/v1/reconcile")
                .header("Content-Type", "application/json")
                .body(Body::from(body))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(res.status(), StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn reconcile_with_key_returns_report() {
    let app = app();
    let body = include_str!("../../../examples/request.json");
    let res = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/v1/reconcile")
                .header("Content-Type", "application/json")
                .header("X-API-Key", "test-key")
                .body(Body::from(body))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(res.status(), StatusCode::OK);
}

#[tokio::test]
async fn idempotency_returns_cached_response() {
    let app = app();
    let body = include_str!("../../../examples/request.json");
    let req = || {
        Request::builder()
            .method("POST")
            .uri("/api/v1/reconcile")
            .header("Content-Type", "application/json")
            .header("X-API-Key", "test-key")
            .header("Idempotency-Key", "idem-1")
            .body(Body::from(body))
            .unwrap()
    };
    let res1 = app.clone().oneshot(req()).await.unwrap();
    assert_eq!(res1.status(), StatusCode::OK);
    let res2 = app.oneshot(req()).await.unwrap();
    assert_eq!(res2.status(), StatusCode::OK);
}
