import LandingFooterBottom from "./LandingFooterBottom";
import LandingFooterReceipt from "./LandingFooterReceipt";

export default function LandingFooter() {
  return (
    <footer className="mt-[clamp(1.25rem,3vh,2rem)] pb-[clamp(1.25rem,2.5vw,2rem)]">
      <LandingFooterReceipt />
      <div className="mt-2 px-[clamp(1.25rem,2.5vw,2rem)]">
        <LandingFooterBottom />
      </div>
    </footer>
  );
}
