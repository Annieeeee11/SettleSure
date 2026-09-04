import { motion } from "framer-motion";
import { SPRING_SNAPPY } from "./landingMotion";

export type PreviewTab = "cli" | "dashboard";

interface Props {
  preview: PreviewTab;
  onChange: (tab: PreviewTab) => void;
}

export default function PreviewTabs({ preview, onChange }: Props) {
  return (
    <div className="relative inline-flex rounded-full bg-[var(--surface-inset)] p-[3px] shadow-[var(--shadow-inset-sm)]">
      {(["cli", "dashboard"] as const).map((tab) => {
        const active = preview === tab;
        return (
          <button
            key={tab}
            type="button"
            className={`relative h-8 rounded-full px-4 text-xs font-semibold capitalize ${
              active
                ? "text-[var(--text)]"
                : "text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
            }`}
            onClick={() => onChange(tab)}
          >
            {active ? (
              <motion.span
                layoutId="preview-tab-pill"
                className="absolute inset-0 rounded-full bg-[var(--surface)] shadow-[var(--shadow-raised-sm)]"
                transition={SPRING_SNAPPY}
              />
            ) : null}
            <span className="relative z-10">{tab}</span>
          </button>
        );
      })}
    </div>
  );
}
