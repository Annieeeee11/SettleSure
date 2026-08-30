import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
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
import "./App.css";

type Tab = "exceptions" | "matches";

type PendingCorrection = {
  recordId: string;
  source: string;
  decision: "accept" | "reject";
  correctedMatchId?: string;
};

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

const pageFade = {
  enter: { opacity: 0 },
  center: {
    opacity: 1,
    transition: { duration: 0.12, ease: [0.25, 0.1, 0.25, 1] as const },
  },
  exit: {
    opacity: 0,
    transition: { duration: 0.08, ease: [0.4, 0, 1, 1] as const },
  },
};

function friendlyError(message: string): string {
  if (message === "Failed to fetch") {
    return "The dashboard couldn't reach report.json. Start the dev server and generate a report first.";
  }
  return message;
}

function findCounterpart(
  row: Exception,
  exceptions: Exception[],
): string | undefined {
  const sameReason = exceptions.filter(
    (e) =>
      e.reason === row.reason &&
      e.recordId !== row.recordId &&
      e.source !== row.source,
  );
  if (sameReason.length === 0) return undefined;
  const digits = row.recordId.replace(/\D/g, "");
  const byDigits = sameReason.find(
    (e) => e.recordId.replace(/\D/g, "") === digits,
  );
  return (byDigits ?? sameReason[0])?.recordId;
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
              {n}
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
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("exceptions");
  const [filter, setFilter] = useState("all");
  const [selectedException, setSelectedException] = useState<Exception | null>(
    null,
  );
  const [selectedMatch, setSelectedMatch] = useState<MatchResult | null>(null);
  const [sortKey, setSortKey] = useState<"source" | "type">("source");
  const [pending, setPending] = useState<Record<string, PendingCorrection>>({});
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [rerunning, setRerunning] = useState(false);
  const [excPage, setExcPage] = useState(1);
  const [matchPage, setMatchPage] = useState(1);
  function goExcPage(next: number) {
    setExcPage(next);
    setSelectedException(null);
  }

  function goMatchPage(next: number) {
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

  useEffect(() => {
    setExcPage(1);
    setSelectedException(null);
  }, [filter, sortKey]);

  useEffect(() => {
    setSelectedException(null);
  }, [tab]);

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

  async function sendCorrection(
    row: Exception,
    decision: "accept" | "reject",
  ) {
    const key = `${row.source}:${row.recordId}`;
    const correctedMatchId =
      decision === "accept"
        ? findCounterpart(row, report?.exceptions ?? [])
        : undefined;

    const res = await fetch("/api/corrections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        recordId: row.recordId,
        source: row.source,
        decision,
        correctedMatchId,
        score: 0.7,
      }),
    });
    if (!res.ok) {
      setStatusMsg(`Failed to write correction for ${row.recordId}`);
      return;
    }
    setPending((prev) => ({
      ...prev,
      [key]: {
        recordId: row.recordId,
        source: row.source,
        decision,
        correctedMatchId,
      },
    }));
    setStatusMsg(
      decision === "accept"
        ? `${row.recordId} accepted — will resolve as human match on next run`
        : `${row.recordId} rejected — stays exception on next run`,
    );
  }

  async function rerunWithCorrections() {
    setRerunning(true);
    setStatusMsg("Re-running reconcile with --apply-corrections…");
    try {
      const res = await fetch("/api/rerun", { method: "POST" });
      const body = (await res.json()) as {
        ok: boolean;
        error?: string;
        human?: number;
      };
      if (!res.ok || !body.ok) {
        setStatusMsg(
          body.error ??
            "Re-run failed. From the project root run: npm run reconcile -- --seed 42 --skip-llm --apply-corrections",
        );
        return;
      }
      await loadReport();
      setPending({});
      setStatusMsg(
        `Re-run complete — human matches in breakdown: ${body.human ?? "?"}`,
      );
    } catch {
      setStatusMsg(
        "Re-run API unavailable. Run: npm run reconcile -- --seed 42 --skip-llm --apply-corrections",
      );
    } finally {
      setRerunning(false);
    }
  }

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
            <>
              From the project root:{" "}
              <code>npm run reconcile -- --seed 42 --skip-llm</code>
            </>
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
  const pendingCount = Object.keys(pending).length;

  const metrics = [
    { label: "Match rate", value: pct(m.matchRate) },
    { label: "Precision", value: pct(m.precision) },
    { label: "Recall", value: pct(m.recall) },
    { label: "FP rate", value: pct(m.falsePositiveRate), danger: true },
    {
      label: "Throughput",
      value: `${m.throughputRecordsPerSec.toFixed(0)}/s`,
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
          Payment → Settlement → Bank credit · seed {m.seed} ·{" "}
          {m.paymentCount} payments · {m.settlementCount} settlements ·{" "}
          {m.bankCount} credits
        </p>
      </motion.header>

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
          <motion.button
            className="btn primary"
            disabled={rerunning}
            onClick={() => void rerunWithCorrections()}
            whileTap={{ scale: rerunning ? 1 : 0.97 }}
          >
            {rerunning ? "Re-running…" : "Re-run with corrections"}
          </motion.button>
        </div>
        <AnimatePresence>
          {statusMsg && (
            <motion.p
              className="status-msg"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
            >
              {statusMsg}
            </motion.p>
          )}
        </AnimatePresence>
        {pendingCount > 0 && (
          <p className="panel-note">
            {pendingCount} correction(s) queued — re-run to apply as human
            matches.
          </p>
        )}
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
              if (id === "exceptions") setExcPage(1);
              else setMatchPage(1);
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
                onChange={setFilter}
                options={[
                  { value: "all", label: "All" },
                  ...exceptionTypes.map((t) => ({ value: t, label: t })),
                ]}
              />
              <Select
                label="Sort"
                value={sortKey}
                onChange={(v) => setSortKey(v as "source" | "type")}
                options={[
                  { value: "source", label: "Source" },
                  { value: "type", label: "Type" },
                ]}
              />
            </div>
            <div className="table-wrap table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Record</th>
                    <th>Source</th>
                    <th>Type</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <AnimatePresence mode="wait">
                  <motion.tbody
                    key={excPage}
                    variants={pageFade}
                    initial="enter"
                    animate="center"
                    exit="exit"
                  >
                    {paginatedExceptions.map((e) => {
                      const key = `${e.source}:${e.recordId}`;
                      const selected =
                        selectedException?.recordId === e.recordId &&
                        selectedException?.source === e.source;
                      const queued = pending[key];
                      return (
                        <tr
                          key={key}
                          className={`clickable ${queued ? "row-pending" : ""} ${selected ? "selected" : ""}`}
                          onClick={() =>
                            setSelectedException(selected ? null : e)
                          }
                        >
                          <td>{e.recordId}</td>
                          <td>{e.source}</td>
                          <td>{e.exceptionType ?? "—"}</td>
                          <td onClick={(ev) => ev.stopPropagation()}>
                            {queued ? (
                              <span className="pending-tag">
                                Pending re-run ({queued.decision})
                              </span>
                            ) : (
                              <>
                                <motion.button
                                  className="btn accept"
                                  onClick={() =>
                                    void sendCorrection(e, "accept")
                                  }
                                  whileTap={{ scale: 0.95 }}
                                >
                                  Accept
                                </motion.button>
                                <motion.button
                                  className="btn reject"
                                  onClick={() =>
                                    void sendCorrection(e, "reject")
                                  }
                                  whileTap={{ scale: 0.95 }}
                                >
                                  Reject
                                </motion.button>
                              </>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </motion.tbody>
                </AnimatePresence>
              </table>
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
              pending={
                selectedException
                  ? pending[
                      `${selectedException.source}:${selectedException.recordId}`
                    ]
                  : undefined
              }
              onClose={() => setSelectedException(null)}
              onAccept={(row) => void sendCorrection(row, "accept")}
              onReject={(row) => void sendCorrection(row, "reject")}
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
                <AnimatePresence mode="wait">
                  <motion.ul
                    key={matchPage}
                    className="match-list"
                    variants={pageFade}
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

      <footer className="foot">
        CLI remains the source of truth · this view reads{" "}
        <code>output/report.json</code>
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
  pending,
  onClose,
  onAccept,
  onReject,
}: {
  exception: Exception | null;
  pending?: PendingCorrection;
  onClose: () => void;
  onAccept: (row: Exception) => void;
  onReject: (row: Exception) => void;
}) {
  const mobile = useIsMobile();
  const hidden = mobile ? { y: "100%" } : { x: "100%" };
  const visible = mobile ? { y: 0 } : { x: 0 };

  useEffect(() => {
    if (!exception) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [exception, onClose]);

  return (
    <AnimatePresence>
      {exception && (
        <>
          <motion.button
            type="button"
            className="drawer-backdrop"
            aria-label="Close details"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={onClose}
          />
          <motion.aside
            className="exception-drawer"
            role="dialog"
            aria-label={`Details for ${exception.recordId}`}
            initial={hidden}
            animate={visible}
            exit={hidden}
            transition={{ type: "spring", stiffness: 420, damping: 38 }}
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
              {pending ? (
                <span className="pending-tag">
                  Pending re-run ({pending.decision})
                </span>
              ) : (
                <>
                  <button
                    type="button"
                    className="btn accept"
                    onClick={() => onAccept(exception)}
                  >
                    Accept
                  </button>
                  <button
                    type="button"
                    className="btn reject"
                    onClick={() => onReject(exception)}
                  >
                    Reject
                  </button>
                </>
              )}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
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
