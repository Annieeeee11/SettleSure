import type { PipelineVisualKind } from "@/lib/landingContent";
import { CLI_PREVIEW } from "@/lib/landingContent";
import { FeaturePanel } from "./FeaturePanel";

function TierRow({
  tag,
  name,
  desc,
  count,
  ms,
  active = false,
}: {
  tag: string;
  name: string;
  desc: string;
  count?: number;
  ms?: number;
  active?: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-4 rounded-xl border px-4 py-3 ${
        active
          ? "border-orange-500/30 bg-orange-500/5"
          : "border-[var(--card-border)] bg-[var(--surface-inset)]"
      }`}
    >
      <span className="w-14 shrink-0 font-mono text-[10px] uppercase tracking-widest text-[var(--text-tertiary)]">
        {tag}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">{name}</p>
        <p className="text-xs text-[var(--text-secondary)]">{desc}</p>
      </div>
      {count != null ? (
        <div className="shrink-0 text-right">
          <p className="font-mono text-sm font-medium text-emerald-400">
            {count} matches
          </p>
          {ms != null ? (
            <p className="font-mono text-[10px] text-[var(--text-tertiary)]">
              {ms.toFixed(1)} ms
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function DeterministicVisual() {
  const s = CLI_PREVIEW.matchSources;
  return (
    <FeaturePanel title="match pipeline">
      <div className="space-y-2.5">
        <TierRow
          tag="Tier 1"
          name="Exact"
          desc="UTR + amount + date match"
          count={s.exact}
          ms={s.timing.exact}
          active
        />
        <TierRow
          tag="Tier 2"
          name="Fuzzy"
          desc="Near-duplicate references"
          count={s.fuzzy}
          ms={s.timing.fuzzy}
          active
        />
        <TierRow
          tag="Tier 3"
          name="Split"
          desc="Subset-sum payout groups"
          count={s.split}
          ms={s.timing.split}
          active
        />
        <TierRow tag="Tier 4" name="LLM" desc="Ambiguous cases only" count={s.llm} />
        <TierRow tag="Tier 5" name="Human" desc="Ops override + audit" count={s.human} />
      </div>
      <p className="mt-4 font-mono text-[11px] text-[var(--text-tertiary)]">
        seed 42 · 42/49 matched · LLM: none · 15.0 ms total
      </p>
    </FeaturePanel>
  );
}

function LlmVisual() {
  const deferred = CLI_PREVIEW.exceptions.preview.filter((ex) =>
    ex.reason.includes("ambiguous"),
  );

  return (
    <FeaturePanel title="release gate">
      <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-amber-500/25 bg-amber-500/5 px-4 py-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-widest text-amber-500">
            Tier 4
          </p>
          <p className="text-sm font-semibold">LLM corroboration required</p>
        </div>
        <span className="rounded-full border border-amber-500/30 px-2.5 py-1 font-mono text-[10px] text-amber-400">
          deferred
        </span>
      </div>
      <div className="space-y-2 font-mono text-[11px]">
        {deferred.slice(0, 4).map((ex) => (
          <div
            key={ex.ids}
            className="rounded-lg border border-[var(--card-border)] bg-[var(--surface-inset)] px-3 py-2.5"
          >
            <div className="mb-1 flex items-center justify-between gap-2">
              <span className="truncate text-cyan-400">{ex.ids}</span>
              <span className="shrink-0 text-[10px] text-amber-400">blocked</span>
            </div>
            <p className="text-[var(--text-secondary)]">{ex.reason}</p>
          </div>
        ))}
      </div>
      <p className="mt-4 text-xs leading-relaxed text-[var(--text-secondary)]">
        Wrong LLM verdicts cannot auto-release. Use{" "}
        <span className="font-mono text-[var(--text)]">--skip-llm</span> to
        defer every ambiguous pair to ops.
      </p>
    </FeaturePanel>
  );
}

function HumanVisual() {
  const queue = [
    { id: "setl_0068", issue: "fee/tax miscalculation", risk: "₹4,127" },
    { id: "bank_0052", issue: "currency mismatch", risk: "₹9,840" },
    { id: "bank_0036", issue: "ambiguous pair", risk: "₹12,400" },
  ];

  return (
    <FeaturePanel title="ops queue">
      <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-[var(--card-border)] bg-[var(--surface-inset)] px-4 py-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-widest text-[var(--text-tertiary)]">
            Tier 5
          </p>
          <p className="text-sm font-semibold">Human override + audit</p>
        </div>
        <span className="font-mono text-[10px] text-[var(--text-secondary)]">
          3 pending
        </span>
      </div>
      <div className="overflow-hidden rounded-xl border border-[var(--card-border)]">
        <div className="grid grid-cols-[1fr_1.2fr_auto] gap-3 border-b border-[var(--card-border)] bg-[var(--surface-inset)] px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-[var(--text-tertiary)]">
          <span>Record</span>
          <span>Issue</span>
          <span className="text-right">At risk</span>
        </div>
        {queue.map((row) => (
          <div
            key={row.id}
            className="grid grid-cols-[1fr_1.2fr_auto] gap-3 border-b border-[var(--card-border)] px-3 py-2.5 last:border-b-0"
          >
            <span className="font-mono text-[11px] text-cyan-400">{row.id}</span>
            <span className="text-xs text-[var(--text-secondary)]">
              {row.issue}
            </span>
            <span className="text-right text-xs font-medium">{row.risk}</span>
          </div>
        ))}
      </div>
      <p className="mt-4 text-xs leading-relaxed text-[var(--text-secondary)]">
        Every release is logged with reviewer, timestamp, and prior tier verdict.
      </p>
    </FeaturePanel>
  );
}

const VISUALS: Record<
  PipelineVisualKind,
  () => React.JSX.Element
> = {
  deterministic: DeterministicVisual,
  llm: LlmVisual,
  human: HumanVisual,
};

export default function PipelineVisual({ kind }: { kind: PipelineVisualKind }) {
  const Visual = VISUALS[kind];
  return <Visual />;
}
