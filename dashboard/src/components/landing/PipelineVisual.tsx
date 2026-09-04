import type { PipelineVisualKind } from "@/lib/landingContent";
import { CLI_PREVIEW } from "@/lib/landingContent";
import DashboardExceptionsPreview from "./DashboardExceptionsPreview";
import {
  TerminalBox,
  TerminalChrome,
  terminalBodyClass,
} from "./TerminalUi";

function DeterministicVisual() {
  const d = CLI_PREVIEW;
  const s = d.matchSources;

  return (
    <TerminalChrome>
      <div className={terminalBodyClass}>
        <p className="mb-4 text-zinc-600">
          {"  status  "}
          <span className="font-semibold text-zinc-300">seed {d.status.seed}</span>
          {" · "}
          {d.status.payments} pay / {d.status.settlements} setl / {d.status.bank}{" "}
          bank · LLM:{" "}
          <span className="text-amber-400">{d.status.llm}</span>
        </p>

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

        <p className="mt-1 text-zinc-600">
          {"  runtime  "}
          {d.metrics.runtimeMs.toFixed(1)} ms · {d.metrics.throughput.toFixed(2)}{" "}
          rec/s
        </p>
      </div>
    </TerminalChrome>
  );
}

function LlmVisual() {
  const d = CLI_PREVIEW;
  const deferred = d.exceptions.preview.filter((ex) =>
    ex.reason.includes("ambiguous"),
  );

  return (
    <TerminalChrome>
      <div className={terminalBodyClass}>
        <TerminalBox title="release gate · tier 4">
          <p className="text-amber-400">LLM corroboration required · deferred</p>
          <p className="text-zinc-600">
            wrong verdicts cannot auto-release without corroboration
          </p>
        </TerminalBox>

        <TerminalBox
          title={`exceptions (${d.exceptions.groups} groups / ${d.exceptions.records} records)`}
        >
          {deferred.map((ex) => (
            <p key={ex.ids} className="flex gap-2">
              <span className="w-40 shrink-0 truncate text-cyan-400">{ex.ids}</span>
              <span className="w-28 shrink-0 text-zinc-600">{ex.source}</span>
              <span className="min-w-0 text-zinc-500">{ex.reason}</span>
            </p>
          ))}
        </TerminalBox>

        <p className="mt-2 text-zinc-600">
          {"  limitations  "}
          {d.limitations}
        </p>
        <p className="text-zinc-600">
          {"  flag  "}
          use <span className="text-zinc-300">--skip-llm</span> to defer every
          ambiguous pair to ops
        </p>
      </div>
    </TerminalChrome>
  );
}

const VISUALS: Record<PipelineVisualKind, () => React.JSX.Element> = {
  deterministic: DeterministicVisual,
  llm: LlmVisual,
  human: () => <DashboardExceptionsPreview />,
};

export default function PipelineVisual({ kind }: { kind: PipelineVisualKind }) {
  const Visual = VISUALS[kind];
  return <Visual />;
}
