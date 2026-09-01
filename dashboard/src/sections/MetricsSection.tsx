import { motion } from "framer-motion";
import Metric from "../components/Metric";
import { fadeUp } from "../lib/constants";
import { pct } from "../types";
import type { ReportMode } from "../components/ReconcilePanel";
import type { FullReport } from "../types";

export default function MetricsSection({
  report,
  reportMode,
}: {
  report: FullReport;
  reportMode: ReportMode;
}) {
  const m = report.metrics;

  const metrics =
    reportMode === "benchmark"
      ? [
          { label: "Match rate", value: pct(m.matchRate) },
          { label: "Precision", value: pct(m.precision) },
          { label: "Recall", value: pct(m.recall) },
          {
            label: "FP rate",
            value: pct(m.falsePositiveRate),
            danger: true,
          },
          {
            label: "Throughput",
            value: `${m.throughputRecordsPerSec.toFixed(0)}/s`,
          },
        ]
      : [
          { label: "Match rate", value: pct(m.matchRate) },
          { label: "Matched", value: report.matches.length.toString() },
          { label: "Exceptions", value: report.exceptions.length.toString() },
          {
            label: "Throughput",
            value: `${m.throughputRecordsPerSec.toFixed(0)}/s`,
          },
          {
            label: "Amount at risk",
            value: `₹${(m.amountAtRisk ?? 0).toLocaleString("en-IN")}`,
          },
        ];

  return (
    <section className="metrics" aria-label="Headline metrics">
      {metrics.map((metric, i) => (
        <motion.div
          key={metric.label}
          custom={i}
          variants={fadeUp}
          initial="hidden"
          animate="visible"
        >
          <Metric
            label={metric.label}
            value={metric.value}
            danger={metric.danger}
          />
        </motion.div>
      ))}
    </section>
  );
}
