#!/bin/sh
# Create minimal source stubs so `cargo build --release -p settlesure-cli` can cache deps.
set -eu

for crate in settlesure-types settlesure-data settlesure-engine settlesure-scoring settlesure-llm settlesure-integration; do
  mkdir -p "crates/${crate}/src"
  printf '%s\n' 'pub fn _docker_stub() {}' > "crates/${crate}/src/lib.rs"
done

mkdir -p crates/settlesure-cli/src crates/settlesure-cli/examples
printf '%s\n' 'fn main() {}' > crates/settlesure-cli/src/main.rs
printf '%s\n' 'fn main() {}' > crates/settlesure-cli/examples/bench_deterministic.rs
