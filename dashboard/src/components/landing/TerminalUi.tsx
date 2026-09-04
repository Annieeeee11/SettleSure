import type { ReactNode } from "react";
import { CLI_WINDOW } from "@/lib/landingContent";

export function TerminalChrome({
  title = CLI_WINDOW.title,
  children,
}: {
  title?: string;
  children: ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-[#0a0c10]">
      <div className="flex items-center gap-1.5 border-b border-zinc-800 px-4 py-3">
        <span className="size-2.5 rounded-full bg-red-500/90" aria-hidden />
        <span className="size-2.5 rounded-full bg-amber-400/90" aria-hidden />
        <span className="size-2.5 rounded-full bg-emerald-500/90" aria-hidden />
        <span className="ml-auto font-mono text-[10px] text-zinc-600">{title}</span>
      </div>
      {children}
    </div>
  );
}

export function TerminalBox({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="mb-3 overflow-hidden rounded border border-zinc-700/70">
      <div className="border-b border-zinc-700/70 px-3 py-1 text-[10px] font-medium text-zinc-500">
        {title}
      </div>
      <div className="space-y-0.5 px-3 py-2">{children}</div>
    </div>
  );
}

export const terminalBodyClass =
  "overflow-x-auto p-4 font-mono text-[0.62rem] leading-relaxed text-zinc-400 sm:p-5 sm:text-[0.68rem]";
