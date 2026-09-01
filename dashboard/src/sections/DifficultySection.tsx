import { motion } from "framer-motion";
import { DIFFICULTY_META } from "../lib/constants";
import { pct } from "../types";
import type { AmbiguityLevel, FullReport } from "../types";

export default function DifficultySection({ report }: { report: FullReport }) {
  const byLevel = report.metrics.byAmbiguityLevel;
  if (!byLevel) return null;

  return (
    <motion.section
      className="panel difficulty"
      aria-label="Accuracy by difficulty"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.25, duration: 0.4 }}
    >
      <div className="panel-head">
        <h2>Accuracy by case difficulty</h2>
        <p className="panel-note">
          One number is not enough, this is where the system is actually being
          tested.
        </p>
      </div>
      <div className="difficulty-grid">
        {(
          ["clear", "boundary", "decoy", "unresolvable"] as AmbiguityLevel[]
        ).map((level, i) => {
          const slice = byLevel[level];
          const meta = DIFFICULTY_META[level];
          if (!slice) return null;
          const deferred =
            slice.deferredTotal != null && slice.deferredTotal > 0
              ? `${slice.correctlyDeferred ?? 0}/${slice.deferredTotal}`
              : null;
          return (
            <motion.div
              className="diff-card"
              key={level}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 + i * 0.06, duration: 0.35 }}
            >
              <h3>{meta.title}</h3>
              <p className="diff-sub">{meta.subtitle}</p>
              {level === "decoy" || level === "unresolvable" ? (
                <p className="diff-main">
                  correctly deferred: <strong>{deferred ?? "—"}</strong>
                </p>
              ) : (
                <>
                  <p className="diff-main">
                    match rate <strong>{pct(slice.matchRate)}</strong>
                  </p>
                  <p className="diff-sec">precision {pct(slice.precision)}</p>
                </>
              )}
            </motion.div>
          );
        })}
      </div>
    </motion.section>
  );
}
