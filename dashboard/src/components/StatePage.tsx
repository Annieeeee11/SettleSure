import { motion } from "framer-motion";
import type { ReactNode } from "react";

export default function StatePage({
  icon,
  title,
  message,
  action,
  hint,
}: {
  icon: "error" | "loading";
  title: string;
  message: string;
  action?: ReactNode;
  hint?: ReactNode;
}) {
  return (
    <motion.div
      className="state-page"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
    >
      <div className="state-card">
        <div className={`state-icon ${icon}`}>
          {icon === "loading" ? (
            <motion.div
              className="state-spinner"
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            />
          ) : (
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              aria-hidden
            >
              <circle cx="12" cy="12" r="9" />
              <path d="M12 8v5M12 16h.01" />
            </svg>
          )}
        </div>
        <h2 className="state-title">{title}</h2>
        <p className="state-message">{message}</p>
        {action && <div className="state-action">{action}</div>}
        {hint && <p className="state-hint">{hint}</p>}
      </div>
    </motion.div>
  );
}
