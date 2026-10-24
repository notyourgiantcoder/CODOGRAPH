"use client";

import { AnimatePresence, motion } from "motion/react";
import { ArrowDownRight, ArrowUpLeft, Crosshair, ExternalLink, FileWarning, FolderOpen, Loader2, LogIn, MousePointerClick } from "lucide-react";
import { useEffect, useId, useMemo, useState, type ReactNode } from "react";
import { fileSourceAction, type FileSource } from "@/app/(workspace)/analyses/[id]/actions";
import { ExplanationPanel, targetKey, type ExplainTarget } from "@/components/explanation-panel";
import { CodeBlock } from "@/components/ui/code-block";
import { AnimatedNumber, CopyButton, CopyLinkButton, IconButton, IconLink, SectionLabel } from "@/components/ui/primitives";
import { RoleIcon } from "@/components/ui/role-icon";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { roleColor } from "@/lib/graph/role-style";
import { directoryOf, edgeLabel, githubUrl } from "@/lib/graph/workspace";
import type { Edge, MapFile } from "@/lib/parser/types";
import { folderNameRole, railLabel, UNCLASSIFIED, type RailKey } from "@/lib/roles";
import { useWorkspace, type InspectorTab } from "./context";
import { RepositoryOverview } from "./overview";

export function Inspector({ className }: { className?: string }) {
  const { selection, byPath, folding, files, hidden } = useWorkspace();
  const dir = selection?.kind === "group" ? selection.id.slice(selection.id.indexOf(":") + 1) : null;
  // A box on the map holds what it's drawn holding; a folder that isn't a box
  // right now (the one just entered, say) holds everything below it.
  const inFolder = useMemo(() => {
    if (dir === null) return [];
    const box = folding.groups.find((g) => g.dir === dir);
    if (box) return box.files;
    return files.filter((f) => !hidden.has(f.path) && (dir === "." || f.path.startsWith(`${dir}/`))).map((f) => f.path);
  }, [dir, folding, files, hidden]);
  if (!selection) return <RepositoryOverview className={className} />;
  if (selection.kind === "file") {
    const file = byPath.get(selection.path);
    return file ? <FileInspector file={file} className={className} /> : <Empty className={className} />;
  }
  return dir !== null && inFolder.length > 0 ? (
    <FolderInspector dir={dir} files={inFolder} className={className} />
  ) : (
    <Empty className={className} />
  );
}

function Empty({ className }: { className?: string }) {
  return (
    <div className={cn("flex h-full flex-col items-center justify-center gap-4 p-6 text-center", className)}>
      <div className="flex size-11 items-center justify-center rounded-xl border border-line-strong bg-ink/[0.03]">
        <MousePointerClick className="size-5 text-muted" aria-hidden />
      </div>
      <div>
        <p className="text-sm font-medium text-fg">Select a module</p>
        <p className="mt-1 text-[12.5px] text-subtle">Click a folder or file on the map, in the explorer, or search to inspect it.</p>
      </div>
    </div>
  );
}

// ── A file ───────────────────────────────────────────────────────────────────

const TABS: { id: InspectorTab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "dependencies", label: "Deps" },
  { id: "dependents", label: "Dependents" },
  { id: "code", label: "Code" },
];

function FileInspector({ file, className }: { file: MapFile; className?: string }) {
  const { tab, setTab, edges, roles, names, modelRoles, setCentre, repository, commitSha } = useWorkspace();
  const pill = useId();
  const outgoing = useMemo(() => edges.filter((e) => e.source === file.path), [edges, file.path]);
  const incoming = useMemo(() => edges.filter((e) => e.target === file.path), [edges, file.path]);
  const role = roles.get(file.path) ?? UNCLASSIFIED;
  const basis = roleBasis(file, modelRoles.has(file.path));
  const counts: Partial<Record<InspectorTab, number>> = { dependencies: outgoing.length, dependents: incoming.length };

  return (
    <div className={cn("flex h-full min-h-0 flex-col", className)}>
      <div className="space-y-3 border-b border-line p-4">
        <div className="flex items-start gap-3">
          <RoleIcon role={role} size="lg" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="truncate text-[15px] font-semibold tracking-tight text-fg">{names.get(file.path) ?? file.path}</h3>
              <RoleBadge role={role} basis={basis} />
            </div>
            <CopyPath path={file.path} />
            {basis && <p className="mt-0.5 text-[10.5px] text-subtle">{BASIS[basis].long}</p>}
          </div>
          <div className="flex shrink-0 items-center gap-0.5 rounded-lg border border-line-strong p-0.5">
            <IconButton label="Focus on its neighbours (F)" tooltipSide="bottom" onClick={() => setCentre("focus")} className="size-7 rounded-md">
              <Crosshair className="size-3.5" />
            </IconButton>
            <IconLink label="Open on GitHub" tooltipSide="bottom" href={githubUrl(repository, commitSha, file.path)} className="size-7 rounded-md">
              <ExternalLink className="size-3.5" />
            </IconLink>
            <CopyLinkButton className="size-7 rounded-md" />
          </div>
        </div>
        <dl className="grid grid-cols-4 gap-1.5">
          <Stat label="Incoming" value={file.fanIn} hint="Distinct files that import it" />
          <Stat label="Outgoing" value={file.fanOut} hint="Distinct files it imports" />
          <Stat label="Complexity" value={file.complexity} hint="One plus every branch point in the file" />
          <Stat label="Lines" value={file.lines} hint="Lines in the file" />
        </dl>
      </div>
      <div role="tablist" aria-label="Inspector sections" className="scrollbar-thin flex shrink-0 overflow-x-auto border-b border-line px-1.5">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={cn("relative flex h-9 shrink-0 items-center gap-1 px-2 text-[12.5px] font-medium transition", tab === t.id ? "text-fg" : "text-subtle hover:text-muted")}
          >
            {t.label}
            {counts[t.id] !== undefined && <span className="rounded bg-ink/[0.06] px-1 font-mono text-[10px] text-muted">{counts[t.id]}</span>}
            {tab === t.id && <motion.span layoutId={pill} className="absolute inset-x-1.5 -bottom-px h-0.5 rounded-full bg-violet" />}
          </button>
        ))}
      </div>
      <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto p-4" role="tabpanel">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={`${tab}-${file.path}`}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.16, ease: "easeOut" }}
          >
            {tab === "overview" && <FileOverview file={file} outgoing={outgoing} incoming={incoming} />}
            {tab === "dependencies" && <EdgeList edges={outgoing} direction="out" />}
            {tab === "dependents" && <EdgeList edges={incoming} direction="in" />}
            {tab === "code" && <CodeTab file={file} outgoing={outgoing} />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

type RoleBasis = "model" | "folder" | "exports" | null;

// Where a role came from, when it isn't a framework's own convention: the
// model's label, the name of the folder the file sits in, or the fact that
// it exports only types. Worked out with the same rules the parser applied.
function roleBasis(file: MapFile, modelLabelled: boolean): RoleBasis {
  if (file.role === null) return modelLabelled ? "model" : null;
  const byFolder = folderNameRole(file.path);
  if (file.role === "types" && byFolder !== "types") return "exports";
  return byFolder === file.role ? "folder" : null;
}

// One line each: no framework convention names these files, so the line says what did.
const BASIS: Record<Exclude<RoleBasis, null>, { long: string }> = {
  model: { long: "Role given by the model" },
  folder: { long: "Role from its folder's name" },
  exports: { long: "Role from its exports: all types" },
};

function RoleBadge({ role, basis }: { role: RailKey; basis: RoleBasis }) {
  const color = roleColor(role);
  return (
    <span
      className="shrink-0 rounded-full px-1.5 py-px text-[10px] font-medium"
      style={{ color, backgroundColor: `${color}1f` }}
      title={basis ? BASIS[basis].long : undefined}
    >
      {railLabel(role)}
    </span>
  );
}

export function Stat({ label, value, hint }: { label: string; value: number; hint: string }) {
  return (
    <div className="rounded-lg border border-line bg-ink/[0.02] px-2 py-1.5" title={hint}>
      <dt className="text-[10px] text-subtle">{label}</dt>
      <dd className="font-mono text-[15px] font-medium tabular-nums text-fg">
        <AnimatedNumber value={value} />
      </dd>
    </div>
  );
}

function FileOverview({ file, outgoing, incoming }: { file: MapFile; outgoing: Edge[]; incoming: Edge[] }) {
  const { files, setTab } = useWorkspace();
  // Where this file's count sits among the repository's: a fact about the
  // distribution, so the bar means the same thing for every file here.
  const { max, below } = useMemo(() => {
    let top = 1;
    let fewer = 0;
    for (const f of files) {
      top = Math.max(top, f.complexity);
      if (f.complexity < file.complexity) fewer++;
    }
    return { max: top, below: Math.round((fewer / Math.max(1, files.length)) * 100) };
  }, [files, file.complexity]);

  const neighbours = [
    ...dedupe(outgoing.map((e) => ({ path: e.target, dir: "out" as const, edge: e }))),
    ...dedupe(incoming.map((e) => ({ path: e.source, dir: "in" as const, edge: e }))),
  ];

  return (
    <div className="space-y-5">
      <section>
        <SectionLabel>Description</SectionLabel>
        <Explanation target={{ kind: "file", path: file.path }} />
      </section>
      <section>
        <SectionLabel>Exports</SectionLabel>
        {file.exports.length === 0 ? (
          <p className="text-[12.5px] text-subtle">Nothing named in this file.</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {file.exports.map((e) => (
              <code key={e} className="rounded-md border border-line bg-ink/[0.03] px-1.5 py-0.5 font-mono text-[11px] text-fg/90">
                {e}
              </code>
            ))}
          </div>
        )}
      </section>
      <section>
        <SectionLabel>Complexity</SectionLabel>
        <div className="flex items-center gap-3">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink/[0.05]">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-violet to-cyan"
              initial={{ width: 0 }}
              animate={{ width: `${Math.max(3, (file.complexity / max) * 100)}%` }}
              transition={{ duration: 0.6, ease: [0.2, 0.8, 0.2, 1] }}
            />
          </div>
          <span className="shrink-0 text-[12px] text-muted tabular-nums">
            {file.complexity} · above {below}% of files
          </span>
        </div>
        <p className="mt-1.5 text-[11px] text-subtle">One plus every branch point written in the file: if, ?:, case, loops, catch, &&, ||, ??.</p>
      </section>
      <section>
        <SectionLabel>Facts</SectionLabel>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-[12px]">
          <dt className="text-subtle">Folder</dt>
          <dd className="truncate font-mono text-fg/90">{file.module === "." ? "(root)" : file.module}</dd>
          <dt className="text-subtle">Reached by</dt>
          <dd className="text-fg/90">{file.reachedBy ?? "imports only"}</dd>
        </dl>
      </section>
      <section>
        <SectionLabel>Connected modules · {neighbours.length}</SectionLabel>
        {neighbours.length === 0 ? (
          <p className="text-[12.5px] text-subtle">No connections.</p>
        ) : (
          <ul className="space-y-0.5">
            {neighbours.map((n) => (
              <li key={`${n.dir}-${n.path}`}>
                <PathButton path={n.path}>
                  {n.dir === "out" ? (
                    <ArrowDownRight className="size-3.5 shrink-0 text-cyan" aria-label="imports" />
                  ) : (
                    <ArrowUpLeft className="size-3.5 shrink-0 text-violet-soft" aria-label="imported by" />
                  )}
                  <NeighbourName path={n.path} />
                  <span className="ml-auto shrink-0 text-[10.5px] text-subtle">{n.dir === "out" ? edgeLabel(n.edge).verb : "imported by"}</span>
                </PathButton>
              </li>
            ))}
          </ul>
        )}
        {incoming.length > 0 && (
          <button type="button" onClick={() => setTab("dependents")} className="mt-3 text-[12px] font-medium text-violet-soft hover:underline">
            See every file that depends on this →
          </button>
        )}
      </section>
    </div>
  );
}

// One row per file on the other side, whichever of its edges comes first.
function dedupe<T extends { path: string }>(rows: T[]): T[] {
  const seen = new Set<string>();
  return rows.filter((r) => (seen.has(r.path) ? false : (seen.add(r.path), true)));
}

function EdgeList({ edges, direction }: { edges: Edge[]; direction: "in" | "out" }) {
  const { names, repository, commitSha } = useWorkspace();
  if (edges.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-line px-3 py-6 text-center text-[12.5px] text-subtle">
        {direction === "out" ? "This file imports nothing inside the repository." : "Nothing in the repository imports this file."}
      </p>
    );
  }
  return (
    <ul className="space-y-2">
      {edges.map((e) => {
        const other = direction === "out" ? e.target : e.source;
        const label = edgeLabel(e);
        return (
          <li key={`${e.source}>${e.target}>${e.kind}`} className="group/edge relative">
            <IconLink
              label={`Open line ${e.line} on GitHub`}
              tooltipSide="left"
              href={githubUrl(repository, commitSha, e.source, e.line)}
              className="absolute bottom-1.5 right-1.5 z-10 size-6 rounded-md opacity-0 transition group-hover/edge:opacity-100 focus-visible:opacity-100"
            >
              <ExternalLink className="size-3" />
            </IconLink>
            <PathCard path={other}>
              <div className="flex items-center gap-2">
                <NeighbourIcon path={other} size="sm" />
                <span className="truncate font-mono text-[12.5px] text-fg">{names.get(other) ?? other}</span>
                <span
                  className={cn(
                    "ml-auto shrink-0 rounded px-1.5 py-px text-[10px] font-medium",
                    e.kind === "fetch" ? "bg-cyan/10 text-cyan" : e.typeOnly ? "bg-ink/[0.05] text-subtle" : "bg-ink/[0.07] text-muted",
                  )}
                >
                  {label.label}
                </span>
              </div>
              {/* The statement that creates the edge, where it's written. */}
              <p className="mt-1.5 truncate font-mono text-[10.5px] text-subtle" title={`${e.source}:${e.line}`}>
                <span className="text-muted/70">
                  {names.get(e.source) ?? e.source}:{e.line}
                </span>{" "}
                {e.specifier}
              </p>
            </PathCard>
          </li>
        );
      })}
    </ul>
  );
}

// The source the parser read, fetched once per file per page load.
const sources = new Map<string, Promise<FileSource>>();

function CodeTab({ file, outgoing }: { file: MapFile; outgoing: Edge[] }) {
  const { analysisId, names, repository, commitSha } = useWorkspace();
  const key = `${analysisId}:${file.path}`;
  const [loaded, setLoaded] = useState<{ key: string; source: FileSource } | null>(null);
  useEffect(() => {
    let live = true;
    if (!sources.has(key)) sources.set(key, fileSourceAction(analysisId, file.path));
    void sources.get(key)?.then((source) => {
      if (!source.ok) sources.delete(key);
      if (live) setLoaded({ key, source });
    });
    return () => {
      live = false;
    };
  }, [key, analysisId, file.path]);
  const lines = useMemo(() => new Set(outgoing.map((e) => e.line)), [outgoing]);

  const source = loaded?.key === key ? loaded.source : null;
  if (!source) {
    return (
      <p className="flex items-center gap-2 text-[12.5px] text-muted">
        <Loader2 className="size-3.5 animate-spin text-violet-soft" aria-hidden />
        Fetching {names.get(file.path) ?? file.path} at the analysed commit…
      </p>
    );
  }
  if (!source.ok) {
    return (
      <p className="flex gap-2 rounded-lg border border-amber-500/20 bg-amber-500/[0.05] px-3 py-2 text-[12px] text-muted">
        <FileWarning className="mt-0.5 size-3.5 shrink-0 text-amber-500" aria-hidden />
        {source.error}
      </p>
    );
  }
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="truncate font-mono text-[11px] text-subtle">{file.path}</p>
        <span className="flex shrink-0 items-center gap-1.5">
          <a
            href={githubUrl(repository, commitSha, file.path)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-md border border-line-strong bg-ink/[0.03] px-2 py-1 text-[11px] font-medium text-muted transition hover:bg-ink/[0.07] hover:text-fg"
          >
            <ExternalLink className="size-3.5" aria-hidden />
            GitHub
          </a>
          <CopyButton text={source.text} label="Copy code" toastTitle={`Copied ${names.get(file.path) ?? file.path}`} />
        </span>
      </div>
      <CodeBlock code={source.text} highlightLines={lines} scrollToFirst className="max-h-[520px]" />
      <p className="text-[11px] text-subtle">
        The file at the analysed commit. Highlighted lines are the statements that create edges on the map.
      </p>
    </div>
  );
}

// ── A folder ─────────────────────────────────────────────────────────────────

function FolderInspector({ dir, files: paths, className }: { dir: string; files: string[]; className?: string }) {
  const { edges, byPath, roles, names, scope, goTo } = useWorkspace();
  // Distinct files across its edge, the unit every file's own counts use.
  const fan = useMemo(() => {
    const inside = new Set(paths);
    const from = new Set<string>();
    const to = new Set<string>();
    for (const e of edges) {
      if (!inside.has(e.source) && inside.has(e.target)) from.add(e.source);
      if (inside.has(e.source) && !inside.has(e.target)) to.add(e.target);
    }
    return { fanIn: from.size, fanOut: to.size };
  }, [paths, edges]);
  const lines = useMemo(() => paths.reduce((n, p) => n + (byPath.get(p)?.lines ?? 0), 0), [paths, byPath]);
  const byRole = useMemo(() => {
    const counts = new Map<RailKey, number>();
    for (const p of paths) counts.set(roles.get(p) ?? UNCLASSIFIED, (counts.get(roles.get(p) ?? UNCLASSIFIED) ?? 0) + 1);
    return [...counts].sort((a, b) => b[1] - a[1]);
  }, [paths, roles]);
  const ranked = useMemo(
    () => [...paths].sort((a, b) => (byPath.get(b)?.fanIn ?? 0) - (byPath.get(a)?.fanIn ?? 0) || a.localeCompare(b)),
    [paths, byPath],
  );

  return (
    <div className={cn("flex h-full min-h-0 flex-col", className)}>
      <div className="space-y-3 border-b border-line p-4">
        <div className="flex items-start gap-3">
          <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl bg-violet/15 text-violet-soft shadow-[inset_0_0_0_1px_rgba(139,92,246,0.35)]">
            <FolderOpen className="size-4" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-[15px] font-semibold tracking-tight text-fg">{dir === "." ? "(root)" : `${dir.split("/").pop()}/`}</h3>
            <p className="mt-0.5 truncate font-mono text-[11px] text-subtle">{dir === "." ? "the repository root" : dir}</p>
          </div>
          <CopyButton text={dir} label="Path" toastTitle={`Copied ${dir}`} />
        </div>
        {dir !== scope && (
          <button
            type="button"
            onClick={() => goTo(dir)}
            className="inline-flex h-8 w-full items-center justify-center gap-1.5 rounded-lg border border-line-strong bg-ink/[0.03] text-[12.5px] font-medium text-fg transition hover:bg-ink/[0.07]"
          >
            <LogIn className="size-3.5" aria-hidden />
            Go inside {dir === "." ? "the repository root" : `${dir.split("/").pop()}/`}
          </button>
        )}
        <dl className="grid grid-cols-4 gap-1.5">
          <Stat label="Files" value={paths.length} hint="Files in this box" />
          <Stat label="In from" value={fan.fanIn} hint="Distinct files outside that import something here" />
          <Stat label="Out to" value={fan.fanOut} hint="Distinct files outside that something here imports" />
          <Stat label="Lines" value={lines} hint="Lines across its files" />
        </dl>
      </div>
      <div className="scrollbar-thin min-h-0 flex-1 space-y-5 overflow-y-auto p-4">
        <section>
          <SectionLabel>Description</SectionLabel>
          <Explanation target={{ kind: "group", dir }} />
        </section>
        <section>
          <SectionLabel>Categories inside</SectionLabel>
          <div className="flex h-1.5 overflow-hidden rounded-full bg-ink/[0.04]" aria-hidden>
            {byRole.map(([role, count]) => (
              <span key={role} className="h-full border-r-2 border-panel last:border-r-0" style={{ backgroundColor: roleColor(role), flexGrow: count }} />
            ))}
          </div>
          <ul className="mt-2.5 grid grid-cols-2 gap-x-3 gap-y-1.5">
            {byRole.map(([role, count]) => (
              <li key={role} className="flex min-w-0 items-center gap-2 text-[12px] text-muted">
                <RoleIcon role={role} size="xs" />
                <span className="truncate">{railLabel(role)}</span>
                <span className="ml-auto font-mono text-[11px] tabular-nums text-subtle">{count}</span>
              </li>
            ))}
          </ul>
        </section>
        <section>
          <SectionLabel>Files · most imported first</SectionLabel>
          <ul className="space-y-0.5">
            {ranked.map((p) => (
              <li key={p}>
                <PathButton path={p}>
                  <NeighbourIcon path={p} size="xs" />
                  <span className="truncate font-mono text-[12px] text-fg/90">{names.get(p) ?? p}</span>
                  <span className="ml-auto shrink-0 font-mono text-[10px] tabular-nums">
                    <span className="text-violet-soft">←{byPath.get(p)?.fanIn ?? 0}</span> <span className="text-cyan">{byPath.get(p)?.fanOut ?? 0}→</span>
                  </span>
                </PathButton>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}

// ── Shared ───────────────────────────────────────────────────────────────────

function Explanation({ target }: { target: ExplainTarget }) {
  const { analysisId, commitSha, explanations, freshness, explain, byPath } = useWorkspace();
  return (
    <ExplanationPanel
      target={target}
      analysisId={analysisId}
      commitSha={commitSha}
      state={explanations.get(targetKey(target))}
      freshness={freshness.get(targetKey(target))}
      onExplain={explain}
      isPath={(p) => byPath.has(p)}
      renderPath={(p) => <InlinePath path={p} />}
    />
  );
}

// A path inside an explanation's prose: it acts like every other path here.
function InlinePath({ path }: { path: string }) {
  const { reveal, setHover } = useWorkspace();
  return (
    <button
      type="button"
      title={path}
      onClick={() => reveal(path)}
      onMouseEnter={() => setHover({ kind: "file", path })}
      onMouseLeave={() => setHover(null)}
      className="rounded px-0.5 text-left font-mono text-[12px] break-all text-violet-soft hover:bg-violet/10 hover:underline"
    >
      {path}
    </button>
  );
}

export function NeighbourIcon({ path, size }: { path: string; size: "xs" | "sm" }) {
  const { roles } = useWorkspace();
  return <RoleIcon role={roles.get(path) ?? UNCLASSIFIED} size={size} />;
}

function NeighbourName({ path }: { path: string }) {
  const { names } = useWorkspace();
  return (
    <>
      <NeighbourIcon path={path} size="xs" />
      <span className="truncate font-mono text-[12px] text-fg/90" title={path}>
        {names.get(path) ?? path}
      </span>
      <span className="hidden truncate font-mono text-[10px] text-subtle xl:inline">{directoryOf(path)}</span>
    </>
  );
}

// Every path in the inspector is one of these: clicking reveals it on the map,
// hovering marks it there.
export function PathButton({ path, children }: { path: string; children: ReactNode }) {
  const { reveal, setHover } = useWorkspace();
  return (
    <button
      type="button"
      onClick={() => reveal(path)}
      onMouseEnter={() => setHover({ kind: "file", path })}
      onMouseLeave={() => setHover(null)}
      className="flex w-full min-w-0 items-center gap-2 rounded-md px-1.5 py-1 text-left transition hover:bg-ink/[0.04]"
    >
      {children}
    </button>
  );
}

function PathCard({ path, children }: { path: string; children: ReactNode }) {
  const { reveal, setHover } = useWorkspace();
  return (
    <button
      type="button"
      onClick={() => reveal(path)}
      onMouseEnter={() => setHover({ kind: "file", path })}
      onMouseLeave={() => setHover(null)}
      className="w-full rounded-lg border border-line bg-ink/[0.015] p-2.5 text-left transition hover:border-line-strong hover:bg-ink/[0.035]"
    >
      {children}
    </button>
  );
}

// The path under a file's name copies itself when clicked.
function CopyPath({ path }: { path: string }) {
  const toast = useToast();
  return (
    <button
      type="button"
      title="Copy the path"
      onClick={async () => {
        await navigator.clipboard.writeText(path);
        toast({ title: "Path copied", description: path });
      }}
      className="mt-0.5 block max-w-full truncate text-left font-mono text-[11px] text-subtle transition hover:text-fg"
    >
      {path}
    </button>
  );
}
