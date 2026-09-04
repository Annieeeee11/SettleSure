import { useReport } from "./hooks/useReport";
import { isDashboardRoute, useRoute } from "./hooks/useRoute";
import DashboardPage from "./pages/DashboardPage";
import ErrorPage from "./pages/ErrorPage";
import LandingPage from "./pages/LandingPage";
import LoadingPage from "./pages/LoadingPage";
import "./App.css";

function DashboardApp() {
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

export default function App() {
  const pathname = useRoute();

  if (!isDashboardRoute(pathname)) {
    return <LandingPage />;
  }

  return <DashboardApp />;
}
