import { WORDMARK } from "@/lib/landingContent";

type SettleSureWordmarkProps = {
  variant?: "dark" | "light" | "navbar";
  size?: "sm" | "md";
  showTagline?: boolean;
  className?: string;
};

const sizeClasses = {
  sm: "text-[0.36rem] leading-[1.12] sm:text-[0.38rem]",
  md: "text-[0.42rem] leading-[1.15] sm:text-[0.5rem]",
} as const;

function renderChar(ch: string, key: number, solidClass: string, shadowClass: string) {
  if (ch === "█") return <span className={solidClass} key={key}>{ch}</span>;
  if (ch === "░") return <span className={shadowClass} key={key}>{ch}</span>;
  return <span key={key}>{ch}</span>;
}

export default function SettleSureWordmark({
  variant = "dark",
  size = "sm",
  showTagline = true,
  className = "",
}: SettleSureWordmarkProps) {
  const solidClass =
    variant === "light"
      ? "text-[#ece6ff]"
      : variant === "navbar"
        ? "text-[var(--landing-wordmark-solid)]"
        : "text-[var(--text)]";
  const shadowClass =
    variant === "light"
      ? "text-[#7a6f99]/75"
      : variant === "navbar"
        ? "text-[var(--landing-wordmark-shadow)]"
        : "text-[var(--text-tertiary)]";

  return (
    <div className={`inline-flex flex-col items-start ${className}`} aria-label="SettleSure">
      <pre
        className={`m-0 overflow-hidden font-mono whitespace-pre ${sizeClasses[size]}`}
        aria-hidden="true"
      >
        {WORDMARK.map((line, i) => (
          <span className="block" key={i}>
            {line.split("").map((ch, j) => renderChar(ch, j, solidClass, shadowClass))}
          </span>
        ))}
      </pre>
      {showTagline ? (
        <p
          className={`mt-1 font-mono text-[9px] tracking-[0.02em] ${
            variant === "light"
              ? "text-white/45"
              : variant === "navbar"
                ? "text-[var(--landing-wordmark-shadow)]"
                : "text-[var(--text-tertiary)]"
          }`}
        >
          settlement reconciliation
        </p>
      ) : null}
    </div>
  );
}
