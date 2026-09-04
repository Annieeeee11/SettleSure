import {
  AnimatePresence,
  motion,
  useReducedMotion,
} from "framer-motion";
import { useState } from "react";
import type { FAQS } from "@/lib/landingContent";

type FaqItem = (typeof FAQS)[number];

const OPEN_SPRING = { type: "spring", visualDuration: 0.42, bounce: 0.2 } as const;
const CLOSE_SPRING = { type: "spring", visualDuration: 0.4, bounce: 0 } as const;
const ICON_SPRING = { type: "spring", visualDuration: 0.3, bounce: 0.25 } as const;

function FaqRow({
  q,
  a,
  active,
  onActivate,
  reduce,
}: {
  q: string;
  a: string;
  active: boolean;
  onActivate: () => void;
  reduce: boolean | null;
}) {
  return (
    <div
      onMouseEnter={onActivate}
      className="block w-full min-h-[3.75rem] rounded-2xl border border-[var(--card-border)] bg-[var(--surface)] px-6 py-4 shadow-[var(--shadow-raised-sm)] sm:min-h-[4rem] sm:px-7 sm:py-5"
    >
      <div className="flex w-full items-center justify-between gap-4">
        <span className="text-[15px] font-medium leading-snug text-[var(--text)] sm:text-base">
          {q}
        </span>
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
            <p className="pt-2.5 text-sm leading-relaxed text-[var(--text-secondary)]">
              {a}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

interface Props {
  items: ReadonlyArray<FaqItem>;
}

export default function FisheyeFaq({ items }: Props) {
  const reduce = useReducedMotion();
  const [active, setActive] = useState<number | null>(null);

  return (
    <div
      onMouseLeave={() => setActive(null)}
      className="flex w-full min-w-0 flex-col gap-3"
    >
      {items.map((faq, i) => (
        <FaqRow
          key={faq.q}
          q={faq.q}
          a={faq.a}
          active={active === i}
          onActivate={() => setActive(i)}
          reduce={reduce}
        />
      ))}
    </div>
  );
}
