import LandingHeader from "../components/landing/LandingHeader";
import LandingHero from "../components/landing/LandingHero";
import LandingSystemsSection from "../components/landing/LandingSystemsSection";
import LandingReconciliationSection from "../components/landing/LandingReconciliationSection";
import LandingFooter from "../components/landing/LandingFooter";

export default function LandingPage() {
  return (
    <main className="min-h-dvh w-full overflow-x-hidden bg-landing-bg text-landing-light">
      <div className="flex w-full flex-col gap-[clamp(2.5rem,7vh,4.5rem)] p-[clamp(1.25rem,2.5vw,2rem)] md:gap-[clamp(3rem,8vh,5rem)]">
        <LandingHeader />
        <LandingHero />
        <LandingSystemsSection />
      </div>
      <LandingReconciliationSection />
      <LandingFooter />
    </main>
  );
}
