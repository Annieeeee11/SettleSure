import { motion } from "framer-motion";
import Wordmark from "../Wordmark";
import type { ReportMode } from "../components/ReconcilePanel";
import type { FullReport } from "../types";

export default function HeroSection({
  report,
  reportMode,
}: {
  report: FullReport;
  reportMode: ReportMode;
}) {
  const m = report.metrics;

  return (
    <motion.header
      className="hero"
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <Wordmark />
      <p className="sub">
        {reportMode === "benchmark"
          ? `Audited benchmark · seed ${m.seed}`
          : reportMode === "live-csv"
            ? "Live CSV reconciliation"
            : "Live judge sample"}{" "}
        · {m.paymentCount} payments · {m.settlementCount} settlements ·{" "}
        {m.bankCount} credits
        {m.amountAtRisk != null && m.amountAtRisk > 0
          ? ` · ₹${m.amountAtRisk.toFixed(2)} at risk`
          : ""}
      </p>
    </motion.header>
  );
}
