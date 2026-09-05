import { goToDashboard } from "@/hooks/useRoute";
import { CLI_PREVIEW } from "@/lib/landingContent";
import { Arrow } from "./Shared";

const layerClass =
  "absolute inset-x-[74px] inset-y-[34px] overflow-hidden rounded-landing border border-white/35 bg-[#111] [transform-style:preserve-3d] max-[700px]:inset-x-[70px] max-[700px]:inset-y-8";
const copyClass = "translate-y-[30px] opacity-0";
const actionClass =
  "landing-btn landing-btn-primary mt-6 px-[17px] py-3 text-xs";

const STORY = {
  upload: {
    light: "/ness/stoy-upload-light.png",
    dark: "/ness/stoy-upload-dak.png",
  },
  matches: {
    light: "/ness/matches-light.png",
    dark: "/ness/matches-dak.png",
  },
  exception: {
    light: "/ness/exception-light.png",
    dark: "/ness/exception-dak.png",
  },
} as const;

function ThemeShot({
  light,
  dark,
  className = "",
}: {
  light: string;
  dark: string;
  className?: string;
}) {
  return (
    <>
      <img
        src={light}
        alt=""
        className={`theme-dashboard-light absolute inset-0 h-full w-full object-cover object-left-top ${className}`}
      />
      <img
        src={dark}
        alt=""
        className={`theme-dashboard-dark absolute inset-0 h-full w-full object-cover object-left-top ${className}`}
      />
    </>
  );
}

function StackScene() {
  return (
    <div
      className="sc-stack relative aspect-[1.62] w-[clamp(440px,52vw,640px)] [perspective:1100px] [transform-style:preserve-3d] will-change-transform max-[700px]:w-[min(420px,92vw)]"
      aria-hidden="true"
    >
      <div className={`sc-stack-layer sc-layer-1 ${layerClass}`}>
        <ThemeShot {...STORY.exception} className="opacity-45" />
      </div>
      <div className={`sc-stack-layer sc-layer-2 ${layerClass}`}>
        <ThemeShot {...STORY.matches} className="opacity-50" />
      </div>
      <div className={`sc-stack-layer sc-layer-3 ${layerClass}`}>
        <div className="sc-stack-media sc-stack-intro absolute inset-0 opacity-[0.95]">
          <ThemeShot {...STORY.upload} />
        </div>
        <div className="sc-stack-media sc-stack-matches absolute inset-0 opacity-0">
          <ThemeShot {...STORY.matches} />
        </div>
        <div className="sc-stack-media sc-stack-exceptions absolute inset-0 opacity-0">
          <ThemeShot {...STORY.exception} />
        </div>
      </div>
      <div className={`sc-stack-layer sc-layer-4 ${layerClass}`}>
        <ThemeShot {...STORY.upload} className="opacity-40" />
      </div>
      <div className={`sc-stack-layer sc-layer-5 ${layerClass}`}>
        <ThemeShot {...STORY.matches} className="opacity-35" />
      </div>
    </div>
  );
}

export default function DepthStory() {
  return (
    <section
      id="platform"
      className="sc-story landing-section relative mt-8 h-[320vh] overflow-x-clip max-[700px]:mt-6 max-[700px]:h-[300vh]"
    >
      <div className="sticky top-0 flex h-screen min-h-[560px] flex-col items-center justify-center overflow-hidden px-4 pt-16 pb-8 [perspective:1200px] max-[700px]:pt-14 max-[700px]:pb-6">
        <div className="relative flex h-[min(52vh,420px)] w-full max-w-[720px] items-center justify-center">
          <StackScene />
        </div>
        <div
          className={`sc-story-intro ${copyClass} relative z-[4] mt-8 w-[min(520px,92vw)] text-center`}
        >
          <span className="mb-3 block font-mono text-[10px] text-[var(--text-tertiary)]">
            ◢ INGEST
          </span>
          <h2 className="mb-3 text-[28px] font-normal tracking-[-.03em] text-[var(--text)]">
            Three files. One defensible close.
          </h2>
          <p className="mx-auto max-w-[540px] text-[13px] leading-relaxed text-[var(--text-secondary)] max-[700px]:text-xs">
            Seed {CLI_PREVIEW.status.seed}: {CLI_PREVIEW.status.payments} payments,{" "}
            {CLI_PREVIEW.status.settlements} settlements, {CLI_PREVIEW.status.bank} bank credits —
            joined on UTR, amount, date, fee, and tax before any model is called.
          </p>
        </div>
        <div
          className={`sc-story-app ${copyClass} absolute left-[max(24px,6vw)] top-[42%] z-[4] max-w-[330px] text-left max-[900px]:left-5 max-[900px]:right-5 max-[900px]:top-auto max-[900px]:bottom-8 max-[900px]:max-w-none max-[900px]:text-center`}
        >
          <span className="mb-4 block font-mono text-[10px] text-[var(--text-tertiary)]">
            ◢ WORKFLOW
          </span>
          <h2 className="mb-3 text-[28px] font-normal tracking-[-.03em] text-[var(--text)]">
            42 clear matches.
            <br />
            Zero LLM calls.
          </h2>
          <p className="text-[13px] leading-relaxed text-[var(--text-secondary)] max-[700px]:text-xs">
            Exact {CLI_PREVIEW.matchSources.exact} · fuzzy {CLI_PREVIEW.matchSources.fuzzy} · split{" "}
            {CLI_PREVIEW.matchSources.split} in {CLI_PREVIEW.metrics.runtimeMs.toFixed(0)}ms. Only
            unresolved pairs reach tier 4 — never guessed into the books.
          </p>
          <button className={actionClass} onClick={goToDashboard}>
            Open match ledger <Arrow />
          </button>
        </div>
        <div
          className={`sc-story-data ${copyClass} absolute right-[max(24px,6vw)] top-[42%] z-[4] max-w-[330px] text-left max-[900px]:left-5 max-[900px]:right-5 max-[900px]:top-auto max-[900px]:bottom-8 max-[900px]:max-w-none max-[900px]:text-center`}
        >
          <span className="mb-4 block font-mono text-[10px] text-[var(--text-tertiary)]">
            ◢ REVIEW
          </span>
          <h2 className="mb-3 text-[28px] font-normal tracking-[-.03em] text-[var(--text)]">
            Exact UTR on bank_0013.
            <br />
            Reasoning stays visible.
          </h2>
          <p className="text-[13px] leading-relaxed text-[var(--text-secondary)] max-[700px]:text-xs">
            Inspector shows pass, confidence, bank credit, settlement, and match reasoning before
            anything is released.
          </p>
          <button className={actionClass} onClick={goToDashboard}>
            Review exceptions <Arrow />
          </button>
        </div>
      </div>
    </section>
  );
}
