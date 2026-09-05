import { goToDashboard } from "@/hooks/useRoute";
import { Arrow } from "./Shared";

const layerClass =
  "absolute inset-x-[74px] inset-y-[34px] overflow-hidden rounded-landing border border-white/35 bg-[#0a0a0a] [transform-style:preserve-3d] max-[700px]:inset-x-[70px] max-[700px]:inset-y-8";
const copyClass = "absolute z-[4] translate-y-[30px] opacity-0";
const actionClass =
  "landing-btn landing-btn-primary mt-6 px-[17px] py-3 text-xs";

function StackScene() {
  return (
    <div
      className="sc-stack absolute aspect-[1.62] w-[clamp(520px,60vw,760px)] opacity-0 [perspective:1100px] [transform-style:preserve-3d] will-change-transform max-[700px]:w-[500px]"
      aria-hidden="true"
    >
      <div className={`sc-stack-layer sc-layer-1 ${layerClass}`}>
        <img
          className="absolute inset-0 h-full w-full object-cover opacity-45 [filter:saturate(.55)_brightness(.45)]"
          src="/scale-assets/autonomy-street.png"
          alt=""
        />
      </div>
      <div className={`sc-stack-layer sc-layer-2 ${layerClass}`}>
        <img
          className="absolute inset-0 h-full w-full object-cover opacity-50 [filter:saturate(.6)_brightness(.5)]"
          src="/scale-assets/hero.jpg"
          alt=""
        />
        <svg
          className="absolute inset-0 h-full w-full overflow-visible opacity-45"
          viewBox="0 0 600 360"
          preserveAspectRatio="none"
        >
          <g
            fill="none"
            stroke="rgba(255,255,255,.52)"
            strokeWidth="1"
            strokeDasharray="2 3"
            vectorEffect="non-scaling-stroke"
          >
            <path d="M-20 286 C72 252 76 314 151 273 S263 212 326 255 458 301 631 184" />
            <path d="M-12 96 C90 133 109 53 193 91 S310 171 382 122 508 47 623 83" />
            <path d="M20 222 C93 178 140 204 196 180 S325 116 389 171 516 236 604 205" />
          </g>
        </svg>
      </div>
      <div className={`sc-stack-layer sc-layer-3 ${layerClass} bg-[#111]`}>
        <img
          className="sc-stack-media sc-stack-street absolute inset-0 h-full w-full object-cover opacity-[.82] [filter:saturate(.72)_brightness(.68)]"
          src="/scale-assets/autonomy-street.png"
          alt=""
        />
        <video
          className="sc-stack-media sc-stack-people absolute inset-0 h-full w-full object-cover opacity-0 [filter:saturate(.72)_brightness(.68)]"
          src="/scale-assets/people.mp4"
          muted
          loop
          playsInline
          autoPlay
        />
        <img
          className="theme-dashboard-light sc-stack-media sc-stack-dashboard absolute inset-0 h-full w-full object-cover object-left-top opacity-0 [filter:saturate(.72)_brightness(.68)]"
          src="/ness/dashboad-light.png"
          alt=""
        />
        <img
          className="theme-dashboard-dark sc-stack-media sc-stack-dashboard absolute inset-0 h-full w-full object-cover object-left-top opacity-0 [filter:saturate(.72)_brightness(.68)]"
          src="/ness/dashboad-dak.png"
          alt=""
        />
      </div>
      <div className={`sc-stack-layer sc-layer-4 ${layerClass}`}>
        <img
          className="absolute inset-0 h-full w-full object-cover opacity-40 [filter:saturate(.55)_brightness(.48)]"
          src="/scale-assets/numbers.png"
          alt=""
        />
        <svg
          className="absolute inset-0 h-full w-full overflow-visible opacity-40"
          viewBox="0 0 600 360"
          preserveAspectRatio="none"
        >
          <g fill="none" stroke="rgba(255,255,255,.52)" strokeWidth="1" vectorEffect="non-scaling-stroke">
            <path d="M6 61 L92 61 Q118 61 118 89 L118 139 Q118 165 148 165 L246 165 Q273 165 273 191 L273 252 Q273 278 304 278 L589 278" />
            <path d="M14 312 L92 312 Q122 312 122 284 L122 239 Q122 214 152 214 L352 214 Q381 214 381 185 L381 111 Q381 84 411 84 L590 84" />
            <path d="M8 123 L67 123 Q94 123 94 151 L94 183 Q94 210 124 210 L214 210" />
          </g>
        </svg>
      </div>
      <div className={`sc-stack-layer sc-layer-5 ${layerClass}`}>
        <img
          className="absolute inset-0 h-full w-full object-cover opacity-35 [filter:saturate(.5)_brightness(.42)]"
          src="/scale-assets/autonomy-street.png"
          alt=""
        />
      </div>
      <span className="absolute left-[55px] top-[18px] font-mono text-[8px] text-neutral-500">0011</span>
      <span className="absolute right-[45px] top-1/2 font-mono text-[8px] text-neutral-500">01001</span>
      <span className="absolute bottom-[35px] left-[35%] font-mono text-[8px] text-neutral-500">011</span>
    </div>
  );
}

export default function DepthStory() {
  return (
    <section
      id="platform"
      className="sc-story landing-section relative h-[440vh] overflow-x-clip max-[700px]:h-[390vh]"
    >
      <div className="sticky top-0 flex h-screen min-h-[720px] items-center justify-center overflow-hidden [perspective:1200px]">
        <StackScene />
        <div
          className={`sc-story-intro ${copyClass} top-[72%] w-[520px] text-center max-[700px]:top-[69%] max-[700px]:w-full`}
        >
          <h2 className="mb-3 text-[28px] font-normal tracking-[-.03em]">Three files. One defensible close.</h2>
          <p className="mx-auto max-w-[620px] text-[13px] leading-relaxed text-[var(--text-secondary)] max-[700px]:px-5 max-[700px]:text-xs">
            SettleSure reconciles payment exports, settlement files, and bank credits by UTR, amount, date, fee, and tax.
          </p>
        </div>
        <div
          className={`sc-story-app ${copyClass} left-[8%] top-[42%] text-left max-[700px]:inset-x-6 max-[700px]:top-[70%] max-[700px]:text-center`}
        >
          <span className="mb-6 block font-mono text-[10px] text-[var(--text-tertiary)]">◢ WORKFLOW</span>
          <h2 className="mb-3 text-[28px] font-normal tracking-[-.03em]">
            Clear matches never
            <br />
            touch a model.
          </h2>
          <p className="max-w-[330px] text-[13px] leading-relaxed text-[var(--text-secondary)] max-[700px]:mx-auto">
            Exact, fuzzy, and split matching resolve safe pairs in milliseconds. Ambiguous rows are deferred instead of
            guessed.
          </p>
          <button className={actionClass} onClick={goToDashboard}>
            Open Dashboard <Arrow />
          </button>
        </div>
        <div
          className={`sc-story-data ${copyClass} right-[7%] top-[42%] text-left max-[700px]:inset-x-6 max-[700px]:top-[70%] max-[700px]:text-center`}
        >
          <span className="mb-6 block font-mono text-[10px] text-[var(--text-tertiary)]">◢ REVIEW</span>
          <h2 className="mb-3 text-[28px] font-normal tracking-[-.03em]">
            Every exception shows
            <br />
            what is at risk.
          </h2>
          <p className="max-w-[330px] text-[13px] leading-relaxed text-[var(--text-secondary)] max-[700px]:mx-auto">
            Inspect match reasoning, review ₹ at risk, accept or reject corrections, and keep a complete audit trail.
          </p>
          <button className={actionClass} onClick={goToDashboard}>
            Review Exceptions <Arrow />
          </button>
        </div>
      </div>
    </section>
  );
}
