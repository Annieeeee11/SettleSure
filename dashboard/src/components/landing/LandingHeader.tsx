import CornerActions from "@/components/CornerActions";
import { goToDashboard } from "@/hooks/useRoute";
import { LOGO, NAV_LINKS } from "@/lib/landingContent";

export default function LandingHeader() {
  return (
    <header className="sticky top-0 z-50 grid grid-cols-[1fr_auto] items-center gap-4 border-b border-[var(--surface-divider)] bg-[var(--bg)]/90 px-6 py-3.5 backdrop-blur-md md:grid-cols-[1fr_auto_1fr]">
      <a className="inline-flex items-center" href="/" aria-label={LOGO.alt}>
        <img
          src={LOGO.src}
          alt={LOGO.alt}
          className="h-8 w-auto object-contain object-left"
        />
      </a>
      <nav
        className="hidden items-center justify-center gap-6 md:flex"
        aria-label="Landing"
      >
        {NAV_LINKS.map((link) => (
          <a
            key={link.href}
            href={link.href}
            className="text-[0.8125rem] font-medium text-[var(--text-secondary)] hover:text-[var(--text)]"
          >
            {link.label}
          </a>
        ))}
      </nav>
      <div className="flex items-center justify-end gap-2 md:col-start-3">
        <button
          type="button"
          className="h-9 rounded-full bg-[var(--surface)] px-3.5 text-[0.8125rem] font-medium text-[var(--text-secondary)] shadow-[var(--shadow-raised-sm)] hover:text-[var(--text)]"
          onClick={goToDashboard}
        >
          Dashboard
        </button>
        <CornerActions layout="inline" />
      </div>
    </header>
  );
}
