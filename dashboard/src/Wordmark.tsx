const WORDMARK = [
  " ████ █████ █████ █████ █     █████  ████ █   █ ████  █████   ",
  "█ ░░░░█░░░░░ ░█░░░ ░█░░░█░    █░░░░░█ ░░░░█░  █░█░░░█ █░░░░░  ",
  " ███░░████░░░ █░░░░ █░░░█░░   ████░░░███░░█░░ █░████░░████░░░ ",
  "  ░░█ █░░░░   █░░   █░░ █░░   █░░░░   ░░█ █░░ █░█░░█░ █░░░░   ",
  "████░░█████░  █░░   █░░ █████ █████░████░░ ███ ░█░░░█░█████░  ",
  " ░░░░ ░░░░░░   ░░    ░░  ░░░░░ ░░░░░ ░░░░ ░ ░░░ ░░░  ░ ░░░░░  ",
  "  ░░░░  ░░░░░   ░     ░   ░░░░░ ░░░░░ ░░░░   ░░░  ░   ░ ░░░░░ ",
] as const;

function renderChar(ch: string, key: number) {
  if (ch === "█") return <span className="wm-solid" key={key}>{ch}</span>;
  if (ch === "░") return <span className="wm-shadow" key={key}>{ch}</span>;
  return <span key={key}>{ch}</span>;
}

export default function Wordmark() {
  return (
    <div className="wordmark-wrap" aria-label="SettleSure">
      <pre className="wordmark" aria-hidden="true">
        {WORDMARK.map((line, i) => (
          <span className="wordmark-line" key={i}>
            {line.split("").map((ch, j) => renderChar(ch, j))}
          </span>
        ))}
      </pre>
      <p className="wordmark-tagline">settlement reconciliation</p>
    </div>
  );
}
