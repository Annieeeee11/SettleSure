import { motion, useReducedMotion } from "framer-motion";
import { goToDashboard } from "@/hooks/useRoute";
import { HERO, REPO_URL } from "@/lib/landingContent";
import { heroContainer, heroItem, reducedFade } from "./landingMotion";

export default function LandingHero() {
  const reduce = useReducedMotion();

  return (
    <motion.section
      className="mx-auto max-w-[720px] px-6 pt-12 text-center sm:pt-20"
      initial="hidden"
      animate="visible"
      variants={reduce ? reducedFade : heroContainer}
    >
      <motion.p
        className="mb-4 font-mono text-[0.6875rem] font-medium uppercase tracking-widest text-[var(--text-tertiary)]"
        variants={reduce ? reducedFade : heroItem}
      >
        {HERO.eyebrow}
      </motion.p>
      <motion.h1
        className="mb-4 text-4xl font-semibold leading-[1.08] tracking-tight sm:text-5xl"
        variants={reduce ? reducedFade : heroItem}
      >
        {HERO.title[0]}
        <br />
        {HERO.title[1]}
      </motion.h1>
      <motion.p
        className="mx-auto mb-7 max-w-xl text-base leading-relaxed text-[var(--text-secondary)]"
        variants={reduce ? reducedFade : heroItem}
      >
        {HERO.lead}
      </motion.p>
      <motion.div
        className="flex flex-wrap items-center justify-center gap-2.5"
        variants={reduce ? reducedFade : heroItem}
      >
        <motion.button
          type="button"
          className="h-10 rounded-full bg-[var(--text)] px-4 text-[0.8125rem] font-medium text-[var(--bg)] shadow-[var(--shadow-raised-sm)]"
          onClick={goToDashboard}
          whileHover={{ y: -2, scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          transition={{ type: "spring", stiffness: 420, damping: 28 }}
        >
          Open Dashboard
        </motion.button>
        <motion.a
          className="inline-flex h-10 items-center rounded-full bg-[var(--surface)] px-4 text-[0.8125rem] font-medium shadow-[var(--shadow-raised-sm)]"
          href={REPO_URL}
          target="_blank"
          rel="noopener noreferrer"
          whileHover={{ y: -2, scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          transition={{ type: "spring", stiffness: 420, damping: 28 }}
        >
          Clone from GitHub
        </motion.a>
      </motion.div>
    </motion.section>
  );
}
