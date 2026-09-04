import { FAQ_SECTION, FAQS } from "@/lib/landingContent";
import FisheyeFaq from "./FisheyeFaq";

export default function LandingFaq() {
  return (
    <section
      id="faq"
      className="mx-auto grid max-w-[1200px] gap-10 px-6 md:grid-cols-[minmax(0,0.78fr)_minmax(0,1.22fr)] md:gap-14"
    >
      <div className="md:self-start">
        <h2 className="text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl md:sticky md:top-24">
          {FAQ_SECTION.title[0]}
          <br />
          {FAQ_SECTION.title[1]}
        </h2>
      </div>
      <FisheyeFaq items={FAQS} />
    </section>
  );
}
