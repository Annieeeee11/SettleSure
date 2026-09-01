import { motion, AnimatePresence } from "framer-motion";
import EmptyInspector from "../components/EmptyInspector";
import Pagination from "../components/Pagination";
import { PAGE_SIZE, pageSlide } from "../lib/constants";
import type { MatchResult } from "../types";

export default function MatchesPanel({
  matches,
  page,
  direction,
  selectedMatch,
  onPageChange,
  onSelectMatch,
}: {
  matches: MatchResult[];
  page: number;
  direction: number;
  selectedMatch: MatchResult | null;
  onPageChange: (page: number) => void;
  onSelectMatch: (match: MatchResult | null) => void;
}) {
  const start = (page - 1) * PAGE_SIZE;
  const paginated = matches.slice(start, start + PAGE_SIZE);

  return (
    <motion.section
      key="matches"
      className="panel split-view"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.12 }}
    >
      <div className="match-pane">
        <div className="pane-header">
          <span>Matches</span>
          <span className="pane-meta">{matches.length} total</span>
        </div>
        <div className="match-list-wrap">
          <AnimatePresence mode="wait" initial={false} custom={direction}>
            <motion.ul
              key={page}
              className="match-list"
              custom={direction}
              variants={pageSlide}
              initial="enter"
              animate="center"
              exit="exit"
            >
              {paginated.map((match) => (
                <li key={`${match.bankCreditId}-${match.settlementId}`}>
                  <motion.button
                    className={
                      selectedMatch?.bankCreditId === match.bankCreditId
                        ? "match-item active"
                        : "match-item"
                    }
                    onClick={() => onSelectMatch(match)}
                    whileTap={{ scale: 0.98 }}
                  >
                    <span className="pill">{match.matchedBy}</span>
                    <span className="match-route">
                      {match.bankCreditId}
                      <span className="match-arrow">→</span>
                      {match.settlementId}
                    </span>
                  </motion.button>
                </li>
              ))}
            </motion.ul>
          </AnimatePresence>
        </div>
        <Pagination
          id="matches"
          page={page}
          total={matches.length}
          pageSize={PAGE_SIZE}
          onChange={onPageChange}
        />
      </div>

      <div className="split-divider" aria-hidden />

      <div className="inspector-pane">
        <div className="pane-header">
          <span>Inspector</span>
          {selectedMatch && (
            <span className="pane-meta">{selectedMatch.bankCreditId}</span>
          )}
        </div>
        <div className={`inspector ${selectedMatch ? "has-selection" : ""}`}>
          <AnimatePresence mode="wait">
            {selectedMatch ? (
              <motion.div
                key={selectedMatch.bankCreditId}
                className="inspector-content"
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                transition={{ duration: 0.2 }}
              >
                <dl>
                  <dt>Pass</dt>
                  <dd>{selectedMatch.matchedBy}</dd>
                  <dt>Confidence</dt>
                  <dd>{selectedMatch.confidence}</dd>
                  <dt>Bank credit</dt>
                  <dd>{selectedMatch.bankCreditId}</dd>
                  <dt>Settlement</dt>
                  <dd>{selectedMatch.settlementId}</dd>
                  {selectedMatch.components && (
                    <>
                      <dt>Components</dt>
                      <dd>{selectedMatch.components.join(", ")}</dd>
                    </>
                  )}
                  <dt>Reasoning</dt>
                  <dd>{selectedMatch.reasoning ?? "—"}</dd>
                </dl>
              </motion.div>
            ) : (
              <EmptyInspector key="empty" />
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.section>
  );
}
