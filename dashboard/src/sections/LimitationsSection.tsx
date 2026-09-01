import type { FullReport } from "../types";

export default function LimitationsSection({ report }: { report: FullReport }) {
  if (report.knownLimitations.length === 0) return null;

  return (
    <section className="panel limitations" aria-label="Known limitations">
      <div>
        <span className="console-kicker">Transparent by design</span>
        <h2>Known limitations</h2>
      </div>
      <ul>
        {report.knownLimitations.map((limitation) => (
          <li key={limitation}>{limitation}</li>
        ))}
      </ul>
    </section>
  );
}
