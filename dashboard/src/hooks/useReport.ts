import { useCallback, useEffect, useState } from "react";
import type { FullReport } from "../types";
import type { ReportMode } from "../components/ReconcilePanel";

export function useReport() {
  const [report, setReport] = useState<FullReport | null>(null);
  const [reportMode, setReportMode] = useState<ReportMode>("benchmark");
  const [error, setError] = useState<string | null>(null);

  const loadReport = useCallback(() => {
    return fetch(`/report.json?t=${Date.now()}`)
      .then((r) => {
        if (!r.ok)
          throw new Error("Missing report.json — run npm run reconcile first");
        return r.json();
      })
      .then((data: FullReport) => {
        setReport(data);
        setReportMode("benchmark");
        setError(null);
      });
  }, []);

  useEffect(() => {
    loadReport().catch((e: Error) => setError(e.message));
  }, [loadReport]);

  const retry = useCallback(() => {
    setError(null);
    loadReport().catch((e: Error) => setError(e.message));
  }, [loadReport]);

  return {
    report,
    reportMode,
    error,
    setReport,
    setReportMode,
    setError,
    retry,
  };
}
