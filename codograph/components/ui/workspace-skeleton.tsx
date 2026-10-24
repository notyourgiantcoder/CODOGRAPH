import { Loader2 } from "lucide-react";

// The workspace's own shape, drawn while its data loads, so the page holds
// still and arrives into the panels it was already showing. A large
// repository takes seconds to read, and a blank page reads as broken.
export function WorkspaceSkeleton({ message }: { message: string }) {
  const bar = "animate-pulse rounded-md bg-ink/[0.06]";
  return (
    <div className="relative flex min-h-0 flex-1 flex-col px-3 pb-3 pt-4 sm:px-4 sm:pb-4" aria-busy="true" aria-live="polite">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[420px] overflow-hidden" aria-hidden>
        <div className="grid-backdrop noise-fade absolute inset-0" />
        <div className="absolute left-1/2 top-[-160px] h-[420px] w-[900px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(139,92,246,0.2),transparent)]" />
      </div>
      <div className="panel-shadow relative mx-auto flex min-h-[560px] w-full max-w-[1440px] flex-1 flex-col overflow-hidden rounded-2xl border border-line-strong bg-panel">
        <div className="flex flex-col gap-3 border-b border-line bg-toolbar p-3 sm:px-4">
          <div className="flex items-center gap-2">
            <div className={`${bar} h-9 w-72`} />
            <div className="ml-auto flex gap-2">
              <div className={`${bar} h-9 w-[300px]`} />
              <div className={`${bar} h-9 w-28`} />
            </div>
          </div>
          <div className="flex gap-1.5">
            {[44, 96, 88, 112, 80, 104].map((w, i) => (
              <div key={i} className={`${bar} h-7 rounded-full`} style={{ width: w }} />
            ))}
          </div>
        </div>
        <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[250px_minmax(0,1fr)_400px]">
          <div className="hidden flex-col gap-2 border-r border-line bg-sidebar p-3 lg:flex">
            <div className={`${bar} h-12`} />
            {Array.from({ length: 9 }, (_, i) => (
              <div key={i} className={`${bar} h-5`} style={{ width: `${60 + ((i * 37) % 35)}%` }} />
            ))}
          </div>
          <div className="flex items-center justify-center bg-bg">
            <p className="flex items-center gap-2.5 rounded-xl border border-line-strong bg-panel/90 px-4 py-2.5 text-[13px] text-muted shadow-xl shadow-black/20">
              <Loader2 className="size-4 animate-spin text-violet-soft" aria-hidden />
              {message}
            </p>
          </div>
          <div className="hidden flex-col gap-3 border-l border-line bg-sidebar p-4 lg:flex">
            <div className={`${bar} h-8`} />
            <div className={`${bar} h-14`} />
            <div className="grid grid-cols-4 gap-1.5">
              {Array.from({ length: 4 }, (_, i) => (
                <div key={i} className={`${bar} h-12`} />
              ))}
            </div>
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className={`${bar} h-5`} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
