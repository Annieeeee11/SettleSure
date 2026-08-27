#!/usr/bin/env sh
set -e
if [ -z "$ANTHROPIC_API_KEY" ]; then
  echo "ablation-anthropic: ANTHROPIC_API_KEY is not set."
  echo "Export your key, then rerun: npm run ablation-anthropic"
  exit 1
fi
exec cargo run -p settlesure-cli -- --seed 42 --compare-llm --llm-provider anthropic --no-banner
