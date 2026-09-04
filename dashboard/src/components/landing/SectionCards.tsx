import type { SectionIconName } from "@/lib/landingContent";
import SectionIcon from "./SectionIcon";

interface CardItem {
  icon: SectionIconName;
  title: string;
  body: string;
}

interface Props {
  items: ReadonlyArray<CardItem>;
}

export default function SectionCards({ items }: Props) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {items.map((item) => (
        <article
          key={item.title}
          className="rounded-xl border border-[var(--card-border)] bg-[var(--surface)] p-5"
        >
          <div className="mb-4 inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--card-border)] text-[var(--text-secondary)]">
            <SectionIcon name={item.icon} />
          </div>
          <h3 className="mb-2 text-[0.9375rem] font-semibold tracking-tight">
            {item.title}
          </h3>
          <p className="text-[0.8125rem] leading-relaxed text-[var(--text-secondary)]">
            {item.body}
          </p>
        </article>
      ))}
    </div>
  );
}
