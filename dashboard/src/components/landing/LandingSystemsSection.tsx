const SYSTEMS_IMAGE_SRC = "/assets/Multi-Design/2removebg-preview.png";

const headlineClassName =
  "font-landing-serif text-[clamp(2.5rem,12vw,4.5rem)] font-light uppercase leading-[0.94] tracking-[-0.02em] md:text-[clamp(3.25rem,9.2vw,7.25rem)] md:leading-[0.92]";

export default function LandingSystemsSection() {
  return (
    <section aria-label="Payment settlement bank systems" className="-mt-[clamp(2.5rem,6vh,4rem)] md:-mt-[clamp(3rem,7vh,4.5rem)]">
      <div className="grid pl-[clamp(0.25rem,1.5vw,1rem)] md:grid-cols-[minmax(0,1fr)_auto] md:grid-rows-3 md:items-center">
        <h2 className="contents mb-50">
          <span className={`col-start-1 row-start-1 block text-landing-light ${headlineClassName}`}>
            PAYMENT /
          </span>
          <span className={`col-start-1 row-start-2 block text-landing-light ${headlineClassName}`}>
            SETTLEMENT /
          </span>
          <span className={`col-start-1 row-start-3 block text-landing-dim ${headlineClassName}`}>
            BANK
          </span>
        </h2>

        <div className="col-start-1 row-start-4 mt-6 md:col-start-2 md:row-span-2 md:row-start-2 md:mt-0 md:justify-self-end md:text-right">
          <p className="m-0 font-landing-mono text-[clamp(0.75rem,1.4vw,0.9375rem)] uppercase leading-[1.55] tracking-[0.06em] text-landing-dim">
            THREE SYSTEMS.
            <br />
            ONE TRUTH.
          </p>
          <span
            className="mt-3 block h-px w-[clamp(3.5rem,8vw,5rem)] bg-landing-accent md:ml-auto"
            aria-hidden="true"
          />
        </div>
      </div>

      <div className="-mt-2 aspect-496/216 w-[min(100vw,88rem)] -translate-x-[clamp(1.25rem,2.5vw,2rem)] overflow-hidden md:-mt-3">
        <img
          className="block h-full w-full object-cover object-[50%_44%] select-none"
          src={SYSTEMS_IMAGE_SRC}
          alt=""
          draggable={false}
          aria-hidden="true"
        />
      </div>
    </section>
  );
}
