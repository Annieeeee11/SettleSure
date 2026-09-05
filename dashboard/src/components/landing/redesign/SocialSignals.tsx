import { operatorSignals } from "./content";

function CommentIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path d="M3 4.5A1.5 1.5 0 0 1 4.5 3h11A1.5 1.5 0 0 1 17 4.5v7A1.5 1.5 0 0 1 15.5 13H9l-3.5 3v-3H4.5A1.5 1.5 0 0 1 3 11.5v-7Z" />
    </svg>
  );
}

function RedditPostCard({
  item,
}: {
  item: (typeof operatorSignals)[number];
}) {
  return (
    <article className="landing-card sc-reveal flex min-w-0 flex-col shadow-[var(--landing-card-shadow-sm)] transition-shadow hover:shadow-[var(--landing-card-shadow)]">
      <div className="border-b border-[var(--surface-divider)] px-4 py-3">
        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] leading-none text-[var(--text-tertiary)]">
          <span className="grid size-5 shrink-0 place-items-center rounded-full bg-[#ff4500] text-[8px] font-extrabold text-white">
            r
          </span>
          <span className="font-bold text-[var(--text)]">{item.source}</span>
          <span aria-hidden>·</span>
          <span>u/throwaway_finops</span>
          <span aria-hidden>·</span>
          <span>{item.age}</span>
        </div>
        <h3 className="mt-2 text-[15px] font-semibold leading-snug text-[var(--text)]">
          {item.title}
        </h3>
      </div>

      <div className="flex-1 px-4 py-3.5">
        <p className="m-0 text-[13px] leading-[1.55] text-[var(--text)]">{item.quote}</p>
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-[var(--surface-divider)] px-4 py-2.5 text-[11px] font-bold">
        <span className="inline-flex items-center gap-1.5 text-[var(--text-tertiary)]">
          <CommentIcon className="size-4" />
          {item.comments} Comments
        </span>
        <button
          type="button"
          onClick={() => window.open(item.href, "_blank", "noopener,noreferrer")}
          className="text-[12px] font-bold text-[#ff4500] hover:underline"
        >
          Open thread ↗
        </button>
      </div>
    </article>
  );
}

export default function SocialSignals() {
  return (
    <section
      id="signals"
      className="landing-section px-[max(24px,10vw)] py-[110px] max-[700px]:px-5 max-[700px]:py-16"
    >
      <div className="sc-reveal mx-auto mb-14 max-w-[820px] text-center max-[700px]:mb-10 max-[700px]:text-left">
        <p className="mb-4 inline-flex items-center gap-2 font-mono text-[11px] tracking-[.14em] text-[var(--landing-accent)]">
          <span className="size-1.5 rounded-full bg-[var(--landing-accent)]" aria-hidden />
          UPI &amp; bank transfer matching
        </p>
        <h2 className="text-[clamp(36px,4.6vw,58px)] font-normal leading-[1.02] tracking-[-.05em]">
          Operators still chase the same mismatches.
        </h2>
      </div>

      <div className="mx-auto grid max-w-[1180px] grid-cols-3 gap-5 max-[900px]:grid-cols-1">
        {operatorSignals.map((item) => (
          <RedditPostCard key={item.href} item={item} />
        ))}
      </div>
    </section>
  );
}
