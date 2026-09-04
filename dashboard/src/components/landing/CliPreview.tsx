import { CLI_CMD, CLI_PREVIEW, WORDMARK } from "@/lib/landingContent";
import {
  TerminalBox,
  TerminalChrome,
  terminalBodyClass,
} from "./TerminalUi";

function WordmarkChar({ ch }: { ch: string }) {
  if (ch === "█") return <span className="text-violet-300">{ch}</span>;
  if (ch === "░") return <span className="text-violet-900/60">{ch}</span>;
  return <span>{ch}</span>;
}

function MetricRow({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "green" | "yellow";
}) {
  const valueClass =
    tone === "green"
      ? "text-emerald-400"
      : tone === "yellow"
        ? "text-amber-400"
        : "text-zinc-300";

  return (
    <div className="flex gap-3">
      <span className="w-[7.5rem] shrink-0 text-zinc-600">{label}</span>
      <span className={valueClass}>{value}</span>
    </div>
  );
}

export default function CliPreview() {
  const d = CLI_PREVIEW;
  const m = d.metrics;
  const s = d.matchSources;

  return (
    <TerminalChrome>
      <div className={terminalBodyClass}>
        <p className="mb-4 whitespace-pre text-zinc-500">
          <span className="text-zinc-600">$ </span>
          {CLI_CMD}
        </p>
        <pre className="mb-1 overflow-x-auto text-[0.45rem] leading-[1.15] sm:text-[0.52rem]">
          {WORDMARK.map((line) => (
            <span key={line} className="block whitespace-pre">
              {line.split("").map((ch, i) => (
                <WordmarkChar key={`${line}-${i}`} ch={ch} />
              ))}
            </span>
          ))}
        </pre>
        <p className="mb-3 text-zinc-500"> settlement reconciliation</p>

        <p className="mb-1 text-zinc-600">{d.runLabel}</p>
        <p className="mb-4 text-zinc-600">
          {"  status  "}
          <span className="font-semibold text-zinc-300">seed {d.status.seed}</span>
          {" · "}
          {d.status.payments} pay / {d.status.settlements} setl / {d.status.bank}{" "}
          bank · LLM:{" "}
          <span className="text-amber-400">{d.status.llm}</span>
        </p>

        <TerminalBox title="headline metrics">
          <MetricRow label="Match rate" value={m.matchRate} tone="yellow" />
          <MetricRow label="Precision" value={m.precision} tone="green" />
          <MetricRow label="Recall" value={m.recall} tone="yellow" />
          <MetricRow label="FP rate" value={m.fpRate} />
          <MetricRow label="Exception acc" value={m.exceptionAcc} />
          <div className="h-2" />
          <MetricRow label="GT matches" value={String(m.gtMatches)} />
          <MetricRow label="Predicted" value={String(m.predicted)} />
          <MetricRow
            label="TP / FP / FN"
            value={`${m.tp} / ${m.fp} / ${m.fn}`}
          />
          <MetricRow label="True exceptions" value={String(m.trueExceptions)} />
          <MetricRow label="Pred. exceptions" value={String(m.predExceptions)} />
          <MetricRow
            label="Correctly flagged"
            value={String(m.correctlyFlagged)}
          />
          <div className="h-2" />
          <MetricRow
            label="Runtime"
            value={`${m.runtimeMs.toFixed(1)} ms · ${m.throughput.toFixed(2)} rec/s`}
          />
        </TerminalBox>

        <TerminalBox title="match sources">
          <p>
            <span className="text-cyan-400">Exact</span> {s.exact}
            {"  ·  "}
            <span className="text-cyan-400">Fuzzy</span> {s.fuzzy}
            {"  ·  "}
            <span className="text-cyan-400">Split</span> {s.split}
            {"  ·  "}
            <span className="text-cyan-400">LLM</span> {s.llm}
            {"  ·  "}
            <span className="text-cyan-400">Human</span> {s.human}
          </p>
          <p className="text-zinc-600">
            timing exact {s.timing.exact.toFixed(1)} · fuzzy{" "}
            {s.timing.fuzzy.toFixed(1)} · split {s.timing.split.toFixed(1)} · llm{" "}
            {s.timing.llm.toFixed(1)} ms
          </p>
        </TerminalBox>

        <TerminalBox title="by difficulty">
          {d.difficulty.map((row) => (
            <p key={row.label}>
              <span className="inline-block w-28 text-zinc-300">{row.label}</span>
              <span className="inline-block w-24">
                match {row.match.padStart(7)}
              </span>
              <span className="inline-block w-24">
                prec {row.prec.padStart(7)}
              </span>
              deferred {row.deferred.padStart(7)}
            </p>
          ))}
        </TerminalBox>

        <TerminalBox
          title={`exceptions (${d.exceptions.groups} groups / ${d.exceptions.records} records)`}
        >
          {d.exceptions.preview.map((ex) => (
            <p key={ex.ids} className="flex min-w-[42rem] gap-2">
              <span className="w-40 shrink-0 truncate text-cyan-400">{ex.ids}</span>
              <span className="w-28 shrink-0 text-zinc-600">{ex.source}</span>
              <span className="min-w-0 text-zinc-500">{ex.reason}</span>
            </p>
          ))}
          <p className="text-zinc-600">
            … and {d.exceptions.moreGroups} more groups (see output/report.md)
          </p>
        </TerminalBox>

        <p className="mt-2 text-zinc-600">
          {"  limitations  "}
          {d.limitations}
        </p>
        {d.wrote.map((path) => (
          <p key={path} className="text-zinc-600">
            {"  wrote  "}
            {path}
          </p>
        ))}
      </div>
    </TerminalChrome>
  );
}
