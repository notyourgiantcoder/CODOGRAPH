"use client";

import { Loader2, RefreshCw, Sparkles, TriangleAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import type { ExplainResult } from "@/app/(workspace)/analyses/[id]/actions";
import { Button } from "@/components/ui/primitives";
import { railLabel } from "@/lib/roles";
import { ExplanationText } from "./explanation-text";
import { RerunButton } from "./progress/rerun-button";

export type ExplainTarget = { kind: "file"; path: string } | { kind: "group"; dir: string };

export function targetKey(target: ExplainTarget): string {
  return target.kind === "file" ? `file:${target.path}` : `group:${target.dir}`;
}

export type ExplanationState =
  | { status: "loading" }
  | { status: "error"; error: string }
  | { status: "done"; result: Extract<ExplainResult, { ok: true }> };

/** Whether what was explained is still what the repository holds. */
export type Freshness =
  | { status: "checking" }
  | { status: "current" }
  /** The repository has moved past the analysed commit. For a file, what became of it; a folder has no single hash to compare. */
  | { status: "moved"; head: string; file: "unchanged" | "changed" | "deleted" | null }
  | { status: "unknown"; error: string };

export function ExplanationPanel(props: {
  target: ExplainTarget;
  analysisId: string;
  commitSha: string;
  state: ExplanationState | undefined;
  freshness: Freshness | undefined;
  onExplain: (target: ExplainTarget) => void;
  isPath: (path: string) => boolean;
  renderPath: (path: string) => ReactNode;
}) {
  const { target, state } = props;
  const what = target.kind === "file" ? "this file" : "this folder";

  if (!state) {
    return (
      <div className="rounded-xl border border-dashed border-line-strong bg-ink/[0.015] p-3.5">
        <p className="text-[12.5px] leading-relaxed text-muted">
          {target.kind === "file"
            ? "A model writes this from the file's source and every file it imports or is imported by, as parsed. Nothing it says adds a connection."
            : "A model writes this from what's in this folder and every import crossing into or out of it, as parsed."}
        </p>
        <Button size="sm" className="mt-3" onClick={() => props.onExplain(target)}>
          <Sparkles className="size-3.5" aria-hidden />
          Explain {what}
        </Button>
      </div>
    );
  }
  if (state.status === "loading") {
    return (
      <p className="flex items-center gap-2 text-[12.5px] text-muted">
        <Loader2 className="size-3.5 animate-spin text-violet-soft" aria-hidden />
        Explaining {what}
        <span className="inline-flex gap-0.5" aria-hidden>
          <span className="animate-dot">.</span>
          <span className="animate-dot [animation-delay:150ms]">.</span>
          <span className="animate-dot [animation-delay:300ms]">.</span>
        </span>
      </p>
    );
  }
  if (state.status === "error") {
    return (
      <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.05] p-3.5 text-[12.5px]">
        <p className="flex items-center gap-2 font-medium text-fg">
          <TriangleAlert className="size-3.5 text-amber-500" aria-hidden />
          Couldn&apos;t explain {what}.
        </p>
        <p className="mt-1 break-words text-muted">{state.error}</p>
        <Button size="sm" variant="secondary" className="mt-3" onClick={() => props.onExplain(target)}>
          <RefreshCw className="size-3.5" aria-hidden />
          Try again
        </Button>
      </div>
    );
  }

  const { result } = state;
  return (
    <div>
      <FreshnessNote freshness={props.freshness} target={target} analysisId={props.analysisId} commitSha={props.commitSha} />
      <ExplanationText text={result.body} isPath={props.isPath} onPath={props.renderPath} />
      <div className="mt-3 space-y-0.5 border-t border-line pt-2 text-[10.5px] text-subtle">
        {result.labelled && (
          <p>
            {result.labelled.role === null
              ? "No convention identified this file, and the model found no role that fits."
              : `No convention identified this file; the model labelled it ${railLabel(result.labelled.role).toLowerCase()}.`}
          </p>
        )}
        {result.labelError && <p>Labelling this file failed: {result.labelError}</p>}
        <p>
          <span className="font-mono">{result.model}</span> · {result.cached ? "from cache, no model call" : "new answer"}
        </p>
        <p>{result.tracing.on ? `Traced to LangSmith project ${result.tracing.project}` : `Not traced: ${result.tracing.reason}`}</p>
      </div>
    </div>
  );
}

function FreshnessNote(props: { freshness: Freshness | undefined; target: ExplainTarget; analysisId: string; commitSha: string }) {
  const router = useRouter();
  const f = props.freshness;
  if (!f || f.status === "current") return null;
  const analysed = <span className="font-mono">{props.commitSha.slice(0, 7)}</span>;
  if (f.status === "checking") {
    return <p className="mb-2 text-[10.5px] text-subtle">Checking the repository for newer commits…</p>;
  }
  if (f.status === "unknown") {
    return <p className="mb-2 text-[10.5px] text-subtle">Couldn&apos;t check whether this is still current: {f.error}</p>;
  }
  const head = <span className="font-mono">{f.head.slice(0, 7)}</span>;
  let sentence: ReactNode;
  if (f.file === "changed") sentence = <>This file has changed since {analysed} was analysed, so this explanation is stale. The repository is at {head}.</>;
  else if (f.file === "deleted") sentence = <>This file no longer exists at {head}, the repository&apos;s latest commit. {analysed} was analysed.</>;
  else if (f.file === "unchanged")
    sentence = <>The repository has moved past {analysed} to {head}. This file is unchanged, but its neighbours may not be.</>;
  else sentence = <>The repository has moved past {analysed} to {head}, so this explanation may be stale.</>;
  return (
    <div className="mb-3 rounded-lg border border-line bg-ink/[0.02] px-3 py-2 text-[12px] text-muted">
      <p>{sentence}</p>
      <div className="mt-2">
        <RerunButton analysisId={props.analysisId} label="Re-analyse" onStarted={() => router.refresh()} />
      </div>
    </div>
  );
}
