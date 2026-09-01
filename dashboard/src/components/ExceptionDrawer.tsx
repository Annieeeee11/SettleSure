import { useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import type { Exception } from "../types";
import { useIsMobile } from "../hooks/useIsMobile";

export default function ExceptionDrawer({
  exception,
  onClose,
}: {
  exception: Exception | null;
  onClose: () => void;
}) {
  const mobile = useIsMobile();

  useEffect(() => {
    if (!exception) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prev;
    };
  }, [exception, onClose]);

  return createPortal(
    <AnimatePresence>
      {exception && (
        <motion.button
          key="drawer-backdrop"
          type="button"
          className="drawer-backdrop"
          aria-label="Close details"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2, ease: [0.32, 0.72, 0, 1] }}
          onClick={onClose}
        />
      )}
      {exception && (
        <motion.aside
          key="exception-drawer"
          className="exception-drawer"
          role="dialog"
          aria-modal="true"
          aria-label={`Details for ${exception.recordId}`}
          initial={mobile ? { y: "100%" } : { x: "100%" }}
          animate={mobile ? { y: 0 } : { x: 0 }}
          exit={mobile ? { y: "100%" } : { x: "100%" }}
          transition={{ duration: 0.32, ease: [0.32, 0.72, 0, 1] }}
        >
          <div className="drawer-header">
            <div>
              <span className="drawer-label">Exception</span>
              <h3 className="drawer-title">{exception.recordId}</h3>
            </div>
            <button
              type="button"
              className="drawer-close"
              aria-label="Close"
              onClick={onClose}
            >
              ×
            </button>
          </div>
          <dl className="drawer-meta">
            <dt>Source</dt>
            <dd>{exception.source}</dd>
            <dt>Type</dt>
            <dd>{exception.exceptionType ?? "—"}</dd>
          </dl>
          <div className="drawer-reason">
            <span className="drawer-label">Reason</span>
            <p>{exception.reason}</p>
          </div>
          <div className="drawer-actions">
            <span className="review-required">
              Human review required · release blocked
            </span>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>,
    document.body,
  );
}
