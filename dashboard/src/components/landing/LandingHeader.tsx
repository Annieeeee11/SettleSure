import { motion } from "framer-motion";
import SettleSureWordmark from "@/components/SettleSureWordmark";
import CornerActions from "@/components/CornerActions";
import { goToDashboard } from "@/hooks/useRoute";
import { NAV_LINKS } from "@/lib/landingContent";
import { SPRING_IN } from "./landingMotion";

export default function LandingHeader() {
  return (
    <motion.header
      className="sticky top-0 z-50 grid grid-cols-[1fr_auto] items-center gap-4 border-b border-[var(--surface-divider)] bg-[var(--bg)]/90 px-6 py-3.5 backdrop-blur-md md:grid-cols-[1fr_auto_1fr]"
      initial={{ opacity: 0, y: -16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={SPRING_IN}
    >
      <a className="inline-flex items-center" href="/" aria-label="SettleSure home">
        <SettleSureWordmark variant="dark" size="sm" />
      </a>
      <nav
        className="hidden items-center justify-center gap-6 md:flex"
        aria-label="Landing"
      >
        {NAV_LINKS.map((link, i) => (
          <motion.a
            key={link.href}
            href={link.href}
            className="text-[0.8125rem] font-medium text-[var(--text-secondary)] hover:text-[var(--text)]"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...SPRING_IN, delay: 0.08 + i * 0.05 }}
          >
            {link.label}
          </motion.a>
        ))}
      </nav>
      <div className="flex items-center justify-end gap-2 md:col-start-3">
        <motion.button
          type="button"
          className="h-9 rounded-full bg-[var(--surface)] px-3.5 text-[0.8125rem] font-medium text-[var(--text-secondary)] shadow-[var(--shadow-raised-sm)] hover:text-[var(--text)]"
          onClick={goToDashboard}
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...SPRING_IN, delay: 0.2 }}
          whileHover={{ y: -1 }}
          whileTap={{ scale: 0.98 }}
        >
          Dashboard
        </motion.button>
        <CornerActions layout="inline" />
      </div>
    </motion.header>
  );
}
