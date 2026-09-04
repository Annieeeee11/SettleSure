import type { Transition, Variants } from "framer-motion";

export const VIEWPORT = {
  once: true,
  margin: "-72px 0px -72px 0px",
} as const;

export const SPRING_IN: Transition = {
  type: "spring",
  stiffness: 110,
  damping: 22,
  mass: 0.85,
};

export const SPRING_SNAPPY: Transition = {
  type: "spring",
  stiffness: 420,
  damping: 32,
  mass: 0.6,
};

export const TWEEN_OUT: Transition = {
  duration: 0.22,
  ease: [0.4, 0, 0.2, 1],
};

export const heroContainer: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.11,
      delayChildren: 0.04,
    },
  },
};

export const heroItem: Variants = {
  hidden: { opacity: 0, y: 28, filter: "blur(10px)" },
  visible: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: SPRING_IN,
  },
};

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 32, filter: "blur(8px)" },
  visible: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: SPRING_IN,
  },
};

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.45 } },
};

export const scaleIn: Variants = {
  hidden: { opacity: 0, y: 24, scale: 0.94, filter: "blur(6px)" },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    filter: "blur(0px)",
    transition: SPRING_IN,
  },
};

export const slideFromLeft: Variants = {
  hidden: { opacity: 0, x: -48, filter: "blur(6px)" },
  visible: {
    opacity: 1,
    x: 0,
    filter: "blur(0px)",
    transition: SPRING_IN,
  },
};

export const slideFromRight: Variants = {
  hidden: { opacity: 0, x: 48, filter: "blur(6px)" },
  visible: {
    opacity: 1,
    x: 0,
    filter: "blur(0px)",
    transition: SPRING_IN,
  },
};

export const staggerContainer: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.09,
      delayChildren: 0.06,
    },
  },
};

export const staggerItem: Variants = {
  hidden: { opacity: 0, y: 22, filter: "blur(6px)" },
  visible: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: SPRING_IN,
  },
};

export const previewSwap: Variants = {
  enter: { opacity: 0, y: 14, scale: 0.985, filter: "blur(4px)" },
  center: {
    opacity: 1,
    y: 0,
    scale: 1,
    filter: "blur(0px)",
    transition: SPRING_IN,
  },
  exit: {
    opacity: 0,
    y: -10,
    scale: 0.985,
    filter: "blur(4px)",
    transition: TWEEN_OUT,
  },
};

export const reducedFade: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.2 } },
};
