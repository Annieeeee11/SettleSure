import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { PREVIEW } from "@/lib/landingContent";
import CliPreview from "./CliPreview";
import PreviewTabs, { type PreviewTab } from "./PreviewTabs";
import { previewSwap } from "./landingMotion";
import { Reveal } from "./Reveal";

export default function LandingPreview() {
  const [preview, setPreview] = useState<PreviewTab>("cli");

  return (
    <section
      className="mx-auto max-w-[1200px] px-6"
      aria-label="Product preview"
    >
      <Reveal className="mb-4 flex justify-center" direction="up">
        <PreviewTabs preview={preview} onChange={setPreview} />
      </Reveal>
      <Reveal direction="scale">
        <div className="overflow-hidden rounded-2xl shadow-[var(--shadow-inset-sm)]">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={preview}
              variants={previewSwap}
              initial="enter"
              animate="center"
              exit="exit"
            >
              {preview === "cli" ? (
                <CliPreview />
              ) : (
                <img
                  src={PREVIEW.dashboardImage}
                  alt={PREVIEW.dashboardAlt}
                  className="block w-full"
                />
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </Reveal>
      <Reveal className="mt-3.5 text-center" direction="up" delay={0.08}>
        <p className="text-[0.8125rem] text-[var(--text-tertiary)]">
          {PREVIEW.caption}
        </p>
      </Reveal>
    </section>
  );
}
