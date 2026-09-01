import { motion } from "framer-motion";
import type { DashboardTab } from "../lib/constants";

export default function TabBar({
  tab,
  exceptionCount,
  matchCount,
  onChange,
}: {
  tab: DashboardTab;
  exceptionCount: number;
  matchCount: number;
  onChange: (tab: DashboardTab) => void;
}) {
  return (
    <div className="tabs" role="tablist" aria-label="Exceptions and matches">
      <motion.div
        className="tab-indicator"
        animate={{ left: tab === "exceptions" ? 3 : "50%" }}
        transition={{ type: "spring", stiffness: 380, damping: 32 }}
      />
      {(
        [
          ["exceptions", `Exceptions (${exceptionCount})`],
          ["matches", `Matches (${matchCount})`],
        ] as const
      ).map(([id, label]) => (
        <button
          key={id}
          type="button"
          role="tab"
          aria-selected={tab === id}
          className={tab === id ? "active" : ""}
          onClick={() => onChange(id)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
