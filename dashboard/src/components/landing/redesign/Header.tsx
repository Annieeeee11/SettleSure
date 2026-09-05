import ThemeToggle from "@/ThemeToggle";
import { goToDashboard } from "@/hooks/useRoute";
import { twitterUrl } from "./content";
import { NavBrand, XNavButton } from "./Shared";
import { NavBody, Navbar } from "./ResizableNavbar";

const NAV_BTN = "landing-nav-btn";

export default function Header() {
  return (
    <header className="h-13" aria-label="Site header">
      <Navbar>
        <NavBody>
          <button
            type="button"
            onClick={goToDashboard}
            className="landing-btn landing-btn-primary h-9 px-4 text-[13px] font-medium"
          >
            Reconcile Now
          </button>
          <div className="absolute left-1/2 -translate-x-1/2">
            <NavBrand />
          </div>
          <div className="landing-nav-actions ml-auto">
            <ThemeToggle className={NAV_BTN} />
            <XNavButton href={twitterUrl} className={NAV_BTN} />
          </div>
        </NavBody>
      </Navbar>
    </header>
  );
}
