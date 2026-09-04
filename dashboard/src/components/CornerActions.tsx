import GitHubStar from "../GitHubStar";
import ThemeToggle from "../ThemeToggle";

interface Props {
  layout?: "fixed" | "inline";
}

export default function CornerActions({ layout = "fixed" }: Props) {
  return (
    <div
      className={
        layout === "fixed"
          ? "corner-actions"
          : "flex items-center gap-2"
      }
    >
      <GitHubStar />
      <ThemeToggle />
    </div>
  );
}
