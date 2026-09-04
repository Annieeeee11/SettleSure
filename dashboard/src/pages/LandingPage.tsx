import LandingCta from "@/components/landing/LandingCta";
import LandingFaq from "@/components/landing/LandingFaq";
import LandingFeatures from "@/components/landing/LandingFeatures";
import LandingFooter from "@/components/landing/LandingFooter";
import LandingHeader from "@/components/landing/LandingHeader";
import LandingHero from "@/components/landing/LandingHero";
import LandingPipeline from "@/components/landing/LandingPipeline";
import LandingPreview from "@/components/landing/LandingPreview";

export default function LandingPage() {
  return (
    <div className="min-h-screen select-text bg-[var(--bg)] text-[var(--text)]">
      <LandingHeader />
      <main className="flex flex-col gap-24 pb-24 lg:gap-32 lg:pb-32">
        <LandingHero />
        <LandingPreview />
        <LandingPipeline />
        <LandingFeatures />
        <LandingFaq />
        <LandingCta />
      </main>
      <LandingFooter />
    </div>
  );
}
