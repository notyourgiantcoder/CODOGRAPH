import type { ReactNode } from "react";

// A page that couldn't show what was asked for, in the landing page's card.
export function Problem({ icon, title, children, actions }: { icon: ReactNode; title: string; children: ReactNode; actions: ReactNode }) {
  return (
    <div className="relative flex flex-1 items-center justify-center px-4 py-16">
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="grid-backdrop noise-fade absolute inset-0" />
      </div>
      <div className="panel-shadow relative w-full max-w-md rounded-2xl border border-line-strong bg-panel p-6 text-center">
        <div className="mx-auto flex size-11 items-center justify-center rounded-xl border border-line-strong bg-ink/[0.03] text-muted">{icon}</div>
        <h1 className="mt-4 text-[17px] font-semibold tracking-tight text-fg">{title}</h1>
        <div className="mt-1.5 text-[13.5px] leading-relaxed text-muted">{children}</div>
        <div className="mt-5 flex flex-wrap justify-center gap-2">{actions}</div>
      </div>
    </div>
  );
}
