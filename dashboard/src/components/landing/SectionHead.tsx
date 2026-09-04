interface Props {
  eyebrow: string;
  title: string;
  desc: string;
}

export default function SectionHead({ eyebrow, title, desc }: Props) {
  return (
    <div className="mx-auto mb-8 max-w-2xl text-center">
      <p className="mb-3 font-mono text-[0.6875rem] font-semibold uppercase tracking-widest text-orange-500">
        {eyebrow}
      </p>
      <h2 className="mb-3 text-3xl font-semibold tracking-tight sm:text-4xl">
        {title}
      </h2>
      <p className="text-[0.9375rem] leading-relaxed text-[var(--text-secondary)]">
        {desc}
      </p>
    </div>
  );
}
