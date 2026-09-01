import type { AmbiguityLevel } from "../types";

export const PAGE_SIZE = 12;

export const DIFFICULTY_META: Record<
  AmbiguityLevel,
  { title: string; subtitle: string }
> = {
  clear: {
    title: "Clear cases",
    subtitle: "Exact / easy fuzzy",
  },
  boundary: {
    title: "Boundary cases",
    subtitle: "At fuzzy threshold edge",
  },
  decoy: {
    title: "Decoy (correctly deferred)",
    subtitle: "Should not auto-resolve",
  },
  unresolvable: {
    title: "Unresolvable (correctly flagged)",
    subtitle: "True noise / exceptions",
  },
};

export const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: i * 0.05,
      duration: 0.35,
      ease: [0.25, 0.1, 0.25, 1] as const,
    },
  }),
};

export const pageSlide = {
  enter: (dir: number) => ({
    opacity: 0,
    x: dir >= 0 ? 32 : -32,
  }),
  center: {
    opacity: 1,
    x: 0,
    transition: {
      type: "spring" as const,
      stiffness: 440,
      damping: 36,
      mass: 0.75,
    },
  },
  exit: (dir: number) => ({
    opacity: 0,
    x: dir >= 0 ? -32 : 32,
    transition: { duration: 0.16, ease: [0.4, 0, 0.8, 0.2] as const },
  }),
};

export type DashboardTab = "exceptions" | "matches";
