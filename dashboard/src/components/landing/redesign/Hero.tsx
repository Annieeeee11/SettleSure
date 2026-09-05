import { goToDashboard } from "@/hooks/useRoute";
import { DarkGradientBg } from "./DarkGradientBg";
import Header from "./Header";
import { openExternal, repositoryUrl } from "./content";

export default function Hero() {
  return (
    <section className="relative pb-10 pt-3 max-[700px]:pb-8 max-[700px]:pt-2">
      <DarkGradientBg
        aria-hidden
        className="hero-section-gradient pointer-events-none absolute inset-0 z-0"
      />
      <Header />
      <div className="relative z-10 mx-auto max-w-[1180px] px-[max(24px,6vw)] max-[700px]:px-4">
        <div className="mx-auto max-w-[880px] pt-24 text-center max-[700px]:pt-16">
          <h1 className="sc-hero-title landing-display text-balance text-[clamp(48px,6.4vw,88px)] font-normal leading-[0.92] tracking-[-0.065em] text-[var(--text)]">
            <span className="block text-[var(--text)]">Three exports in.</span>
            <span className="block text-[var(--text)]">One audit-ready close.</span>
          </h1>
          <div className="sc-reveal mt-10 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={goToDashboard}
              className="landing-btn landing-btn-primary h-11 gap-2 px-5 text-[14px] font-medium"
            >
              Reconcile now
              <span aria-hidden="true">→</span>
            </button>
            <button
              type="button"
              onClick={() => openExternal(repositoryUrl)}
              className="landing-btn landing-btn-secondary h-11 px-5 text-[14px] font-medium"
            >
              Clone from GitHub
            </button>
          </div>
        </div>

        <div className="sc-hero-media mx-auto mt-16 grid max-w-[1180px] grid-cols-2 gap-3 max-[700px]:mt-12 max-[700px]:grid-cols-1">
          <ProductCard
            image="/ness/dashboad-light.png"
            darkImage="/ness/dashboad-dak2.png"
            alt="SettleSure dashboard with benchmark metrics and exception queue"
          />
          <ProductCard
            image="/cli.png"
            alt="SettleSure command-line reconciliation report"
          />
        </div>
      </div>
    </section>
  );
}

function ProductCard({
  image,
  darkImage,
  alt,
}: {
  image: string;
  darkImage?: string;
  alt: string;
}) {
  return (
    <article className="overflow-hidden rounded-landing border border-white/10 shadow-[var(--landing-card-shadow-sm)]">
      <DarkGradientBg className="relative flex min-h-[320px] items-center px-4 py-4 md:min-h-[380px] md:px-5 md:py-5">
        <div className="w-full overflow-hidden rounded-landing-btn border border-white/12 shadow-[0_18px_44px_rgba(0,0,0,.42)]">
          <img
            src={image}
            alt={alt}
            className={darkImage ? "theme-dashboard-light block h-auto w-full" : "block h-auto w-full"}
          />
          {darkImage && (
            <img
              src={darkImage}
              alt={alt}
              className="theme-dashboard-dark h-auto w-full"
            />
          )}
        </div>
      </DarkGradientBg>
    </article>
  );
}
