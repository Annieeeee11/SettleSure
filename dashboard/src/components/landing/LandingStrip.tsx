const STRIP_SRC = "/assets/Multi-Design/hhhhhh.png";

export default function LandingStrip() {
  return (
    <div className="-mt-1 aspect-494/214 w-[min(100vw,88rem)] -translate-x-[clamp(1.25rem,2.5vw,2rem)] overflow-hidden md:-mt-2">
      <img
        className="block h-full w-full object-cover object-[50%_50%] select-none"
        src={STRIP_SRC}
        alt=""
        draggable={false}
        aria-hidden="true"
      />
    </div>
  );
}
