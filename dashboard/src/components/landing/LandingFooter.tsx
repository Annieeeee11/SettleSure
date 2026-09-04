import { goToDashboard } from "@/hooks/useRoute";
import { FOOTER } from "@/lib/landingContent";

export default function LandingFooter() {
  return (
    <footer className="border-t border-[var(--foot-divider)]">
      <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-4 px-6 py-6 text-xs text-[var(--text-tertiary)]">
        <span>{FOOTER.tagline}</span>
        <div className="flex flex-wrap gap-4">
          {FOOTER.links.map((link) =>
            link.external ? (
              <a
                key={link.label}
                className="text-[var(--text-secondary)] hover:text-[var(--text)]"
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
              >
                {link.label}
              </a>
            ) : (
              <button
                key={link.label}
                type="button"
                className="text-[var(--text-secondary)] hover:text-[var(--text)]"
                onClick={goToDashboard}
              >
                {link.label}
              </button>
            ),
          )}
        </div>
      </div>
    </footer>
  );
}
