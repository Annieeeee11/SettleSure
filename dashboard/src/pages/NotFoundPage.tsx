import { Link } from "react-router-dom";
import CornerActions from "../components/CornerActions";
import StatePage from "../components/StatePage";
import Wordmark from "../Wordmark";

export default function NotFoundPage() {
  return (
    <div className="shell state-shell">
      <CornerActions />
      <Wordmark />
      <StatePage
        icon="error"
        title="Page not found"
        message="That URL doesn't match anything in SettleSure."
        action={
          <>
            <Link className="btn primary" to="/">
              Back to home
            </Link>
            <Link className="btn ghost" to="/dashboard">
              Open dashboard
            </Link>
          </>
        }
      />
    </div>
  );
}
