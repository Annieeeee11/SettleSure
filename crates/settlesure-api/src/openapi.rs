//! OpenAPI 3.0 contract (minimal).

use serde_json::{json, Value};

pub fn openapi_spec() -> Value {
    json!({
        "openapi": "3.0.3",
        "info": {
            "title": "SettleSure API",
            "version": "2.0.0",
            "description": "Payment gateway settlement reconciliation API"
        },
        "paths": {
            "/api/health": {
                "get": {
                    "summary": "Health check",
                    "responses": {
                        "200": {
                            "description": "Service healthy",
                            "content": {
                                "application/json": {
                                    "schema": {
                                        "type": "object",
                                        "properties": {
                                            "status": { "type": "string" },
                                            "version": { "type": "string" }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            },
            "/api/v1/reconcile": {
                "post": {
                    "summary": "Reconcile payments, settlements, and bank credits",
                    "parameters": [
                        {
                            "name": "X-API-Key",
                            "in": "header",
                            "required": true,
                            "schema": { "type": "string" }
                        },
                        {
                            "name": "Idempotency-Key",
                            "in": "header",
                            "required": false,
                            "schema": { "type": "string" }
                        }
                    ],
                    "requestBody": {
                        "required": true,
                        "content": {
                            "application/json": {
                                "schema": {
                                    "type": "object",
                                    "required": ["payments", "settlements", "bankTransactions"],
                                    "properties": {
                                        "payments": { "type": "array" },
                                        "settlements": { "type": "array" },
                                        "bankTransactions": { "type": "array" }
                                    }
                                }
                            }
                        }
                    },
                    "responses": {
                        "200": { "description": "Reconciliation report (FullReport JSON)" },
                        "401": { "description": "Invalid API key" },
                        "413": { "description": "Batch exceeds 20,000 record limit" },
                        "422": { "description": "Validation error" }
                    }
                }
            }
        }
    })
}
