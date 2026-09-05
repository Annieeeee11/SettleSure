import { useEffect, useState } from "react";
import SettleSureWordmark from "@/components/SettleSureWordmark";

function useDocumentTheme() {
  const [theme, setTheme] = useState<"light" | "dark">(() =>
    typeof document !== "undefined" &&
    document.documentElement.getAttribute("data-theme") === "dark"
      ? "dark"
      : "light",
  );

  useEffect(() => {
    const read = () =>
      setTheme(
        document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light",
      );
    read();
    const observer = new MutationObserver(read);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    return () => observer.disconnect();
  }, []);

  return theme;
}

export function Arrow({ down = false }: { down?: boolean }) {
  return <span aria-hidden="true">{down ? "↓" : "↗"}</span>;
}

export function NavBrand() {
  const theme = useDocumentTheme();

  return (
    <button
      type="button"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      aria-label="SettleSure home"
      className="inline-flex shrink-0 items-center"
    >
      <SettleSureWordmark
        variant={theme === "dark" ? "light" : "dark"}
        size="sm"
        showTagline={false}
        className="origin-center scale-[0.58] sm:scale-[0.64]"
      />
    </button>
  );
}

export function Brand({ light = false }: { light?: boolean }) {
  return (
    <button
      type="button"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      aria-label="SettleSure home"
      className="inline-flex items-center"
    >
      <SettleSureWordmark variant={light ? "light" : "dark"} size="sm" />
    </button>
  );
}

export const NAV_ICON_BUTTON = "landing-btn landing-btn-secondary inline-grid size-10 place-items-center";

export function GitHubNavButton({ href }: { href: string }) {
  return (
    <button
      type="button"
      onClick={() => window.open(href, "_blank", "noopener,noreferrer")}
      aria-label="Star SettleSure on GitHub"
      className="landing-btn landing-btn-secondary inline-flex h-10 items-center gap-2 px-3.5 text-[13px] font-medium max-[420px]:px-2.5"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M12 .3C5.37.3 0 5.67 0 12.3c0 5.3 3.44 9.8 8.21 11.39.6.11.82-.26.82-.58 0-.28-.01-1.03-.02-2.02-3.34.73-4.04-1.61-4.04-1.61-.55-1.39-1.34-1.76-1.34-1.76-1.09-.75.08-.73.08-.73 1.21.08 1.85 1.24 1.85 1.24 1.07 1.84 2.81 1.31 3.5 1 .11-.77.42-1.31.76-1.61-2.67-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.12-.3-.54-1.52.12-3.18 0 0 1.01-.32 3.3 1.23a11.5 11.5 0 0 1 6 0c2.29-1.55 3.3-1.23 3.3-1.23.66 1.66.24 2.88.12 3.18.77.84 1.24 1.91 1.24 3.22 0 4.61-2.81 5.62-5.49 5.92.43.37.81 1.1.81 2.22 0 1.61-.01 2.9-.01 3.3 0 .32.22.7.82.58A12.01 12.01 0 0 0 24 12.3C24 5.67 18.63.3 12 .3Z" />
      </svg>
<span className="max-[420px]:hidden">GitHub</span>
    </button>
  );
}

export function XNavButton({ href, className = NAV_ICON_BUTTON }: { href: string; className?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.open(href, "_blank", "noopener,noreferrer")}
      aria-label="SettleSure on X"
      className={className}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.727-8.835L1.254 2.25H8.08l4.253 5.622L18.244 2.25Zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77Z" />
      </svg>
    </button>
  );
}
