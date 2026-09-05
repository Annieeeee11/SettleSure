import { goToLanding } from "./hooks/useRoute";

function ArrowLeftIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M19 12H5" />
      <path d="M12 19l-7-7 7-7" />
    </svg>
  );
}

export default function BackToLanding({
  layout = "fixed",
}: {
  layout?: "fixed" | "inline";
}) {
  return (
    <a
      className={`back-to-landing landing-btn landing-btn-secondary h-9 gap-1.5 px-3 text-[12px] font-medium ${
        layout === "inline" ? "back-to-landing-inline" : ""
      }`}
      href="/"
      aria-label="Back to landing page"
      onClick={(event) => {
        event.preventDefault();
        goToLanding();
      }}
    >
      <ArrowLeftIcon />
      <span>Back</span>
    </a>
  );
}
