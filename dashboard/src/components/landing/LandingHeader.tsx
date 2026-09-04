import { Link } from "react-router-dom";

const MARKS = [0, 1, 2, 3] as const;

export default function LandingHeader() {
  return (
    <header className="flex items-center justify-between gap-4">
      <div className="flex items-center gap-[0.85rem] pl-[clamp(0.5rem,2.25vw,1.35rem)]">
        <span className="font-landing-mono text-[clamp(0.8125rem,1.2vw,0.9375rem)] font-normal tracking-[0.01em] text-landing-light">
          SettleSure
        </span>
        <span className="inline-flex items-center gap-[0.28rem]" aria-hidden="true">
          {MARKS.map((mark) => (
            <span
              key={mark}
              className="block h-0.5 w-[clamp(0.55rem,1vw,0.7rem)] rounded-[1px] bg-landing-accent"
            />
          ))}
        </span>
      </div>

      <Link
        to="/dashboard"
        className="font-landing-mono text-[clamp(0.625rem,1.1vw,0.75rem)] uppercase tracking-[0.05em] text-landing-light transition-colors hover:text-landing-accent"
      >
        Dashboard →
      </Link>
    </header>
  );
}
