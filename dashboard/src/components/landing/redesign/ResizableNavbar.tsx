import { cn } from "@/lib/utils";
import {
  motion,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
} from "framer-motion";
import { createContext, useContext, useState, type ReactNode } from "react";

interface NavbarProps {
  children: ReactNode;
  className?: string;
  scrollThreshold?: number;
}

interface NavBodyProps {
  children: ReactNode;
  className?: string;
}

const NavbarScrollContext = createContext(false);

export function Navbar({
  children,
  className,
  scrollThreshold = 48,
}: NavbarProps) {
  const { scrollY } = useScroll();
  const [isCompact, setIsCompact] = useState(false);

  useMotionValueEvent(scrollY, "change", (latest) => {
    setIsCompact(latest > scrollThreshold);
  });

  return (
    <NavbarScrollContext.Provider value={isCompact}>
      <div
        className={cn(
          "pointer-events-none fixed inset-x-0 top-0 z-[200] w-full px-[max(16px,4vw)] pt-3 max-[700px]:pt-2",
          className,
        )}
      >
        {children}
      </div>
    </NavbarScrollContext.Provider>
  );
}

export function NavBody({ children, className }: NavBodyProps) {
  const isCompact = useContext(NavbarScrollContext);
  const reduceMotion = useReducedMotion();

  return (
    <motion.nav
      aria-label="Primary navigation"
      initial={false}
      animate={{
        maxWidth: isCompact ? 720 : 1180,
        paddingLeft: isCompact ? 18 : 28,
        paddingRight: isCompact ? 18 : 28,
        paddingTop: isCompact ? 7 : 10,
        paddingBottom: isCompact ? 7 : 10,
      }}
      transition={
        reduceMotion
          ? { duration: 0 }
          : { duration: 0.28, ease: [0.22, 1, 0.36, 1] }
      }
      className={cn(
        "pointer-events-auto relative mx-auto flex w-full flex-row items-center justify-between rounded-full border transition-[background-color,border-color,box-shadow,backdrop-filter] duration-300",
        isCompact
          ? "landing-nav-body-visible border-[color-mix(in_srgb,var(--text)_10%,transparent)] bg-[color-mix(in_srgb,var(--bg)_82%,transparent)] shadow-[0_12px_36px_rgba(0,0,0,0.14)] backdrop-blur-xl"
          : "border-transparent bg-transparent shadow-none",
        className,
      )}
    >
      {children}
    </motion.nav>
  );
}
