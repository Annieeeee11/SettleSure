import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import type {
  AmbiguityLevel,
  Exception,
  FullReport,
  MatchResult,
} from "./types";
import { pct } from "./types";
import Wordmark from "./Wordmark";
import Select from "./Select";
import ReconcilePanel, {
  type ReportMode,
} from "./components/ReconcilePanel";
import "./App.css";

type Tab = "exceptions" | "matches";

const PAGE_SIZE = 12;

const DIFFICULTY_META: Record<
  AmbiguityLevel,
  { title: string; subtitle: string }
> = {
  clear: {
    title: "Clear cases",
    subtitle: "Exact / easy fuzzy",
  },
  boundary: {
    title: "Boundary cases",
    subtitle: "At fuzzy threshold edge",
  },
  decoy: {
    title: "Decoy (correctly deferred)",
    subtitle: "Should not auto-resolve",
  },
  unresolvable: {
    title: "Unresolvable (correctly flagged)",
    subtitle: "True noise / exceptions",
  },
};

const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: i * 0.05,
      duration: 0.35,
      ease: [0.25, 0.1, 0.25, 1] as const,
    },
  }),
};

const pageSlide = {
  enter: (dir: number) => ({
    opacity: 0,
    x: dir >= 0 ? 32 : -32,
  }),
  center: {
    opacity: 1,
    x: 0,
    transition: {
      type: "spring" as const,
      stiffness: 440,
      damping: 36,
      mass: 0.75,
    },
  },
  exit: (dir: number) => ({
    opacity: 0,
    x: dir >= 0 ? -32 : 32,
    transition: { duration: 0.16, ease: [0.4, 0, 0.8, 0.2] as const },
  }),
};

function friendlyError(message: string): string {
  if (message === "Failed to fetch") {
    return "The dashboard couldn't reach report.json. Start the dev server and generate a report first.";
  }
  return message;
}

function pageNumbers(current: number, total: number): (number | "…")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: (number | "…")[] = [1];
  if (current > 3) pages.push("…");
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  for (let i = start; i <= end; i++) pages.push(i);
  if (current < total - 2) pages.push("…");
  pages.push(total);
  return pages;
}

function Pagination({
  page,
  total,
  pageSize,
  onChange,
  id,
}: {
  page: number;
  total: number;
  pageSize: number;
  onChange: (p: number) => void;
  id: string;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  if (total <= pageSize) return null;

  return (
    <div className="pagination">
      <span className="pagination-info">
        {start}–{end} of {total}
      </span>
      <div className="pagination-controls">
        <button
          className="btn ghost"
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
        >
          ← Prev
        </button>
        {pageNumbers(page, totalPages).map((n, i) =>
          n === "…" ? (
            <span key={`${id}-ellipsis-${i}`} className="page-ellipsis">
              …
            </span>
          ) : (
            <button
              key={`${id}-${n}`}
              className={`page-btn ${n === page ? "active" : ""}`}
              onClick={() => onChange(n)}
            >
              {n === page && (
                <motion.span
                  className="page-indicator"
                  layoutId={`${id}-page-indicator`}
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
              <span className="page-btn-label">{n}</span>
            </button>
          ),
        )}
        <button
          className="btn ghost"
          disabled={page >= totalPages}
          onClick={() => onChange(page + 1)}
        >
          Next →
        </button>
      </div>
    </div>
  );
}

export default function App() {
  const [report, setReport] = useState<FullReport | null>(null);
  const [reportMode, setReportMode] = useState<ReportMode>("benchmark");
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("exceptions");
  const [filter, setFilter] = useState("all");
  const [selectedException, setSelectedException] = useState<Exception | null>(
    null,
  );
  const [selectedMatch, setSelectedMatch] = useState<MatchResult | null>(null);
  const [sortKey, setSortKey] = useState<"source" | "type">("source");
  const [excPage, setExcPage] = useState(1);
  const [matchPage, setMatchPage] = useState(1);
  const [excDirection, setExcDirection] = useState(1);
  const [matchDirection, setMatchDirection] = useState(1);

  function goExcPage(next: number) {
    setExcDirection(next >= excPage ? 1 : -1);
    setExcPage(next);
    setSelectedException(null);
  }

  function goMatchPage(next: number) {
    setMatchDirection(next >= matchPage ? 1 : -1);
    setMatchPage(next);
  }

  const loadReport = useCallback(() => {
    return fetch(`/report.json?t=${Date.now()}`)
      .then((r) => {
        if (!r.ok)
          throw new Error("Missing report.json — run npm run reconcile first");
        return r.json();
      })
      .then((data: FullReport) => {
        setReport(data);
        setReportMode("benchmark");
        setError(null);
      });
  }, []);

  useEffect(() => {
    loadReport().catch((e: Error) => setError(e.message));
  }, [loadReport]);

  const filteredExceptions = useMemo(() => {
    if (!report) return [];
    let rows = [...report.exceptions];
    if (filter !== "all") {
      rows = rows.filter(
        (e) => e.exceptionType === filter || e.source === filter,
      );
    }
    rows.sort((a, b) => {
      if (sortKey === "source") return a.source.localeCompare(b.source);
      return (a.exceptionType ?? "").localeCompare(b.exceptionType ?? "");
    });
    return rows;
  }, [report, filter, sortKey]);

  const paginatedExceptions = useMemo(() => {
    const start = (excPage - 1) * PAGE_SIZE;
    return filteredExceptions.slice(start, start + PAGE_SIZE);
  }, [filteredExceptions, excPage]);

  const paginatedMatches = useMemo(() => {
    if (!report) return [];
    const start = (matchPage - 1) * PAGE_SIZE;
    return report.matches.slice(start, start + PAGE_SIZE);
  }, [report, matchPage]);

  const exceptionTypes = useMemo(() => {
    if (!report) return [];
    return [
      ...new Set(
        report.exceptions
          .map((e) => e.exceptionType ?? e.source)
          .filter(Boolean),
      ),
    ];
  }, [report]);

  if (error) {
    return (
      <div className="shell state-shell">
        <Wordmark />
        <StatePage
          icon="error"
          title="Couldn't load report"
          message={friendlyError(error)}
          action={
            <button
              className="btn primary"
              onClick={() => {
                setError(null);
                loadReport().catch((e: Error) => setError(e.message));
              }}
            >
              Retry
            </button>
          }
          hint={
            <>The live demo remains available after the benchmark loads.</>
          }
        />
      </div>
    );
  }

  if (!report) {
    return (
      <div className="shell state-shell">
        <Wordmark />
        <StatePage
          icon="loading"
          title="Loading report"
          message="Fetching reconciliation data…"
        />
      </div>
    );
  }

  const m = report.metrics;
  const breakdown = m.matchSourceBreakdown;
  const maxBar = Math.max(
    1,
    breakdown.exact,
    breakdown.fuzzy,
    breakdown.split,
    breakdown.llm,
    breakdown.human,
  );
  const byLevel = m.byAmbiguityLevel;

  const metrics =
    reportMode === "benchmark"
      ? [
          { label: "Match rate", value: pct(m.matchRate) },
          { label: "Precision", value: pct(m.precision) },
          { label: "Recall", value: pct(m.recall) },
          {
            label: "FP rate",
            value: pct(m.falsePositiveRate),
            danger: true,
          },
          {
            label: "Throughput",
            value: `${m.throughputRecordsPerSec.toFixed(0)}/s`,
          },
        ]
      : [
          { label: "Match rate", value: pct(m.matchRate) },
          { label: "Matched", value: report.matches.length.toString() },
          { label: "Exceptions", value: report.exceptions.length.toString() },
          {
            label: "Throughput",
            value: `${m.throughputRecordsPerSec.toFixed(0)}/s`,
          },
          {
            label: "Amount at risk",
            value: `₹${(m.amountAtRisk ?? 0).toLocaleString("en-IN")}`,
          },
        ];

  return (
    <div className="shell">
      <motion.header
        className="hero"
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <Wordmark />
        <p className="sub">
          {reportMode === "benchmark"
            ? `Audited benchmark · seed ${m.seed}`
            : reportMode === "live-csv"
              ? "Live CSV reconciliation"
              : "Live judge sample"}{" "}
          · {m.paymentCount} payments · {m.settlementCount} settlements ·{" "}
          {m.bankCount} credits
          {m.amountAtRisk != null && m.amountAtRisk > 0
            ? ` · ₹${m.amountAtRisk.toFixed(2)} at risk`
            : ""}
        </p>
      </motion.header>

      <ReconcilePanel
        mode={reportMode}
        onComplete={(nextReport, mode) => {
          setReport(nextReport);
          setReportMode(mode);
          setError(null);
          setTab(nextReport.exceptions.length > 0 ? "exceptions" : "matches");
          setExcPage(1);
          setMatchPage(1);
          setSelectedException(null);
          setSelectedMatch(null);
        }}
      />

      <section className="metrics" aria-label="Headline metrics">
        {metrics.map((metric, i) => (
          <motion.div
            key={metric.label}
            custom={i}
            variants={fadeUp}
            initial="hidden"
            animate="visible"
          >
            <Metric
              label={metric.label}
              value={metric.value}
              danger={metric.danger}
            />
          </motion.div>
        ))}
      </section>

      {byLevel && (
        <motion.section
          className="panel difficulty"
          aria-label="Accuracy by difficulty"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, duration: 0.4 }}
        >
          <div className="panel-head">
            <h2>Accuracy by case difficulty</h2>
            <p className="panel-note">
              One number is not enough, this is where the system is actually
              being tested.
            </p>
          </div>
          <div className="difficulty-grid">
            {(
              [
                "clear",
                "boundary",
                "decoy",
                "unresolvable",
              ] as AmbiguityLevel[]
            ).map((level, i) => {
              const slice = byLevel[level];
              const meta = DIFFICULTY_META[level];
              if (!slice) return null;
              const deferred =
                slice.deferredTotal != null && slice.deferredTotal > 0
                  ? `${slice.correctlyDeferred ?? 0}/${slice.deferredTotal}`
                  : null;
              return (
                <motion.div
                  className="diff-card"
                  key={level}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 + i * 0.06, duration: 0.35 }}
                >
                  <h3>{meta.title}</h3>
                  <p className="diff-sub">{meta.subtitle}</p>
                  {level === "decoy" || level === "unresolvable" ? (
                    <p className="diff-main">
                      correctly deferred: <strong>{deferred ?? "—"}</strong>
                    </p>
                  ) : (
                    <>
                      <p className="diff-main">
                        match rate <strong>{pct(slice.matchRate)}</strong>
                      </p>
                      <p className="diff-sec">
                        precision {pct(slice.precision)}
                      </p>
                    </>
                  )}
                </motion.div>
              );
            })}
          </div>
        </motion.section>
      )}

      {m.llmAblation && (
        <motion.section
          className="panel"
          aria-label="LLM impact"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.35 }}
        >
          <h2>LLM impact</h2>
          {!m.llmAblation.providerAvailable && (
            <p className="panel-note">
              No LLM provider available for this report — both columns fell back
              to none. Set <code>ANTHROPIC_API_KEY</code> or run Ollama, then{" "}
              <code>npm run reconcile -- --seed 42 --compare-llm</code>.
            </p>
          )}
          <div className="ablation-grid">
            <div>
              <h3>With LLM ({m.llmAblation.withLlm.provider})</h3>
              <p>Recall {pct(m.llmAblation.withLlm.recall)}</p>
              <p>Precision {pct(m.llmAblation.withLlm.precision)}</p>
              <p>LLM matches {m.llmAblation.withLlm.llmMatches}</p>
            </div>
            <div>
              <h3>Without LLM</h3>
              <p>Recall {pct(m.llmAblation.withoutLlm.recall)}</p>
              <p>Precision {pct(m.llmAblation.withoutLlm.precision)}</p>
              <p>LLM matches {m.llmAblation.withoutLlm.llmMatches}</p>
            </div>
          </div>
        </motion.section>
      )}

      <motion.section
        className="panel"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.4 }}
      >
        <div className="panel-head row">
          <h2>Match source</h2>
          <span className="safety-note">Hard release gates enforced</span>
        </div>
        <div className="bars">
          {(
            [
              ["exact", breakdown.exact],
              ["fuzzy", breakdown.fuzzy],
              ["split", breakdown.split],
              ["llm", breakdown.llm],
              ["human", breakdown.human],
            ] as const
          ).map(([name, count], i) => (
            <div className="bar-row" key={name}>
              <span className="bar-label">{name}</span>
              <div className="bar-track">
                <motion.div
                  className={`bar-fill bar-${name}`}
                  initial={{ width: 0 }}
                  animate={{ width: `${(count / maxBar) * 100}%` }}
                  transition={{
                    delay: 0.5 + i * 0.08,
                    duration: 0.6,
                    ease: [0.25, 0.1, 0.25, 1] as const,
                  }}
                />
              </div>
              <span className="bar-count">{count}</span>
            </div>
          ))}
        </div>
      </motion.section>

      <div className="tabs">
        {(
          [
            ["exceptions", `Exceptions (${report.exceptions.length})`],
            ["matches", `Matches (${report.matches.length})`],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            className={tab === id ? "active" : ""}
            onClick={() => {
              setTab(id);
              setSelectedException(null);
              if (id === "exceptions") {
                setExcPage(1);
                setExcDirection(1);
              } else {
                setMatchPage(1);
                setMatchDirection(1);
              }
            }}
          >
            {tab === id && (
              <motion.span
                className="tab-indicator"
                layoutId="tab-indicator"
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
              />
            )}
            {label}
          </button>
        ))}
      </div>

      <div className="tab-content">
      <AnimatePresence mode="wait">
        {tab === "exceptions" && (
          <motion.section
            key="exceptions"
            className="panel exceptions-panel"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12 }}
          >
            <div className="toolbar">
              <Select
                label="Filter"
                value={filter}
                onChange={(value) => {
                  setFilter(value);
                  setExcPage(1);
                  setExcDirection(1);
                  setSelectedException(null);
                }}
                options={[
                  { value: "all", label: "All" },
                  ...exceptionTypes.map((t) => ({ value: t, label: t })),
                ]}
              />
              <Select
                label="Sort"
                value={sortKey}
                onChange={(value) => {
                  setSortKey(value as "source" | "type");
                  setExcPage(1);
                  setExcDirection(1);
                  setSelectedException(null);
                }}
                options={[
                  { value: "source", label: "Source" },
                  { value: "type", label: "Type" },
                ]}
              />
            </div>
            <div className="table-wrap table-scroll">
                <AnimatePresence mode="wait" initial={false} custom={excDirection}>
                <motion.div
                  key={excPage}
                  className="table-page"
                  custom={excDirection}
                  variants={pageSlide}
                  initial="enter"
                  animate="center"
                  exit="exit"
                >
                  <table>
                    <thead>
                      <tr>
                        <th>Record</th>
                        <th>Source</th>
                        <th>Type</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedExceptions.map((e) => {
                        const key = `${e.source}:${e.recordId}`;
                        const selected =
                          selectedException?.recordId === e.recordId &&
                          selectedException?.source === e.source;
                        return (
                          <tr
                            key={key}
                            className={`clickable ${selected ? "selected" : ""}`}
                            onClick={() =>
                              setSelectedException(selected ? null : e)
                            }
                          >
                            <td>{e.recordId}</td>
                            <td>{e.source}</td>
                            <td>{e.exceptionType ?? "—"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </motion.div>
              </AnimatePresence>
            </div>
            <Pagination
              id="exceptions"
              page={excPage}
              total={filteredExceptions.length}
              pageSize={PAGE_SIZE}
              onChange={goExcPage}
            />
            <ExceptionDrawer
              exception={selectedException}
              onClose={() => setSelectedException(null)}
            />
          </motion.section>
        )}

        {tab === "matches" && (
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
                <span className="pane-meta">{report.matches.length} total</span>
              </div>
              <div className="match-list-wrap">
                <AnimatePresence mode="wait" initial={false} custom={matchDirection}>
                  <motion.ul
                    key={matchPage}
                    className="match-list"
                    custom={matchDirection}
                    variants={pageSlide}
                    initial="enter"
                    animate="center"
                    exit="exit"
                  >
                    {paginatedMatches.map((match) => (
                      <li key={`${match.bankCreditId}-${match.settlementId}`}>
                        <motion.button
                          className={
                            selectedMatch?.bankCreditId === match.bankCreditId
                              ? "match-item active"
                              : "match-item"
                          }
                          onClick={() => setSelectedMatch(match)}
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
                page={matchPage}
                total={report.matches.length}
                pageSize={PAGE_SIZE}
                onChange={goMatchPage}
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
              <div
                className={`inspector ${selectedMatch ? "has-selection" : ""}`}
              >
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
        )}
      </AnimatePresence>
      </div>

      {report.knownLimitations.length > 0 && (
        <section className="panel limitations" aria-label="Known limitations">
          <div>
            <span className="console-kicker">Transparent by design</span>
            <h2>Known limitations</h2>
          </div>
          <ul>
            {report.knownLimitations.map((limitation) => (
              <li key={limitation}>{limitation}</li>
            ))}
          </ul>
        </section>
      )}

      <footer className="foot">
        SettleSure v2 · deterministic reconciliation with non-overridable
        release gates ·{" "}
        <a href="/api/health" target="_blank" rel="noreferrer">
          API health
        </a>
      </footer>
    </div>
  );
}

function Metric({
  label,
  value,
  danger,
}: {
  label: string;
  value: string;
  danger?: boolean;
}) {
  return (
    <div className={`metric ${danger ? "danger" : ""}`}>
      <span className="metric-value">{value}</span>
      <span className="metric-label">{label}</span>
    </div>
  );
}

function useIsMobile(breakpoint = 800) {
  const query = `(max-width: ${breakpoint}px)`;
  const [mobile, setMobile] = useState(() =>
    typeof window !== "undefined"
      ? window.matchMedia(query).matches
      : false,
  );
  useEffect(() => {
    const mq = window.matchMedia(query);
    const update = () => setMobile(mq.matches);
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, [query]);
  return mobile;
}

function ExceptionDrawer({
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

function EmptyInspector() {
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

function StatePage({
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
