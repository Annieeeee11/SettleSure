import {
  AnimatePresence,
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
  type MotionValue,
} from "framer-motion";
import { useEffect, useRef, useState } from "react";
import type { FAQS } from "@/lib/landingContent";

type FaqItem = (typeof FAQS)[number];

const RANGE = 110;
const MAX_SCALE = 1.08;
const TRACK_SPRING = { stiffness: 260, damping: 26, mass: 0.6 } as const;
const OPEN_SPRING = { type: "spring", visualDuration: 0.42, bounce: 0.2 } as const;
const CLOSE_SPRING = { type: "spring", visualDuration: 0.4, bounce: 0 } as const;
const ICON_SPRING = { type: "spring", visualDuration: 0.3, bounce: 0.25 } as const;

function FaqRow({
  index,
  q,
  a,
  pointerY,
  centers,
  active,
  onActivate,
  registerRef,
  reduce,
}: {
  index: number;
  q: string;
  a: string;
  pointerY: MotionValue<number>;
  centers: { current: number[] };
  active: boolean;
  onActivate: () => void;
  registerRef: (el: HTMLDivElement | null) => void;
  reduce: boolean | null;
}) {
  const scaleTarget = useTransform(pointerY, (y) => {
    const c = centers.current[index];
    if (c == null || !Number.isFinite(c)) return 1;
    const t = Math.max(0, 1 - Math.abs(y - c) / RANGE);
    return 1 + t * (MAX_SCALE - 1);
  });
  const scale = useSpring(scaleTarget, TRACK_SPRING);

  return (
    <motion.div
      ref={registerRef}
      onMouseEnter={onActivate}
      onFocus={onActivate}
      tabIndex={0}
      role="button"
      aria-expanded={active}
      style={{
        scale: reduce ? 1 : scale,
        transformOrigin: "center",
        willChange: "transform",
        zIndex: active ? 2 : 1,
      }}
      className="landing-card relative min-h-[3.75rem] px-6 py-4 shadow-[var(--shadow-raised-sm)] outline-none sm:min-h-[4rem] sm:px-7 sm:py-5"
    >
      <div className="flex w-full items-center justify-between gap-4">
        <span className="text-[15px] font-medium leading-snug text-[var(--text)] sm:text-base">{q}</span>
        <motion.span
          animate={{ rotate: active ? 45 : 0 }}
          transition={ICON_SPRING}
          className="shrink-0 text-xl leading-none text-[var(--text-tertiary)]"
          aria-hidden
        >
          +
        </motion.span>
      </div>

      <AnimatePresence initial={false}>
        {active && (
          <motion.div
            key="answer"
            initial={{
              height: 0,
              opacity: 0,
              filter: reduce ? "none" : "blur(8px)",
            }}
            animate={{
              height: "auto",
              opacity: 1,
              filter: "blur(0px)",
              transition: OPEN_SPRING,
            }}
            exit={{
              height: 0,
              opacity: 0,
              filter: reduce ? "none" : "blur(8px)",
              transition: CLOSE_SPRING,
            }}
            className="overflow-hidden"
          >
            <p className="pt-2.5 text-sm leading-relaxed text-[var(--text-secondary)]">{a}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

interface Props {
  items: ReadonlyArray<FaqItem>;
}

export default function FisheyeFaq({ items }: Props) {
  const reduce = useReducedMotion();
  const pointerY = useMotionValue(-9999);
  const [active, setActive] = useState<number | null>(null);
  const rowsRef = useRef<(HTMLDivElement | null)[]>([]);
  const centers = useRef<number[]>([]);

  const measure = () => {
    centers.current = rowsRef.current.map((el) => {
      if (!el) return Infinity;
      const r = el.getBoundingClientRect();
      return r.top + r.height / 2;
    });
  };

  useEffect(() => {
    measure();
    const ro = new ResizeObserver(measure);
    rowsRef.current.forEach((el) => el && ro.observe(el));
    window.addEventListener("scroll", measure, true);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("scroll", measure, true);
      window.removeEventListener("resize", measure);
    };
  }, [items, active]);

  return (
    <div
      onMouseMove={(e) => pointerY.set(e.clientY)}
      onMouseLeave={() => {
        pointerY.set(-9999);
        setActive(null);
      }}
      className="flex w-full min-w-0 flex-col gap-3"
    >
      {items.map((faq, i) => (
        <FaqRow
          key={faq.q}
          index={i}
          q={faq.q}
          a={faq.a}
          pointerY={pointerY}
          centers={centers}
          active={active === i}
          onActivate={() => setActive(i)}
          registerRef={(el) => {
            rowsRef.current[i] = el;
          }}
          reduce={reduce}
        />
      ))}
    </div>
  );
}
