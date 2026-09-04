import { motion, useReducedMotion, type Variants } from "framer-motion";
import type { ReactNode } from "react";
import {
  fadeUp,
  reducedFade,
  slideFromLeft,
  slideFromRight,
  scaleIn,
  staggerContainer,
  staggerItem,
  VIEWPORT,
} from "./landingMotion";

type Direction = "up" | "left" | "right" | "scale";

const VARIANTS: Record<Direction, Variants> = {
  up: fadeUp,
  left: slideFromLeft,
  right: slideFromRight,
  scale: scaleIn,
};

interface RevealProps {
  children: ReactNode;
  className?: string;
  direction?: Direction;
  delay?: number;
  as?: "div" | "section" | "article";
}

export function Reveal({
  children,
  className,
  direction = "up",
  delay = 0,
  as = "div",
}: RevealProps) {
  const reduce = useReducedMotion();
  const Component = motion[as];

  return (
    <Component
      className={className}
      initial="hidden"
      whileInView="visible"
      viewport={VIEWPORT}
      variants={reduce ? reducedFade : VARIANTS[direction]}
      transition={delay ? { delay } : undefined}
    >
      {children}
    </Component>
  );
}

interface StaggerProps {
  children: ReactNode;
  className?: string;
  as?: "div" | "section" | "ul";
}

export function Stagger({ children, className, as = "div" }: StaggerProps) {
  const reduce = useReducedMotion();
  const Component = motion[as];

  return (
    <Component
      className={className}
      initial="hidden"
      whileInView="visible"
      viewport={VIEWPORT}
      variants={reduce ? reducedFade : staggerContainer}
    >
      {children}
    </Component>
  );
}

export function StaggerItem({
  children,
  className,
  as = "div",
}: {
  children: ReactNode;
  className?: string;
  as?: "div" | "li" | "article";
}) {
  const reduce = useReducedMotion();
  const Component = motion[as];

  return (
    <Component
      className={className}
      variants={reduce ? reducedFade : staggerItem}
    >
      {children}
    </Component>
  );
}
