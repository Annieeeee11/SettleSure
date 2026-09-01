import { useReport } from "./hooks/useReport";
import DashboardPage from "./pages/DashboardPage";
import ErrorPage from "./pages/ErrorPage";
import LoadingPage from "./pages/LoadingPage";
import "./App.css";

export default function App() {
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
