import { goToDashboard } from "@/hooks/useRoute";
import { controls, openExternal, repositoryUrl, xProfileUrl } from "./content";
import { DarkGradientBg } from "./DarkGradientBg";
import { Arrow, Brand } from "./Shared";

function GitHubIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 .3C5.37.3 0 5.67 0 12.3c0 5.3 3.44 9.8 8.21 11.39.6.11.82-.26.82-.58 0-.28-.01-1.03-.02-2.02-3.34.73-4.04-1.61-4.04-1.61-.55-1.39-1.34-1.76-1.34-1.76-1.09-.75.08-.73.08-.73 1.21.08 1.85 1.24 1.85 1.24 1.07 1.84 2.81 1.31 3.5 1 .11-.77.42-1.31.76-1.61-2.67-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.12-.3-.54-1.52.12-3.18 0 0 1.01-.32 3.3 1.23a11.5 11.5 0 0 1 6 0c2.29-1.55 3.3-1.23 3.3-1.23.66 1.66.24 2.88.12 3.18.77.84 1.24 1.91 1.24 3.22 0 4.61-2.81 5.62-5.49 5.92.43.37.81 1.1.81 2.22 0 1.61-.01 2.9-.01 3.3 0 .32.22.7.82.58A12.01 12.01 0 0 0 24 12.3C24 5.67 18.63.3 12 .3Z" />
    </svg>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.727-8.835L1.254 2.25H8.08l4.253 5.622L18.244 2.25Zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77Z" />
    </svg>
  );
}

const socialLinks = [
  { title: "GitHub", href: repositoryUrl, icon: GitHubIcon },
  { title: "X", href: xProfileUrl, icon: XIcon },
] as const;

type ControlItem = (typeof controls)[number];

function ControlGridCard({ item }: { item: ControlItem }) {
  return (
    <article className="sc-reveal flex min-h-[320px] flex-col items-center justify-center bg-[var(--surface)] p-8 text-center max-[700px]:min-h-0 max-[700px]:p-6 md:p-10">
      <h3 className="max-w-[340px] text-[clamp(22px,2.2vw,28px)] font-medium leading-snug tracking-[-0.02em]">
        {item.title}
      </h3>
      <p className="mt-3 max-w-[340px] text-[15px] leading-relaxed text-[var(--text-secondary)]">
        {item.copy}
      </p>
    </article>
  );
}

export function ControlsSection() {
  const [featured, second, third] = controls;

  return (
    <section id="resources" className="landing-section px-[max(24px,6vw)] py-[120px] max-[700px]:px-4 max-[700px]:py-16">
      <h2 className="sc-reveal mb-[88px] text-center text-[clamp(43px,5vw,68px)] font-normal leading-[1.03] tracking-[-.055em] max-[700px]:mb-12 max-[700px]:text-left max-[700px]:text-[42px]">
        Controls finance can inspect,<br />rerun, and defend.
      </h2>

      <div className="sc-reveal controls-grid mx-auto max-w-[1180px] overflow-hidden rounded-landing border">
        <div className="grid md:grid-cols-2">
          <div className="flex flex-col items-center justify-center bg-[var(--surface)] p-8 text-center max-[700px]:p-6 md:p-10 lg:p-12">
            <h3 className="max-w-[420px] text-[clamp(24px,2.8vw,34px)] font-medium leading-snug tracking-[-0.02em]">
              {featured.title}
            </h3>
            <p className="mt-3 max-w-[420px] text-[15px] leading-relaxed text-[var(--text-secondary)]">
              {featured.copy}
            </p>
          </div>

          <div className="controls-grid-cell border-t bg-[var(--surface-inset)] p-6 md:border-t-0 md:border-l md:p-8 lg:p-10">
            <DarkGradientBg className="h-full min-h-[280px] rounded-landing-btn md:min-h-[360px]">
              <div className="flex h-full min-h-[280px] items-center justify-center p-4 md:min-h-[360px]">
                <img
                  src="/settlesure-architecture.png"
                  alt="SettleSure reconciliation architecture"
                  className="h-full w-full rounded-[6px] object-cover object-top shadow-[var(--landing-card-shadow-sm)]"
                />
              </div>
            </DarkGradientBg>
          </div>
        </div>

        <div className="controls-grid-row grid md:grid-cols-[56px_minmax(0,1fr)_minmax(0,1fr)_56px]">
          <div className="landing-dot-strip hidden min-h-[320px] md:block" aria-hidden="true" />
          <ControlGridCard item={second} />
          <div className="controls-grid-cell border-t md:border-t-0 md:border-l">
            <ControlGridCard item={third} />
          </div>
          <div className="landing-dot-strip hidden min-h-[320px] md:block" aria-hidden="true" />
        </div>
      </div>
    </section>
  );
}

export function CtaSection() {
  return (
    <section className="p-4 pb-4 max-[700px]:p-2 max-[700px]:pb-2">
      <DarkGradientBg className="min-h-0 overflow-hidden rounded-landing text-white">
        <div className="flex flex-col items-center px-6 py-14 text-center max-[700px]:py-10">
          <p className="font-mono text-[10px] tracking-[.1em] text-[var(--landing-cta-muted)]">SETTLESURE / 2026</p>
          <h2 className="my-[30px] text-[clamp(56px,8vw,110px)] font-normal leading-[.9] tracking-[-.065em] max-[700px]:my-6">
            Clear books.
            <br />
            Calm close.
          </h2>
          <button
            type="button"
            onClick={goToDashboard}
            className="landing-btn landing-btn-primary px-5 py-3.5"
          >
            Reconcile now <Arrow />
          </button>
        </div>

        <div className="grid items-end gap-8 px-8 pb-7 pt-2 max-[700px]:gap-6 max-[700px]:px-5 max-[700px]:pb-6 max-[700px]:pt-1 md:grid-cols-2 lg:px-12">
          <div className="space-y-3.5">
            <Brand light />
            <p className="max-w-sm text-sm leading-relaxed text-[var(--landing-cta-muted)]">
              Deterministic Razorpay settlement reconciliation with exceptions your team can inspect.
            </p>
            <p className="font-mono text-[11px] tracking-[.08em] text-[var(--landing-cta-subtle)]">
              © {new Date().getFullYear()} SettleSure
            </p>
          </div>

          <div className="md:text-right">
            <p className="font-mono text-[10px] font-semibold uppercase tracking-[.14em] text-[var(--landing-accent)]">
              Social
            </p>
            <ul className="mt-3 space-y-2 text-sm">
              {socialLinks.map((link) => (
                <li key={link.title}>
                  <button
                    type="button"
                    onClick={() => openExternal(link.href)}
                    className="inline-flex items-center gap-1.5 text-[var(--landing-cta-muted)] transition-colors hover:text-[var(--landing-accent-strong)] md:justify-end"
                  >
                    <link.icon className="size-3.5 shrink-0" />
                    {link.title}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </DarkGradientBg>
    </section>
  );
}
