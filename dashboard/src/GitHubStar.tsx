import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/base-ui/tooltip";

const REPO_URL = "https://github.com/Annieeeee11/SettleSure";

function StarIcon() {
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
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
}

export default function GitHubStar() {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <a
          className="github-star"
          href={REPO_URL}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Star on GitHub"
        >
          <StarIcon />
        </a>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        <p>Star on GitHub</p>
      </TooltipContent>
    </Tooltip>
  );
}
