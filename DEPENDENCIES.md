# Dependency justifications

Every external crate is listed here. Prefer not adding more without updating this file.

| Crate | Why |
| --- | --- |
| `serde` / `serde_json` | Serialize domain types to the existing `data/*.json` / `output/report.json` camelCase wire format |
| `thiserror` | Typed errors; only `main` decides exit codes |
| `clap` | CLI flag parsing with the same flag surface as the TS CLI |
| `tokio` | Async runtime **only** for LLM HTTP; engine stays sync |
| `reqwest` (rustls) | Anthropic + Ollama HTTP without OpenSSL |
| `async-trait` | `LlmProvider` async trait object |
| `tracing` / `tracing-subscriber` | Structured logging in libraries; CLI owns the subscriber |
| `chrono` | Date arithmetic matching JS `Date.UTC` / `YYYY-MM-DD` day math |
| `proptest` | Property tests for fuzzy tolerance and split pool/combo bounds |

**Not used:** full web frameworks (`axum` etc.) — dashboard corrections/rerun stay in the Vite middleware. No `rand` crate — Mulberry32 is local for bit-identical seeding. No `unsafe`. No `ts-rs` (manual type mirror for v1).
