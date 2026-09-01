import CornerActions from "../components/CornerActions";
import StatePage from "../components/StatePage";
import Wordmark from "../Wordmark";
import { friendlyError } from "../lib/utils";

export default function ErrorPage({
  error,
  onRetry,
}: {
  error: string;
  onRetry: () => void;
}) {
  return (
    <div className="shell state-shell">
      <CornerActions />
      <Wordmark />
      <StatePage
        icon="error"
        title="Couldn't load report"
        message={friendlyError(error)}
        action={
          <button className="btn primary" onClick={onRetry}>
            Retry
          </button>
        }
        hint={<>The live demo remains available after the benchmark loads.</>}
      />
    </div>
  );
}
