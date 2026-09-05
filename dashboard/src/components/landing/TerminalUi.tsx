import type { ReactNode } from "react";
import { CLI_WINDOW } from "@/lib/landingContent";

export function TerminalChrome({
  title = CLI_WINDOW.title,
  children,
  compact = false,
}: {
  title?: string;
  children: ReactNode;
  compact?: boolean;
}) {
  return (
    <div
      className={`overflow-hidden border border-zinc-800 bg-[#0a0c10] ${
        compact ? "rounded-xl" : "rounded-2xl"
      }`}
    >
      <div
        className={`flex items-center gap-1.5 border-b border-zinc-800 px-3 ${
          compact ? "py-2" : "px-4 py-3"
        }`}
      >
        <span className={`rounded-full bg-red-500/90 ${compact ? "size-2" : "size-2.5"}`} aria-hidden />
        <span className={`rounded-full bg-amber-400/90 ${compact ? "size-2" : "size-2.5"}`} aria-hidden />
        <span className={`rounded-full bg-emerald-500/90 ${compact ? "size-2" : "size-2.5"}`} aria-hidden />
        <span className={`ml-auto font-mono text-zinc-600 ${compact ? "text-[9px]" : "text-[10px]"}`}>
          {title}
        </span>
      </div>
      {children}
    </div>
  );
}

export function TerminalBox({
  title,
  children,
  compact = false,
}: {
  title: string;
  children: ReactNode;
  compact?: boolean;
}) {
  return (
    <div className={`overflow-hidden rounded border border-zinc-700/70 ${compact ? "mb-2" : "mb-3"}`}>
      <div
        className={`border-b border-zinc-700/70 px-2.5 font-medium text-zinc-500 ${
          compact ? "py-0.5 text-[9px]" : "px-3 py-1 text-[10px]"
        }`}
      >
        {title}
      </div>
      <div className={`space-y-0.5 ${compact ? "px-2.5 py-1.5" : "px-3 py-2"}`}>{children}</div>
    </div>
  );
}

export const terminalBodyClass =
  "overflow-x-auto p-4 font-mono text-[0.62rem] leading-relaxed text-zinc-400 sm:p-5 sm:text-[0.68rem]";

export const terminalBodyCompactClass =
  "overflow-x-auto p-3 font-mono text-[0.54rem] leading-[1.45] text-zinc-400 sm:p-3.5 sm:text-[0.58rem]";
