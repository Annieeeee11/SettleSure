import { motion } from "framer-motion";
import { goToDashboard } from "@/hooks/useRoute";
import { CTA, REPO_URL } from "@/lib/landingContent";
import { SPRING_SNAPPY } from "./landingMotion";
import { Reveal } from "./Reveal";

export default function LandingCta() {
  return (
    <Reveal direction="scale">
      <section className="mx-auto flex max-w-2xl flex-row items-center justify-between gap-4 rounded-2xl bg-[var(--surface)] px-5 py-5 shadow-[var(--shadow-raised-sm)]">
        <div className="min-w-0">
          <h2 className="mb-0.5 text-lg font-semibold tracking-tight">
            {CTA.title}
          </h2>
          <p className="text-[0.8125rem] text-[var(--text-secondary)]">
            {CTA.desc}
          </p>
        </div>
        <div className="flex shrink-0 flex-row gap-2">
          <motion.button
            type="button"
            className="h-9 rounded-full bg-[var(--text)] px-3.5 text-xs font-medium text-[var(--bg)] shadow-[var(--shadow-raised-sm)]"
            onClick={goToDashboard}
            whileHover={{ y: -2, scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            transition={SPRING_SNAPPY}
          >
            {CTA.primaryLabel}
          </motion.button>
          <motion.a
            className="inline-flex h-9 items-center rounded-full bg-[var(--surface)] px-3.5 text-xs font-medium shadow-[var(--shadow-raised-sm)]"
            href={`${REPO_URL}#quick-start`}
            target="_blank"
            rel="noopener noreferrer"
            whileHover={{ y: -2, scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            transition={SPRING_SNAPPY}
          >
            {CTA.secondaryLabel}
          </motion.a>
        </div>
      </section>
    </Reveal>
  );
}
