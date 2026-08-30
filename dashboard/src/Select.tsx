import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

type Option = { value: string; label: string };

export default function Select({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Option[];
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div className="select-field">
      <span className="select-label">{label}</span>
      <div className="select-wrap" ref={wrapRef}>
        <button
          type="button"
          className={`select-trigger ${open ? "open" : ""}`}
          aria-haspopup="listbox"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
        >
          {selected?.label ?? value}
          <svg
            className="select-chevron"
            width="12"
            height="12"
            viewBox="0 0 12 12"
            aria-hidden
          >
            <path
              fill="currentColor"
              d="M3 4.5L6 7.5L9 4.5"
            />
          </svg>
        </button>
        <AnimatePresence>
          {open && (
            <motion.ul
              className="select-menu"
              role="listbox"
              initial={{ opacity: 0, y: 4, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 4, scale: 0.98 }}
              transition={{ duration: 0.15, ease: [0.25, 0.1, 0.25, 1] }}
            >
              {options.map((opt) => (
                <li key={opt.value}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={opt.value === value}
                    className={`select-option ${opt.value === value ? "selected" : ""}`}
                    onClick={() => {
                      onChange(opt.value);
                      setOpen(false);
                    }}
                  >
                    {opt.label}
                  </button>
                </li>
              ))}
            </motion.ul>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
