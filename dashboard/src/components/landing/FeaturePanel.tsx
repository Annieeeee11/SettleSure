import type { ReactNode } from "react";

export function FeaturePanel({
  title,
  children,
  className = "",
}: {
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`overflow-hidden rounded-2xl border border-[var(--card-border)] bg-[var(--surface)] shadow-[var(--shadow-raised-sm)] ${className}`}
    >
      <div className="flex items-center gap-1.5 border-b border-[var(--card-border)] px-4 py-3">
        <span className="size-2.5 rounded-full bg-red-500/90" aria-hidden />
        <span className="size-2.5 rounded-full bg-amber-400/90" aria-hidden />
        <span className="size-2.5 rounded-full bg-emerald-500/90" aria-hidden />
        {title ? (
          <span className="ml-auto font-mono text-[10px] text-[var(--text-tertiary)]">
            {title}
          </span>
        ) : null}
      </div>
      <div className="p-5 sm:p-6">{children}</div>
    </div>
  );
}
