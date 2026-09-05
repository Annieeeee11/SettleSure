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

  const content = error ? (
    <ErrorPage error={error} onRetry={retry} />
  ) : !report ? (
    <LoadingPage />
  ) : (
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

  return <div className="dashboard-page">{content}</div>;
}

export default function App() {
  const pathname = useRoute();

  if (!isDashboardRoute(pathname)) {
    return <LandingPage />;
  }

  return <DashboardApp />;
}
