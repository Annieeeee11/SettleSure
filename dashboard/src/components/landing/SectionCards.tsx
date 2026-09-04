import { motion, useReducedMotion } from "framer-motion";
import type { SectionIconName } from "@/lib/landingContent";
import SectionIcon from "./SectionIcon";
import { SPRING_SNAPPY, staggerItem } from "./landingMotion";
import { Stagger } from "./Reveal";

interface CardItem {
  icon: SectionIconName;
  title: string;
  body: string;
}

interface Props {
  items: ReadonlyArray<CardItem>;
}

export default function SectionCards({ items }: Props) {
  const reduce = useReducedMotion();

  return (
    <Stagger className="grid gap-4 md:grid-cols-3">
      {items.map((item) => (
        <motion.article
          key={item.title}
          className="h-full rounded-xl border border-[var(--card-border)] bg-[var(--surface)] p-5"
          variants={staggerItem}
          whileHover={
            reduce
              ? undefined
              : {
                  y: -6,
                  scale: 1.01,
                  boxShadow: "var(--shadow-raised-hover)",
                }
          }
          transition={SPRING_SNAPPY}
        >
          <div className="mb-4 inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--card-border)] text-[var(--text-secondary)]">
            <SectionIcon name={item.icon} />
          </div>
          <h3 className="mb-2 text-[0.9375rem] font-semibold tracking-tight">
            {item.title}
          </h3>
          <p className="text-[0.8125rem] leading-relaxed text-[var(--text-secondary)]">
            {item.body}
          </p>
        </motion.article>
      ))}
    </Stagger>
  );
}
