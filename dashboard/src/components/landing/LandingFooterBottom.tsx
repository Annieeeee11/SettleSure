const MARKS = [0, 1, 2, 3] as const;

export default function LandingFooterBottom() {
  return (
    <div className="flex flex-col gap-10 pl-[clamp(0.25rem,1.5vw,1rem)] md:flex-row md:items-end md:justify-between md:gap-12">
      <div>
        <div className="flex items-center gap-[0.85rem]">
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
        <p className="mt-4 max-w-[42ch] font-landing-mono text-[clamp(0.625rem,1.1vw,0.75rem)] uppercase leading-[1.55] tracking-[0.05em] text-landing-dim">
          Built for finance teams who demand precision, proof, and peace of mind.
        </p>
      </div>

      <p className="m-0 font-landing-mono text-[clamp(0.625rem,1.1vw,0.75rem)] uppercase leading-[1.55] tracking-[0.05em] text-landing-dim md:text-right">
        Audit. Reconcile. Close.
        <br />
        Every day.
      </p>
    </div>
  );
}
