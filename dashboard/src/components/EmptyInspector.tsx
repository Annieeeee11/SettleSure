import { motion } from "framer-motion";

export default function EmptyInspector() {
  return (
    <motion.div
      className="empty-state"
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.2 }}
    >
      <div className="empty-state-icon">
        <svg
          width="28"
          height="28"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.25"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <rect x="3" y="4" width="14" height="16" rx="2" />
          <path d="M7 8h6M7 12h4" />
          <path d="M14 12l6 6M20 12v6h-6" />
        </svg>
      </div>
    </motion.div>
  );
}
