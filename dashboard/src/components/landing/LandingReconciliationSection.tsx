const MATCH_TICKET_SRC = "/assets/Multi-Design/5removebg-preview.png";
const EXCEPTION_TICKET_SRC = "/assets/Multi-Design/cutticket.png";

const captionClassName =
  "m-0 font-landing-mono text-[clamp(0.625rem,1.1vw,0.75rem)] uppercase leading-[1.55] tracking-[0.05em] text-landing-dim";

const accentBarClassName =
  "mt-2 block h-px w-[clamp(3.5rem,8vw,5rem)] bg-landing-accent";

const bleedClassName =
  "w-[min(100vw,88rem)] -translate-x-[clamp(1.25rem,2.5vw,2rem)] overflow-hidden";

function Caption({
  lines,
  align = "left",
}: {
  lines: string[];
  align?: "left" | "right";
}) {
  return (
    <div className={align === "right" ? "text-right" : undefined}>
      <p className={captionClassName}>
        {lines.map((line, index) => (
          <span key={line}>
            {line}
            {index < lines.length - 1 ? <br /> : null}
          </span>
        ))}
      </p>
      <span
        className={`${accentBarClassName}${align === "right" ? " ml-auto" : ""}`}
        aria-hidden="true"
      />
    </div>
  );
}

export default function LandingReconciliationSection() {
  return (
    <section
      aria-label="Reconciliation outcomes"
      className="-mt-1 md:-mt-2"
    >
      <div className="px-[clamp(1.25rem,2.5vw,2rem)]">
        <div className="pl-[clamp(0.25rem,1.5vw,1rem)]">
          <Caption
            lines={["FIELDS ALIGN.", "AMOUNTS AGREE.", "TRUTH EMERGES."]}
          />
        </div>
      </div>

      <div className={`${bleedClassName} -mt-2 aspect-483/202 md:-mt-3`}>
        <img
          className="block h-full w-full object-cover object-[50%_46%] select-none"
          src={MATCH_TICKET_SRC}
          alt=""
          draggable={false}
          aria-hidden="true"
        />
      </div>

      <div className="grid gap-3 px-[clamp(1.25rem,2.5vw,2rem)] md:grid-cols-[1fr_auto] md:items-end md:gap-4">
        <div className="hidden pl-[clamp(0.25rem,1.5vw,1rem)] md:block md:pl-0 md:col-start-2">
          <Caption align="right" lines={["CLEAN. PRECISE.", "CLOSED."]} />
        </div>
      </div>

      <div className={`${bleedClassName} -mt-3 aspect-765/310 md:-mt-4`}>
        <img
          className="block h-full w-full object-cover object-top select-none"
          src={EXCEPTION_TICKET_SRC}
          alt=""
          draggable={false}
          aria-hidden="true"
        />
      </div>

      <div className="px-[clamp(1.25rem,2.5vw,2rem)]">
        <div className="pl-[clamp(0.25rem,1.5vw,1rem)]">
          <Caption
            lines={[
              "WHEN IT DOESN'T CLOSE,",
              "HUMANS STEP IN.",
              "EVERY ACTION IS RECORDED.",
            ]}
          />
        </div>
      </div>
    </section>
  );
}
