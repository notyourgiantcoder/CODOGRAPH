"use client";

import { ChevronDown, GitBranch, Lightbulb, MousePointerClick } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useMemo, useState, type ReactNode } from "react";
import { SectionLabel } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";
import { rankRepository, SUMMARY_LIMIT } from "@/lib/graph/detail";
import { findInsights, INSIGHT_SENTENCES, type Cycle } from "@/lib/graph/insights";
import type { ParsedFile } from "@/lib/parser/types";
import { useWorkspace } from "./context";
import { NeighbourIcon, PathButton, Stat } from "./inspector";

// What the inspector shows with nothing selected: the repository in numbers,
// where to start reading, and the four facts the import graph turns up.
export function RepositoryOverview({ className }: { className?: string }) {
  const { files, edges, repository, routes, commitSha, names, reveal } = useWorkspace();
  const ranked = useMemo(() => rankRepository(files), [files]);
  const insights = useMemo(() => findInsights(files, edges), [files, edges]);
  // Distinct file-to-file imports, the unit every file's own counts use.
  const imports = useMemo(() => files.reduce((n, f) => n + f.fanOut, 0), [files]);
  const frameworks = repository.projects.filter((p) => p.adapter !== "none");
  const picks = ranked.mostDependedOn.files.slice(0, 3);

  return (
    <div className={cn("scrollbar-thin h-full min-h-0 overflow-y-auto", className)}>
      <div className="space-y-3 border-b border-line p-4">
        <div className="flex items-start gap-3">
          <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl bg-ink/[0.05] text-muted shadow-[inset_0_0_0_1px_var(--line-strong)]">
            <GitBranch className="size-4" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-[15px] font-semibold tracking-tight text-fg">
              <span className="text-muted">{repository.owner}/</span>
              {repository.name}
            </h3>
            <p className="mt-0.5 font-mono text-[11px] text-subtle">
              {commitSha.slice(0, 7)} ·{" "}
              {frameworks.length === 0 ? "no framework detected" : frameworks.map((p) => (p.path === "." ? p.adapter : `${p.adapter} in ${p.path}/`)).join(", ")}
            </p>
          </div>
        </div>
        <dl className="grid grid-cols-4 gap-1.5">
          <Stat label="Files" value={files.length} hint={repository.skipped > 0 ? `${repository.skipped} more skipped` : "Every file was parsed"} />
          <Stat label="Imports" value={imports} hint="Distinct file-to-file imports resolved inside the repository" />
          <Stat label="Network" value={repository.fetches.matched} hint="fetch() calls matched to the route they reach" />
          <Stat label="Routes" value={routes.length} hint="Routes whose method and full path are written in the code" />
        </dl>
        {(repository.skipped > 0 || repository.unresolved > 0) && (
          <p className="text-[11px] text-subtle">
            {[
              repository.skipped > 0 && `${repository.skipped} files skipped`,
              repository.unresolved > 0 && `${repository.unresolved} imports unresolved`,
              repository.fetches.unresolved.length > 0 && `${repository.fetches.unresolved.length} fetch() calls unresolved`,
            ]
              .filter(Boolean)
              .join(" · ")}
            . Nothing is drawn for them.
          </p>
        )}
      </div>

      <div className="space-y-5 p-4">
        {picks.length > 0 && (
          <section>
            <SectionLabel>Start here</SectionLabel>
            <div className="flex flex-wrap gap-1.5">
              {picks.map((f) => (
                <button
                  key={f.path}
                  type="button"
                  onClick={() => reveal(f.path)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-line-strong px-2.5 py-1 font-mono text-[11px] text-muted transition hover:bg-ink/[0.05] hover:text-fg"
                >
                  <NeighbourIcon path={f.path} size="xs" />
                  {names.get(f.path) ?? f.path}
                </button>
              ))}
            </div>
            <p className="mt-2 flex items-center gap-1.5 text-[11.5px] text-subtle">
              <MousePointerClick className="size-3.5" aria-hidden />
              Or click any folder on the map to open it.
            </p>
          </section>
        )}

        <RankedList
          title="Most depended on"
          files={ranked.mostDependedOn.files}
          total={ranked.mostDependedOn.total}
          figure={(f) => <span className="text-violet-soft">←{f.fanIn}</span>}
        />
        <RankedList
          title="Imported by nothing · where reading starts"
          files={ranked.unimported.files}
          total={ranked.unimported.total}
          figure={(f) => <span className="text-cyan">{f.fanOut}→</span>}
        />

        <section className="rounded-xl border border-line bg-ink/[0.015]">
          <p className="flex items-center gap-2 border-b border-line px-3 py-2 text-[12px] font-medium text-fg">
            <Lightbulb className="size-3.5 text-violet-soft" aria-hidden />
            Insights
            <span className="font-normal text-subtle">facts from the import graph</span>
          </p>
          <Insight title="Nothing imports or reaches" sentence={INSIGHT_SENTENCES.unimported} items={insights.unimported} render={(f) => <FileRow key={f.path} file={f} figure={<span className="text-cyan">{f.fanOut}→</span>} />} />
          <Insight
            title={`Imported by more than ${insights.heavilyImported.threshold}`}
            sentence={INSIGHT_SENTENCES.heavilyImported}
            items={insights.heavilyImported.files}
            render={(f) => <FileRow key={f.path} file={f} figure={<span className="text-violet-soft">←{f.fanIn}</span>} />}
          />
          <Insight title="Import loops" sentence={INSIGHT_SENTENCES.cycles} items={insights.cycles} render={(c) => <CycleRows key={c.files[0]} cycle={c} />} />
          <Insight
            title="Long files"
            sentence={INSIGHT_SENTENCES.long}
            items={insights.long}
            render={(f) => <FileRow key={f.path} file={f} figure={<span className="text-subtle">{f.lines.toLocaleString("en")}</span>} />}
          />
        </section>
      </div>
    </div>
  );
}

function RankedList({ title, files, total, figure }: { title: string; files: ParsedFile[]; total: number; figure: (f: ParsedFile) => ReactNode }) {
  return (
    <section>
      <SectionLabel className="flex items-baseline justify-between">
        <span>{title}</span>
        <span className="font-mono normal-case tracking-normal">{total}</span>
      </SectionLabel>
      {files.length === 0 ? (
        <p className="text-[12.5px] text-subtle">None.</p>
      ) : (
        <ul className="space-y-0.5">
          {files.map((f) => (
            <FileRow key={f.path} file={f} figure={figure(f)} />
          ))}
        </ul>
      )}
      {total > files.length && <p className="mt-1 px-1.5 text-[10.5px] text-subtle">{total - files.length} more not listed</p>}
    </section>
  );
}

function FileRow({ file, figure }: { file: ParsedFile; figure: ReactNode }) {
  const { names } = useWorkspace();
  return (
    <li>
      <PathButton path={file.path}>
        <NeighbourIcon path={file.path} size="xs" />
        <span className="truncate font-mono text-[12px] text-fg/90" title={file.path}>
          {names.get(file.path) ?? file.path}
        </span>
        <span className="ml-auto shrink-0 font-mono text-[10.5px] tabular-nums">{figure}</span>
      </PathButton>
    </li>
  );
}

function Insight<T>({ title, sentence, items, render }: { title: string; sentence: string; items: T[]; render: (item: T) => ReactNode }) {
  const [open, setOpen] = useState(false);
  const [all, setAll] = useState(false);
  const shown = all ? items : items.slice(0, SUMMARY_LIMIT);
  return (
    <div className="border-b border-line last:border-b-0">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        disabled={items.length === 0}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] text-fg/90 transition enabled:hover:bg-ink/[0.03] disabled:text-subtle"
      >
        <ChevronDown className={cn("size-3.5 shrink-0 text-subtle transition-transform", open ? "" : "-rotate-90")} aria-hidden />
        <span className="flex-1 truncate">{title}</span>
        <span className="rounded bg-ink/[0.06] px-1 font-mono text-[10px] text-muted">{items.length}</span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
            <p className="px-3 pb-1.5 text-[11.5px] text-subtle">{sentence}</p>
            <ul className="space-y-0.5 px-1.5 pb-2">{shown.map(render)}</ul>
            {items.length > SUMMARY_LIMIT && (
              <button type="button" onClick={() => setAll(!all)} className="px-3 pb-2 text-[11px] font-medium text-violet-soft hover:underline">
                {all ? "Show fewer" : `Show all ${items.length}`}
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// One loop, in import order, so it can be walked by opening each file in turn.
function CycleRows({ cycle }: { cycle: Cycle }) {
  const { byPath } = useWorkspace();
  return (
    <li className="mb-1.5 rounded-lg border border-line bg-ink/[0.015] p-1">
      <p className="px-1.5 pb-0.5 text-[10.5px] text-subtle">
        {cycle.files.length} {cycle.files.length === 1 ? "file" : "files"}
        {cycle.members > cycle.files.length && `, one loop among ${cycle.members} files that all reach each other`}
      </p>
      <ul>
        {cycle.files.map((p, i) => {
          const f = byPath.get(p);
          return f ? <FileRow key={p} file={f} figure={<span className="text-cyan">{i === cycle.files.length - 1 ? "↩ first" : "↓"}</span>} /> : null;
        })}
      </ul>
    </li>
  );
}
