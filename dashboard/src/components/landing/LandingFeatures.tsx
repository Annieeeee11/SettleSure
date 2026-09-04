import { FEATURES, FEATURES_SECTION } from "@/lib/landingContent";
import SectionCards from "./SectionCards";
import SectionHead from "./SectionHead";

export default function LandingFeatures() {
  return (
    <section id="features" className="mx-auto max-w-[1200px] px-6">
      <SectionHead
        eyebrow={FEATURES_SECTION.eyebrow}
        title={FEATURES_SECTION.title}
        desc={FEATURES_SECTION.desc}
      />
      <SectionCards items={FEATURES} />
    </section>
  );
}
