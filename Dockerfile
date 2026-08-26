# Multi-stage Rust build for SettleSure CLI (engine only — no dashboard/Node).
FROM rust:1.90-bookworm AS build
WORKDIR /app

# Layer 1: manifests only
COPY Cargo.toml Cargo.lock ./
COPY crates/settlesure-types/Cargo.toml crates/settlesure-types/Cargo.toml
COPY crates/settlesure-data/Cargo.toml crates/settlesure-data/Cargo.toml
COPY crates/settlesure-engine/Cargo.toml crates/settlesure-engine/Cargo.toml
COPY crates/settlesure-scoring/Cargo.toml crates/settlesure-scoring/Cargo.toml
COPY crates/settlesure-llm/Cargo.toml crates/settlesure-llm/Cargo.toml
COPY crates/settlesure-integration/Cargo.toml crates/settlesure-integration/Cargo.toml
COPY crates/settlesure-cli/Cargo.toml crates/settlesure-cli/Cargo.toml

# Layer 2: dependency compile (stub sources)
COPY docker/stub-crates.sh docker/stub-crates.sh
RUN chmod +x docker/stub-crates.sh && ./docker/stub-crates.sh \
  && cargo build --release -p settlesure-cli

# Layer 3: real sources (touch so mtime beats stub-build artifacts)
COPY crates/ crates/
RUN find crates -name '*.rs' -exec touch {} + \
  && cargo build --release -p settlesure-cli

FROM debian:bookworm-slim
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=build /app/target/release/settlesure /usr/local/bin/settlesure
ENTRYPOINT ["settlesure"]
CMD ["--seed", "42", "--skip-llm", "--no-banner"]
