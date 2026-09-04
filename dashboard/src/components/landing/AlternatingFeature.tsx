import { motion, useReducedMotion } from "framer-motion";
import type { PipelineShowcase } from "@/lib/landingContent";
import PipelineVisual from "./PipelineVisual";
import {
  slideFromLeft,
  slideFromRight,
  reducedFade,
  VIEWPORT,
} from "./landingMotion";

interface Props {
  item: PipelineShowcase;
  reverse?: boolean;
}

export default function AlternatingFeature({ item, reverse = false }: Props) {
  const reduce = useReducedMotion();

  const copy = (
    <motion.div
      className="max-w-md"
      initial="hidden"
      whileInView="visible"
      viewport={VIEWPORT}
      variants={
        reduce
          ? reducedFade
          : reverse
            ? slideFromRight
            : slideFromLeft
      }
    >
      <p className="font-mono text-[0.6875rem] font-semibold uppercase tracking-widest text-orange-500">
        {item.eyebrow}
      </p>
      <h3 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">
        {item.title}
      </h3>
      <p className="mt-4 text-[0.9375rem] leading-relaxed text-[var(--text-secondary)]">
        {item.desc}
      </p>
    </motion.div>
  );

  const visual = (
    <motion.div
      className="w-full min-w-0"
      initial="hidden"
      whileInView="visible"
      viewport={VIEWPORT}
      variants={reduce ? reducedFade : reverse ? slideFromLeft : slideFromRight}
    >
      <PipelineVisual kind={item.visual} />
    </motion.div>
  );

  return (
    <div className="grid items-center gap-10 py-14 md:grid-cols-2 md:gap-14 lg:gap-20 lg:py-20">
      {reverse ? (
        <>
          {visual}
          {copy}
        </>
      ) : (
        <>
          {copy}
          {visual}
        </>
      )}
    </div>
  );
}
