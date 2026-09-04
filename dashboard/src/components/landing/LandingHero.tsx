import LandingStrip from "./LandingStrip";

export default function LandingHero() {
  return (
    <section aria-label="SettleSure tagline">
      <div className="pl-[clamp(0.25rem,1.5vw,1rem)]">
        <h1 className="m-0 flex flex-col font-landing-serif text-[clamp(2.5rem,12vw,4.5rem)] font-light uppercase leading-[0.94] tracking-[-0.02em] md:text-[clamp(3.25rem,9.2vw,7.25rem)] md:leading-[0.92]">
          <span className="block text-landing-light">THE NUMBERS</span>
          <span className="block text-landing-light">CLOSE.</span>
          <span className="block text-landing-dim">OR THEY DON&apos;T.</span>
        </h1>
      </div>
      <LandingStrip />
    </section>
  );
}
