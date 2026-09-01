import { motion } from "framer-motion";
import { pct } from "../types";
import type { FullReport } from "../types";

export default function LlmAblationSection({ report }: { report: FullReport }) {
  const ablation = report.metrics.llmAblation;
  if (!ablation) return null;

  return (
    <motion.section
      className="panel"
      aria-label="LLM impact"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.35 }}
    >
      <h2>LLM impact</h2>
      {!ablation.providerAvailable && (
        <p className="panel-note">
          No LLM provider available for this report — both columns fell back to
          none. Set <code>ANTHROPIC_API_KEY</code> or run Ollama, then{" "}
          <code>npm run reconcile -- --seed 42 --compare-llm</code>.
        </p>
      )}
      <div className="ablation-grid">
        <div>
          <h3>With LLM ({ablation.withLlm.provider})</h3>
          <p>Recall {pct(ablation.withLlm.recall)}</p>
          <p>Precision {pct(ablation.withLlm.precision)}</p>
          <p>LLM matches {ablation.withLlm.llmMatches}</p>
        </div>
        <div>
          <h3>Without LLM</h3>
          <p>Recall {pct(ablation.withoutLlm.recall)}</p>
          <p>Precision {pct(ablation.withoutLlm.precision)}</p>
          <p>LLM matches {ablation.withoutLlm.llmMatches}</p>
        </div>
      </div>
    </motion.section>
  );
}
