import { useLayoutEffect, useRef, useState, type RefObject } from "react";
import {
  motion,
  useReducedMotion,
  useScroll,
  useTransform,
  type MotionValue,
} from "framer-motion";
import PipelineVisual from "@/components/landing/PipelineVisual";
import type { PipelineVisualKind } from "@/lib/landingContent";
import { DarkGradientBg } from "./DarkGradientBg";
import { walkthrough } from "./content";

const CARD_COUNT = walkthrough.length;

const CARD_SHELL =
  "landing-card relative grid w-full max-w-[1040px] origin-top shadow-[var(--landing-card-shadow)] md:min-h-[480px] md:grid-cols-[minmax(0,42%)_minmax(0,58%)] md:items-stretch";

function findScroller(el: HTMLElement): HTMLElement | undefined {
  let node = el.parentElement;
  while (node) {
    if (node.hasAttribute("data-lenis-prevent")) return node;
    const oy = getComputedStyle(node).overflowY;
    if (
      (oy === "auto" || oy === "scroll") &&
      node.scrollHeight > node.clientHeight
    ) {
      return node;
    }
    node = node.parentElement;
  }
  return undefined;
}

type WalkthroughItem = (typeof walkthrough)[number];

function WalkthroughCardVisual({ kind }: { kind: PipelineVisualKind }) {
  return (
    <DarkGradientBg className="relative h-full min-h-[280px] w-full md:min-h-0">
      <div className="flex h-full w-full items-center justify-center p-4 md:p-5 lg:p-6">
        <div
          className={`w-[min(94%,460px)] ${
            kind === "human"
              ? "rounded-landing-btn border border-white/12 bg-[var(--bg-elevated)] shadow-[0_18px_44px_rgba(0,0,0,.42)]"
              : "shadow-[0_18px_44px_rgba(0,0,0,.42)]"
          }`}
          data-theme={kind === "human" ? "light" : undefined}
        >
          <PipelineVisual kind={kind} compact />
        </div>
      </div>
    </DarkGradientBg>
  );
}

function WalkthroughCardBody({
  item,
  index,
}: {
  item: WalkthroughItem;
  index: number;
}) {
  return (
    <>
      <div className="flex h-full flex-col justify-center px-6 py-7 max-[900px]:px-5 max-[900px]:py-6 md:px-8 md:py-8">
        <p className="font-mono text-[10px] font-bold uppercase tracking-[.14em] text-[var(--landing-accent)]">
          {String(index + 1).padStart(2, "0")} · {item.step}
        </p>
        <h3 className="mt-2.5 text-[clamp(19px,2vw,24px)] font-bold leading-[1.12] tracking-[-.03em] text-[var(--text)]">
          {item.title}
        </h3>
        <p className="mt-2.5 text-[13px] font-medium leading-[1.55] text-[var(--text-secondary)]">
          {item.copy}
        </p>
      </div>

      <WalkthroughCardVisual kind={item.visual} />
    </>
  );
}

type AnimatedCardProps = {
  item: WalkthroughItem;
  index: number;
  progress: MotionValue<number>;
};

function AnimatedCard({ item, index, progress }: AnimatedCardProps) {
  const targetScale = 1 - (CARD_COUNT - index) * 0.05;
  const rangeStart = index * (1 / CARD_COUNT);
  const scale = useTransform(progress, [rangeStart, 1], [1, targetScale]);

  return (
    <div
      className="sticky top-0 flex h-[72vh] min-h-[480px] items-center justify-center px-4 py-6 max-[900px]:static max-[900px]:h-auto max-[900px]:min-h-0 max-[900px]:px-5 max-[900px]:py-0"
      style={{ zIndex: index + 1 }}
    >
      <motion.article
        style={{
          scale,
          top: `calc(-3vh + ${index * 16}px)`,
        }}
        className={`${CARD_SHELL} max-[900px]:top-0 max-[900px]:scale-100 max-[900px]:shadow-[var(--landing-card-shadow-sm)]`}
      >
        <WalkthroughCardBody item={item} index={index} />
      </motion.article>
    </div>
  );
}

function CardStack({ scroller }: { scroller: HTMLElement | null }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<HTMLElement | null>(scroller);
  scrollerRef.current = scroller;

  const { scrollYProgress } = useScroll({
    ...(scroller
      ? { container: scrollerRef as RefObject<HTMLElement> }
      : {}),
    target: containerRef,
    offset: ["start start", "end end"],
  });

  return (
    <div ref={containerRef} className="relative">
      {walkthrough.map((item, index) => (
        <AnimatedCard
          key={item.step}
          item={item}
          index={index}
          progress={scrollYProgress}
        />
      ))}
    </div>
  );
}

function StaticCards() {
  return (
    <div className="flex flex-col gap-5 max-[900px]:gap-4">
      {walkthrough.map((item, index) => (
        <article key={item.step} className={CARD_SHELL}>
          <WalkthroughCardBody item={item} index={index} />
        </article>
      ))}
    </div>
  );
}

export default function StackingCardsParallax() {
  const reduce = useReducedMotion();
  const rootRef = useRef<HTMLDivElement>(null);
  const [scroller, setScroller] = useState<HTMLElement | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  useLayoutEffect(() => {
    if (!rootRef.current) return;
    setScroller(findScroller(rootRef.current) ?? null);

    const mq = window.matchMedia("(max-width: 900px)");
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  const useStaticStack = reduce || isMobile;

  return (
    <section id="workflow" className="landing-section">
      <div className="mx-auto max-w-[1180px] px-[max(24px,6vw)] pt-12 max-[900px]:px-5 max-[900px]:pt-10">
        <div className="sc-reveal mb-14 max-w-[720px] max-[900px]:mb-10">
          <span className="font-mono text-[11px] tracking-[.14em] text-[var(--landing-accent)]">
            THE SETTLESURE CONTROL LOOP
          </span>
          <h2 className="mt-5 text-[clamp(36px,4.8vw,62px)] font-normal leading-[1.02] tracking-[-.055em]">
            From three raw files
            <br />
            to one defensible close.
          </h2>
          <p className="mt-5 max-w-[540px] text-[16px] leading-relaxed text-[var(--text-secondary)]">
            Deterministic tiers clear unambiguous matches first. Ambiguity defers. Humans release with a full audit trail.
          </p>
        </div>
      </div>

      <div ref={rootRef} className="relative w-full pb-[max(64px,8vh)] max-[900px]:px-5 max-[900px]:pb-16">
        {useStaticStack ? (
          <div className="mx-auto max-w-[1040px] px-[max(24px,6vw)] max-[900px]:px-0">
            <StaticCards />
          </div>
        ) : (
          <CardStack scroller={scroller} />
        )}
      </div>
    </section>
  );
}
