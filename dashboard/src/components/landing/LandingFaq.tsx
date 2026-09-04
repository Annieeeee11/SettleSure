import { FAQ_SECTION, FAQS } from "@/lib/landingContent";
import FisheyeFaq from "./FisheyeFaq";
import { Reveal } from "./Reveal";

export default function LandingFaq() {
  return (
    <section
      id="faq"
      className="mx-auto grid w-full max-w-[1200px] grid-cols-1 gap-10 px-6 md:grid-cols-[minmax(0,17rem)_minmax(0,1fr)] md:gap-14 lg:gap-20"
    >
      <Reveal direction="left" className="min-w-0">
        <h2 className="text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl md:sticky md:top-24">
          {FAQ_SECTION.title[0]}
          <br />
          {FAQ_SECTION.title[1]}
        </h2>
      </Reveal>
      <Reveal direction="right" className="min-w-0 w-full" delay={0.06}>
        <FisheyeFaq items={FAQS} />
      </Reveal>
    </section>
  );
}
