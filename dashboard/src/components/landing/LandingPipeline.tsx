import { PIPELINE } from "@/lib/landingContent";
import AlternatingFeature from "./AlternatingFeature";

export default function LandingPipeline() {
  return (
    <section id="pipeline" className="mx-auto max-w-[1200px] px-6">
      {PIPELINE.showcases.map((item, index) => (
        <AlternatingFeature
          key={item.id}
          item={item}
          reverse={index % 2 === 1}
        />
      ))}
    </section>
  );
}
