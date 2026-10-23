import type { ReactNode } from "react";
import { Wordmark } from "./brand";

// The landing page's hero backdrop around sign-in and first-run setup.
export function AuthFrame({ children, caption }: { children: ReactNode; caption: string }) {
  return (
    <div className="relative flex flex-1 flex-col items-center justify-center overflow-hidden px-4 py-12">
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="grid-backdrop noise-fade absolute inset-0" />
        <div className="absolute left-1/2 top-1/3 h-[520px] w-[900px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(139,92,246,0.22),transparent)]" />
        <div className="absolute left-1/2 top-2/3 h-[300px] w-[560px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(103,213,255,0.12),transparent)]" />
      </div>
      <div className="relative flex flex-col items-center">
        <Wordmark />
        <p className="mt-3 text-center font-mono text-[11px] uppercase tracking-[0.2em] text-violet-soft">{caption}</p>
        <div className="mt-8">{children}</div>
      </div>
    </div>
  );
}
