import CornerActions from "../components/CornerActions";
import StatePage from "../components/StatePage";
import Wordmark from "../Wordmark";

export default function LoadingPage() {
  return (
    <div className="shell state-shell">
      <CornerActions />
      <Wordmark />
      <StatePage
        icon="loading"
        title="Loading report"
        message="Fetching reconciliation data…"
      />
    </div>
  );
}
