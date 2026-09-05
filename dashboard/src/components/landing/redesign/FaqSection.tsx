import { FAQS } from "@/lib/landingContent";
import FisheyeFaq from "@/components/landing/FisheyeFaq";

export default function FaqSection() {
  return (
    <section
      id="faq"
      className="landing-section grid grid-cols-[minmax(260px,.75fr)_1.5fr] gap-[90px] px-[max(30px,12vw)] py-[130px] max-[900px]:grid-cols-1 max-[900px]:gap-12 max-[900px]:px-6 max-[900px]:py-[90px]"
    >
      <aside className="min-w-0 max-[900px]:contents">
        <div className="sticky top-28 max-[900px]:static">
          <span className="font-mono text-[11px] tracking-[.13em] text-[var(--landing-accent)]">FAQ</span>
          <h2 className="my-[26px] text-[clamp(44px,5.5vw,72px)] font-medium leading-[.92] tracking-[-.06em]">
            Questions?
            <br />
            Answered.
          </h2>
          <p className="max-w-[360px] text-[17px] leading-relaxed text-[var(--text-secondary)] max-[520px]:text-[15px]">
            Start with the product workflow, then inspect the engine and benchmark in the open-source repository.
          </p>
        </div>
      </aside>
      <div className="min-w-0 w-full">
        <FisheyeFaq items={FAQS} />
      </div>
    </section>
  );
}
