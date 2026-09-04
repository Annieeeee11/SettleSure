export type PreviewTab = "cli" | "dashboard";

interface Props {
  preview: PreviewTab;
  onChange: (tab: PreviewTab) => void;
}

export default function PreviewTabs({ preview, onChange }: Props) {
  return (
    <div className="inline-flex rounded-full bg-[var(--surface-inset)] p-[3px] shadow-[var(--shadow-inset-sm)]">
      {(["cli", "dashboard"] as const).map((tab) => (
        <button
          key={tab}
          type="button"
          className={`h-8 rounded-full px-4 text-xs font-semibold capitalize transition ${
            preview === tab
              ? "bg-[var(--surface)] text-[var(--text)] shadow-[var(--shadow-raised-sm)]"
              : "text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
          }`}
          onClick={() => onChange(tab)}
        >
          {tab}
        </button>
      ))}
    </div>
  );
}
