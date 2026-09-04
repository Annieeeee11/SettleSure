import { Link } from "react-router-dom";

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

export default function BackToLanding() {
  return (
    <Link className="back-to-landing" to="/" aria-label="Back to landing page">
      <ArrowLeftIcon />
      <span>Back</span>
    </Link>
  );
}
