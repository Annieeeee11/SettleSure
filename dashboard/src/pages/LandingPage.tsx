import { useRef } from "react";
import { ControlsSection, CtaSection } from "@/components/landing/redesign/ClosingSections";
import DepthStory from "@/components/landing/redesign/DepthStory";
import FaqSection from "@/components/landing/redesign/FaqSection";
import Hero from "@/components/landing/redesign/Hero";
import SocialSignals from "@/components/landing/redesign/SocialSignals";
import StackingCardsParallax from "@/components/landing/redesign/StackingCardsParallax";
import { useLandingAnimations } from "@/components/landing/redesign/useLandingAnimations";

export default function LandingPage() {
  const root = useRef<HTMLDivElement>(null);
  useLandingAnimations(root);

  return (
    <div ref={root} id="top" className="landing-page min-h-screen bg-[var(--bg)] font-sans text-[var(--text)]">
      <main>
        <Hero />
        <DepthStory />
        <StackingCardsParallax />
        <SocialSignals />
        <ControlsSection />
        <FaqSection />
        <CtaSection />
      </main>
    </div>
  );
}
