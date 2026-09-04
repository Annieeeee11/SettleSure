import { useReport } from "../hooks/useReport";
import DashboardPage from "./DashboardPage";
import ErrorPage from "./ErrorPage";
import LoadingPage from "./LoadingPage";

export default function DashboardRoute() {
  const {
    report,
    reportMode,
    error,
    setReport,
    setReportMode,
    setError,
    retry,
  } = useReport();

  if (error) {
    return <ErrorPage error={error} onRetry={retry} />;
  }

  if (!report) {
    return <LoadingPage />;
  }

  return (
    <DashboardPage
      report={report}
      reportMode={reportMode}
      onReportComplete={(nextReport, mode) => {
        setReport(nextReport);
        setReportMode(mode);
        setError(null);
      }}
    />
  );
}
