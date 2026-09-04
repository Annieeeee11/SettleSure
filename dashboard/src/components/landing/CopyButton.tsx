import { useState } from "react";

interface Props {
  text: string;
}

export default function CopyButton({ text }: Props) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      className="shrink-0 rounded-full bg-[var(--surface)] px-3 py-1 text-[0.6875rem] font-medium text-[var(--text-secondary)] shadow-[var(--shadow-raised-sm)] hover:text-[var(--text)]"
      onClick={() => {
        void navigator.clipboard.writeText(text).then(() => {
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1600);
        });
      }}
    >
      {copied ? "Copied" : "Copy"}
    </button>
  );
}
