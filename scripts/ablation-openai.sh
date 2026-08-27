#!/usr/bin/env sh
set -e
if [ -z "$OPENAI_API_KEY" ]; then
  echo "ablation-openai: OPENAI_API_KEY is not set."
  echo "Export your key, then rerun: npm run ablation-openai"
  exit 1
fi
exec cargo run -p settlesure-cli -- --seed 42 --compare-llm --llm-provider openai --llm-model gpt-4o-mini --no-banner
