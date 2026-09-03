import { motion } from "framer-motion";
import type { FullReport } from "../types";

export default function MatchSourceSection({ report }: { report: FullReport }) {
  const breakdown = report.metrics.matchSourceBreakdown;
  const maxBar = Math.max(
    1,
    breakdown.exact,
    breakdown.fuzzy,
    breakdown.split,
    breakdown.llm,
    breakdown.human,
  );

  return (
    <motion.section
      className="panel match-source"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4, duration: 0.4 }}
    >
      <div className="panel-head row">
        <h2>Match source</h2>
        <span className="safety-note">Hard release gates enforced</span>
      </div>
      <div className="bars">
        {(
          [
            ["exact", breakdown.exact],
            ["fuzzy", breakdown.fuzzy],
            ["split", breakdown.split],
            ["llm", breakdown.llm],
            ["human", breakdown.human],
          ] as const
        ).map(([name, count], i) => (
          <div className="bar-row" key={name}>
            <span className="bar-label">{name}</span>
            <div className="bar-track">
              <motion.div
                className={`bar-fill bar-${name}`}
                initial={{ width: 0 }}
                animate={{ width: `${(count / maxBar) * 100}%` }}
                transition={{
                  delay: 0.5 + i * 0.08,
                  duration: 0.6,
                  ease: [0.25, 0.1, 0.25, 1] as const,
                }}
              />
            </div>
            <span className="bar-count">{count}</span>
          </div>
        ))}
      </div>
    </motion.section>
  );
}
