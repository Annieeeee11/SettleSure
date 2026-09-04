import { useState } from "react";
import { PREVIEW } from "@/lib/landingContent";
import CliPreview from "./CliPreview";
import PreviewTabs, { type PreviewTab } from "./PreviewTabs";

export default function LandingPreview() {
  const [preview, setPreview] = useState<PreviewTab>("cli");

  return (
    <section
      className="mx-auto max-w-[1200px] px-6"
      aria-label="Product preview"
    >
      <div className="mb-4 flex justify-center">
        <PreviewTabs preview={preview} onChange={setPreview} />
      </div>
      <div className="overflow-hidden rounded-2xl shadow-[var(--shadow-inset-sm)]">
        {preview === "cli" ? (
          <CliPreview />
        ) : (
          <img
            src={PREVIEW.dashboardImage}
            alt={PREVIEW.dashboardAlt}
            className="block w-full"
          />
        )}
      </div>
      <p className="mt-3.5 text-center text-[0.8125rem] text-[var(--text-tertiary)]">
        {PREVIEW.caption}
      </p>
    </section>
  );
}
