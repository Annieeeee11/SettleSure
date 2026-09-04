const FOOTER_RECEIPT_SRC = "/assets/Multi-Design/4image.png";

export default function LandingFooterReceipt() {
  return (
    <div className="aspect-[484/126] w-[min(100vw,88rem)] -translate-x-[clamp(1.25rem,2.5vw,2rem)] overflow-hidden">
      <img
        className="block h-full w-full object-cover object-[50%_46%] select-none"
        src={FOOTER_RECEIPT_SRC}
        alt=""
        draggable={false}
        aria-hidden="true"
      />
    </div>
  );
}
