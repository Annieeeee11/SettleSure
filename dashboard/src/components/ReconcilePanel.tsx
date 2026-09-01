import { useEffect, useState } from "react";
import { health, reconcile } from "../lib/api";
import { parseCsvBatch } from "../lib/csv";
import type { FullReport, ReconcileRequest } from "../types";

export type ReportMode = "benchmark" | "live-sample" | "live-csv";

interface Props {
  mode: ReportMode;
  onComplete: (report: FullReport, mode: ReportMode) => void;
}

type Files = {
  settlements: File | null;
  bank: File | null;
  payments: File | null;
};

const EMPTY_FILES: Files = {
  settlements: null,
  bank: null,
  payments: null,
};

async function fileText(file: File): Promise<string> {
  return file.text();
}

export default function ReconcilePanel({ mode, onComplete }: Props) {
  const [apiStatus, setApiStatus] = useState<"checking" | "online" | "offline">(
    "checking",
  );
  const [version, setVersion] = useState("");
  const [files, setFiles] = useState<Files>(EMPTY_FILES);
  const [batch, setBatch] = useState<ReconcileRequest | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    health()
      .then((result) => {
        setApiStatus("online");
        setVersion(result.version);
      })
      .catch(() => setApiStatus("offline"));
  }, []);

  useEffect(() => {
    if (!files.settlements || !files.bank || !files.payments) {
      return;
    }
    let cancelled = false;
    Promise.all([
      fileText(files.payments),
      fileText(files.settlements),
      fileText(files.bank),
    ])
      .then(([payments, settlements, bank]) => {
        if (cancelled) return;
        setBatch(parseCsvBatch({ payments, settlements, bank }));
        setMessage(null);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setBatch(null);
        setMessage(
          error instanceof Error ? error.message : "Unable to parse CSV files",
        );
      });
    return () => {
      cancelled = true;
    };
  }, [files]);

  async function execute(payload: ReconcileRequest, nextMode: ReportMode) {
    setBusy(true);
    setMessage(
      apiStatus === "offline"
        ? "Waking the API and reconciling…"
        : "Running the safety-gated reconciliation pipeline…",
    );
    try {
      const report = await reconcile(payload);
      onComplete(report, nextMode);
      setApiStatus("online");
      setMessage(
        `Complete: ${report.matches.length} matches, ${report.exceptions.length} exceptions.`,
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Reconciliation failed");
    } finally {
      setBusy(false);
    }
  }

  async function runSample() {
    setBusy(true);
    setMessage("Loading the judge sample…");
    try {
      const response = await fetch("/sample-request.json");
      if (!response.ok) throw new Error("Sample request is unavailable");
      const payload = (await response.json()) as ReconcileRequest;
      setBusy(false);
      await execute(payload, "live-sample");
    } catch (error) {
      setBusy(false);
      setMessage(error instanceof Error ? error.message : "Sample run failed");
    }
  }

  function setFile(kind: keyof Files, file: File | null) {
    setBatch(null);
    setFiles((current) => ({ ...current, [kind]: file }));
  }

  const total = batch
    ? batch.payments.length +
      batch.settlements.length +
      batch.bankTransactions.length
    : 0;

  return (
    <section className="reconcile-console" aria-label="Live reconciliation">
      <div className="console-copy">
        <div className="eyebrow-row">
          <span className={`live-dot ${apiStatus}`} aria-hidden />
          <span>
            API {apiStatus}
            {version ? ` · v${version}` : ""}
          </span>
          <span className="mode-badge">
            {mode === "benchmark" ? "Benchmark view" : "Live result"}
          </span>
        </div>
        <h1>Reconcile a settlement batch in seconds.</h1>
        <p>
          Exact, fuzzy, split, and safety-gated matching with ambiguous cases
          routed to human review.
        </p>
        <button
          className="btn primary sample-cta"
          type="button"
          disabled={busy}
          onClick={() => void runSample()}
        >
          {busy ? "Reconciling…" : "Run live sample"}
        </button>
      </div>

      <div className="csv-console">
        <div className="csv-console-head">
          <div>
            <span className="console-kicker">Use your data</span>
            <h2>Upload three CSVs</h2>
          </div>
          {batch && <span className="record-count">{total} records ready</span>}
        </div>
        <div className="live-upload-grid">
          {(
            [
              ["settlements", "Settlements"],
              ["bank", "Bank statement"],
              ["payments", "Payments"],
            ] as const
          ).map(([kind, label]) => (
            <label className={files[kind] ? "file-chip selected" : "file-chip"} key={kind}>
              <span>{label}</span>
              <small>{files[kind]?.name ?? "Choose .csv"}</small>
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={(event) =>
                  setFile(kind, event.target.files?.[0] ?? null)
                }
              />
            </label>
          ))}
        </div>
        <button
          className="btn secondary reconcile-upload"
          type="button"
          disabled={!batch || busy}
          onClick={() => batch && void execute(batch, "live-csv")}
        >
          Reconcile uploaded CSVs
        </button>
        {message && (
          <p className="console-status" role="status">
            {message}
          </p>
        )}
      </div>
    </section>
  );
}
