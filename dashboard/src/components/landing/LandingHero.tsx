import { motion } from "framer-motion";
import { goToDashboard } from "@/hooks/useRoute";
import { HERO, REPO_URL } from "@/lib/landingContent";

export default function LandingHero() {
  return (
    <section className="mx-auto max-w-[720px] px-6 pt-12 text-center sm:pt-20">
      <motion.p
        className="mb-4 font-mono text-[0.6875rem] font-medium uppercase tracking-widest text-[var(--text-tertiary)]"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        {HERO.eyebrow}
      </motion.p>
      <motion.h1
        className="mb-4 text-4xl font-semibold leading-[1.08] tracking-tight sm:text-5xl"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: 0.05 }}
      >
        {HERO.title[0]}
        <br />
        {HERO.title[1]}
      </motion.h1>
      <motion.p
        className="mx-auto mb-7 max-w-xl text-base leading-relaxed text-[var(--text-secondary)]"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: 0.1 }}
      >
        {HERO.lead}
      </motion.p>
      <motion.div
        className="mb-6 flex flex-wrap items-center justify-center gap-2.5"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: 0.15 }}
      >
        <button
          type="button"
          className="h-10 rounded-full bg-[var(--text)] px-4 text-[0.8125rem] font-medium text-[var(--bg)] shadow-[var(--shadow-raised-sm)] hover:shadow-[var(--shadow-raised-hover)]"
          onClick={goToDashboard}
        >
          Open Dashboard
        </button>
        <a
          className="inline-flex h-10 items-center rounded-full bg-[var(--surface)] px-4 text-[0.8125rem] font-medium shadow-[var(--shadow-raised-sm)] hover:shadow-[var(--shadow-raised-hover)]"
          href={REPO_URL}
          target="_blank"
          rel="noopener noreferrer"
        >
          Clone from GitHub
        </a>
      </motion.div>
    </section>
  );
}
