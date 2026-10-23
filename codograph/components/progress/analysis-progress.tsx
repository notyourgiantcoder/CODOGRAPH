"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { StateMark } from "@/components/state-mark";
import { STAGES, STALE_AFTER_MS, type Progress } from "@/lib/pipeline/stages";
import { RerunButton } from "./rerun-button";
import { sameProgress, useProgress } from "./use-progress";

type Props = {
  analysisId: string;
  repository: { owner: string; name: string };
  commitSha: string | null;
  initial: Progress;
  /** Worked out by the server at render; only true while nothing has moved since. */
  staleAtRender: boolean;
  /** Formatted by the server, so the browser renders the text it was sent. */
  started: { iso: string; ago: string } | null;
};

type Step = "done" | "current" | "failed" | "stale" | "pending";

export function AnalysisProgress({ analysisId, repository, commitSha, initial, staleAtRender, started }: Props) {
  const { progress, lost, restarted } = useProgress(analysisId, initial);
  const router = useRouter();

  // Stored is the last stage; once it lands the server has a map to render at
  // this same address, so the page is re-rendered into it.
  const complete = progress.status === "complete";
  useEffect(() => {
    if (complete) router.refresh();
  }, [complete, router]);
  const stale = staleAtRender && sameProgress(progress, initial);
  const current = STAGES.findIndex((s) => s.stage === progress.stage);
  const canRerun = stale || progress.status === "complete" || progress.status === "failed";

  const step = (i: number): Step => {
    if (progress.status === "complete") return "done";
    if (progress.status === "queued" || current === -1 || i > current) return "pending";
    if (i < current) return "done";
    if (progress.status === "failed") return "failed";
    return stale ? "stale" : "current";
  };

  return (
    <div className="relative flex-1 overflow-y-auto">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[360px] overflow-hidden" aria-hidden>
        <div className="grid-backdrop noise-fade absolute inset-0" />
      </div>
      <div className="relative mx-auto max-w-2xl px-4 py-14 sm:px-6">
        <div className="panel-shadow overflow-hidden rounded-2xl border border-line-strong bg-panel">
          <div className="flex flex-wrap items-center gap-3 border-b border-line bg-toolbar px-5 py-3.5">
            <h1 className="min-w-0 truncate font-mono text-[14px]">
              <span className="text-subtle">{repository.owner}/</span>
              <span className="text-fg">{repository.name}</span>
            </h1>
            {commitSha && (
              <span className="rounded-md border border-line px-1.5 py-0.5 font-mono text-[10.5px] text-subtle" title={commitSha}>
                {commitSha.slice(0, 7)}
              </span>
            )}
            <span className="inline-flex items-center gap-1.5 rounded-full border border-line-strong px-2 py-0.5 text-[12px] text-fg">
              <StateMark status={progress.status} stale={stale} />
              {stale ? "stale" : progress.status}
            </span>
            <span className="ml-auto">{canRerun && <RerunButton analysisId={analysisId} onStarted={restarted} />}</span>
          </div>

          <ol className="px-5 py-5">
            {STAGES.map(({ stage, label }, i) => {
              const state = step(i);
              const detail = state === "current" || state === "failed" || state === "stale" ? progress.message : null;
              return (
                <li key={stage} className="relative flex gap-3.5 pb-5 last:pb-0">
                  {i < STAGES.length - 1 && <span className="absolute left-[11px] top-7 bottom-1 w-px bg-line-strong" aria-hidden />}
                  <span
                    className={`relative flex size-6 shrink-0 items-center justify-center rounded-full border ${
                      state === "current"
                        ? "border-violet-soft/60 bg-tint-violet text-violet-soft shadow-[0_0_20px_-4px_rgba(139,92,246,0.7)]"
                        : state === "pending"
                          ? "border-line text-subtle"
                          : "border-line-strong bg-ink/[0.04] text-fg"
                    }`}
                  >
                    <StepMark state={state} />
                  </span>
                  <div className="min-w-0 pt-0.5">
                    <p className={`text-[13.5px] font-medium ${state === "pending" ? "text-subtle" : "text-fg"}`}>{label}</p>
                    {detail && <p className={`mt-0.5 text-[12.5px] ${state === "failed" ? "text-fg" : "text-muted"}`}>{detail}</p>}
                  </div>
                </li>
              );
            })}
          </ol>

          {(stale || (complete && progress.message) || lost) && (
            <div className="border-t border-line px-5 py-3.5 text-[12.5px]">
              {stale && (
                <p className="text-muted">
                  No progress for over {STALE_AFTER_MS / 60000} minutes
                  {started && (
                    <>
                      {" "}
                      since it started{" "}
                      <time dateTime={started.iso} title={started.iso}>
                        {started.ago}
                      </time>
                    </>
                  )}
                  . The process running it has most likely stopped; re-run to start again.
                </p>
              )}
              {complete && progress.message && <p className="text-fg">{progress.message} — opening the map…</p>}
              {lost && <p className="text-fg">Live updates stopped ({lost}). Reload to see where the run is.</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StepMark({ state }: { state: Step }) {
  switch (state) {
    case "done":
      return <StateMark status="complete" />;
    case "current":
      return <StateMark status="running" />;
    case "stale":
      return <StateMark status="running" stale />;
    case "failed":
      return <StateMark status="failed" />;
    case "pending":
      return <StateMark status="queued" />;
  }
}
