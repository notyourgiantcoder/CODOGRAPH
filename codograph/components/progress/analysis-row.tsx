"use client";

import Link from "next/link";
import { StateMark } from "@/components/state-mark";
import { STALE_AFTER_MS, type Progress } from "@/lib/pipeline/stages";
import { sameProgress, useProgress } from "./use-progress";

export type RowData = {
  id: string;
  repository: { owner: string; name: string } | null;
  commitSha: string | null;
  progress: Progress;
  staleAtRender: boolean;
  // Formatted by the server, so the browser renders the same text it was sent.
  created: { iso: string; ago: string };
  finished: { iso: string; ago: string } | null;
};

// One dashboard row. An unfinished one follows its own channel, so a run
// started in another tab moves here too.
export function AnalysisRow({ row }: { row: RowData }) {
  const { progress } = useProgress(row.id, row.progress);
  const stale = row.staleAtRender && sameProgress(progress, row.progress);
  const finishedNow = !row.finished && (progress.status === "complete" || progress.status === "failed");
  const note = progress.status === "complete" ? null : progress.message;

  return (
    <tr className="border-b border-line align-top transition-colors last:border-b-0 hover:bg-ink/[0.03]">
      <td className="truncate px-4 py-3 font-mono">
        <Link href={`/analyses/${row.id}`} className="block">
          {row.repository ? (
            <>
              <span className="text-subtle">{row.repository.owner}/</span>
              <span className="text-fg">{row.repository.name}</span>
            </>
          ) : (
            <span className="text-fg-muted">—</span>
          )}
          {note && (
            <span className="mt-0.5 block truncate font-sans text-[12px] text-subtle" title={note}>
              {stale ? `No progress for over ${STALE_AFTER_MS / 60000} minutes — ${note}` : note}
            </span>
          )}
        </Link>
      </td>
      <td className="px-4 py-3">
        <span
          // Greyscale, like the mark: violet and cyan mean direction everywhere else.
          className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[12px] ${
            progress.status === "queued" ? "border-line text-subtle" : "border-line-strong bg-ink/[0.03] text-fg"
          }`}
        >
          <StateMark status={progress.status} stale={stale} />
          {stale ? "stale" : progress.status}
          {progress.status === "running" && !stale && progress.stage && (
            <span className="text-subtle">· {progress.stage}</span>
          )}
        </span>
      </td>
      <td className="hidden px-4 py-3 font-mono text-[12px] text-subtle sm:table-cell">
        {row.commitSha ? <span title={row.commitSha}>{row.commitSha.slice(0, 7)}</span> : "—"}
      </td>
      <td className="px-4 py-3 text-right text-[12px] text-subtle tabular-nums">
        <time dateTime={row.created.iso} title={row.created.iso}>
          {row.created.ago}
        </time>
      </td>
      <td className="hidden px-4 py-3 text-right text-[12px] text-subtle tabular-nums sm:table-cell">
        {row.finished ? (
          <time dateTime={row.finished.iso} title={row.finished.iso}>
            {row.finished.ago}
          </time>
        ) : finishedNow ? (
          "just now"
        ) : (
          "—"
        )}
      </td>
    </tr>
  );
}
