"use client";

import { motion } from "motion/react";
import { ArrowUp, ChevronRight, Crosshair, GitCommitHorizontal, Maximize2, Network, PanelRight, RotateCcw, Route as RouteIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useRef } from "react";
import { DependencyMap } from "@/components/map/dependency-map";
import { FileMap } from "@/components/map/file-map";
import { FocusView } from "@/components/map/focus-view";
import { RerunButton } from "@/components/progress/rerun-button";
import { AnimatedNumber, IconButton } from "@/components/ui/primitives";
import { ToastProvider, useToast } from "@/components/ui/toast";
import { WorkspaceProvider, useWorkspace, type RepositoryFacts } from "@/components/workspace/context";
import { Explorer } from "@/components/workspace/explorer";
import { CategoryFilters } from "@/components/workspace/filters";
import { Inspector } from "@/components/workspace/inspector";
import { FileSearch } from "@/components/workspace/search";
import { WorkspaceShortcuts } from "@/components/workspace/shortcuts";
import { cn } from "@/lib/cn";
import { trail } from "@/lib/graph/scope";
import { unpackMap, type PackedMap } from "@/lib/analysis/packed";
import type { Coverage, Route } from "@/lib/parser/types";
import type { ModelRole } from "@/lib/roles";
import { RouteTable } from "./route-table";

// The landing page's playground, on a real repository: toolbar on top,
// explorer on the left, the map in the middle, the inspector on the right.
export function AnalysisView({
  map,
  ...props
}: {
  /** Files and edges, packed for the trip from the server. */
  map: PackedMap;
  routes: Route[];
  routeCoverage: Coverage["routes"];
  /** Roles the model gave files no convention identified, by path. */
  modelRoles: Record<string, ModelRole>;
  analysisId: string;
  commitSha: string;
  repository: RepositoryFacts;
}) {
  // Unpacked once per page load; everything after works on plain objects.
  const { files, edges } = useMemo(() => unpackMap(map), [map]);
  return (
    <ToastProvider>
      <WorkspaceProvider {...props} files={files} edges={edges}>
        <Workspace />
      </WorkspaceProvider>
    </ToastProvider>
  );
}

function Workspace() {
  const ws = useWorkspace();
  const toast = useToast();
  const router = useRouter();
  const pill = useId();
  const focusPath = ws.selection?.kind === "file" ? ws.selection.path : null;
  // Small enough to read whole: every file is drawn, as on the landing page.
  // Past that, the map shows one folder at a time.
  const { visibleFiles, whole } = ws;

  // The address says what's selected, so a copied link opens on that file. It
  // replaces the entry rather than adding one: selecting files isn't
  // navigating, and Back should leave the analysis, not step through clicks.
  const opened = useRef(false);
  useEffect(() => {
    if (opened.current) return;
    opened.current = true;
    const wanted = new URLSearchParams(window.location.search).get("file");
    if (wanted && ws.byPath.has(wanted)) ws.reveal(wanted);
  }, [ws]);
  const selectedPath = ws.selection?.kind === "file" ? ws.selection.path : null;
  useEffect(() => {
    if (!opened.current) return;
    const url = new URL(window.location.href);
    if (selectedPath === url.searchParams.get("file")) return;
    if (selectedPath) url.searchParams.set("file", selectedPath);
    else url.searchParams.delete("file");
    window.history.replaceState(window.history.state, "", url);
  }, [selectedPath]);

  const onReset = () => {
    ws.reset();
    toast({ title: "Workspace reset", description: "Back to the top of the repository, with tests hidden.", tone: "info" });
  };

  const tabs = [
    { id: "map", label: "Map", Icon: Network, count: null, disabled: false },
    { id: "focus", label: "Focus", Icon: Crosshair, count: null, disabled: focusPath === null },
    { id: "routes", label: "Routes", Icon: RouteIcon, count: ws.routes.length, disabled: false },
  ] as const;

  return (
    <div className="relative flex min-h-0 flex-1 flex-col px-3 pb-3 pt-4 sm:px-4 sm:pb-4">
      {/* The landing page's backdrop: a faint grid and a violet glow behind the panel. */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[420px] overflow-hidden" aria-hidden>
        <div className="grid-backdrop noise-fade absolute inset-0" />
        <div className="absolute left-1/2 top-[-160px] h-[420px] w-[900px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(139,92,246,0.2),transparent)]" />
      </div>
      <div className="panel-shadow relative mx-auto flex min-h-0 w-full max-w-[1440px] flex-1 flex-col overflow-hidden rounded-2xl border border-line-strong bg-panel">
        <h1 className="sr-only">
          {ws.repository.owner}/{ws.repository.name}
        </h1>
        {/* Toolbar, as the playground's: search on the left, the view and actions on the right, the filters below. */}
        <div className="flex flex-col gap-3 border-b border-line bg-toolbar p-3 sm:px-4">
          <div className="flex flex-wrap items-center gap-2">
            <FileSearch className="w-full sm:w-72" />
            <div className="flex flex-1 flex-wrap items-center gap-2 sm:justify-end">
              <div role="tablist" aria-label="Centre view" className="grid w-full grid-cols-3 rounded-lg border border-line bg-black/20 p-0.5 sm:w-[300px]">
                {tabs.map(({ id, label, Icon, count, disabled }) => (
                  <button
                    key={id}
                    type="button"
                    role="tab"
                    aria-selected={ws.centre === id}
                    disabled={disabled}
                    title={id === "focus" && disabled ? "Select a file to focus on it" : undefined}
                    onClick={() => ws.setCentre(id)}
                    className={cn(
                      "relative flex h-7 items-center justify-center gap-1.5 rounded-md px-3 text-[12px] font-medium transition disabled:opacity-40",
                      ws.centre === id ? "text-fg" : "text-subtle enabled:hover:text-muted",
                    )}
                  >
                    {ws.centre === id && (
                      <motion.span layoutId={pill} className="absolute inset-0 rounded-md border border-line-strong bg-ink/[0.07]" transition={{ type: "spring", stiffness: 500, damping: 38 }} />
                    )}
                    <Icon className="relative size-3.5" aria-hidden />
                    <span className="relative">{label}</span>
                    {count !== null && <span className="relative font-mono text-[10px] text-subtle">{count}</span>}
                  </button>
                ))}
              </div>
              <RerunButton
                analysisId={ws.analysisId}
                label="Re-analyse"
                primary
                onStarted={() => {
                  toast({ title: "Re-analysing", description: "The map comes back here when it's done.", tone: "info" });
                  router.refresh();
                }}
              />
              <div className="flex items-center">
                <IconButton label="Fit map to view (0)" onClick={ws.fit} className="size-9">
                  <Maximize2 className="size-4" />
                </IconButton>
                <IconButton label="Reset workspace" onClick={onReset} className="size-9">
                  <RotateCcw className="size-4" />
                </IconButton>
                <WorkspaceShortcuts />
              </div>
            </div>
          </div>
          <CategoryFilters />
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[250px_minmax(0,1fr)_400px]">
          <aside className="hidden min-h-0 flex-col border-r border-line bg-sidebar lg:flex">
            <RepositoryCard />
            <p className="flex items-center justify-between px-3 pb-1 pt-3 text-[10.5px] font-medium uppercase tracking-wider text-subtle">
              Explorer <span className="font-mono normal-case tracking-normal">{ws.files.length.toLocaleString("en")} files</span>
            </p>
            <Explorer className="min-h-0 flex-1" />
            <RepositoryStats />
          </aside>

          <section aria-label="Map" className="relative min-h-[420px] min-w-0 bg-bg">
            {/* The map stays mounted under the other views, so switching back keeps its viewport. */}
            <div className={cn("absolute inset-0 flex flex-col", ws.centre !== "map" && "invisible")}>
              <div className="relative min-h-0 flex-1">
                {whole ? <WholeMapChip count={visibleFiles.length} /> : <Breadcrumb />}
                {whole ? (
                  <FileMap
                    files={visibleFiles}
                    edges={ws.shownEdges}
                    selection={ws.selection}
                    hover={ws.hover}
                    roles={ws.roles}
                    names={ws.names}
                    categories={ws.categories}
                    camera={ws.camera}
                    onSelectFile={ws.toggleFile}
                    onHover={ws.setHover}
                    onDeselect={ws.deselect}
                  />
                ) : (
                <DependencyMap
                  files={ws.files}
                  edges={ws.mapEdges}
                  folding={ws.folding}
                  open={ws.open}
                  selection={ws.selection}
                  hover={ws.hover}
                  hidden={ws.hidden}
                  roles={ws.roles}
                  categories={ws.categories}
                  camera={ws.camera}
                  allLines={ws.allLines}
                  onToggleAllLines={ws.toggleAllLines}
                  onOpen={(id) => ws.goTo(dirOf(id))}
                  onClose={(id) => ws.selectGroup(dirOf(id))}
                  onSelectFile={ws.toggleFile}
                  onScroll={ws.scroll}
                  onHover={ws.setHover}
                  onDeselect={ws.deselect}
                />
                )}
              </div>
            </div>
            {ws.centre === "focus" && focusPath !== null && (
              <div className="absolute inset-0 bg-bg">
                <FocusView
                  path={focusPath}
                  byPath={ws.byPath}
                  edges={ws.shownEdges}
                  roles={ws.roles}
                  names={ws.names}
                  onSelect={ws.reveal}
                  onBack={() => ws.setCentre("map")}
                />
              </div>
            )}
            {ws.centre === "routes" && (
              <div className="absolute inset-0 bg-panel">
                <RouteTable
                  routes={ws.routes}
                  coverage={ws.routeCoverage}
                  selection={ws.selection}
                  hover={ws.hover}
                  onReveal={(path) => {
                    ws.reveal(path);
                    ws.setCentre("map");
                  }}
                  onHover={ws.setHover}
                />
              </div>
            )}
          </section>

          <aside aria-label="Inspector" className="flex min-h-0 flex-col border-l border-line bg-sidebar max-lg:h-[640px] max-lg:border-t">
            {/* The playground's side-panel tabs. */}
            <div role="tablist" aria-label="Side panel" className="flex shrink-0 gap-1 border-b border-line p-1.5">
              <span
                role="tab"
                aria-selected
                className="relative flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg bg-ink/[0.07] text-[12.5px] font-medium text-fg"
              >
                <PanelRight className="size-3.5" aria-hidden />
                Inspector
              </span>
            </div>
            <Inspector className="min-h-0 flex-1" />
          </aside>
        </div>
      </div>
    </div>
  );
}

/** A group's id names its folder: "dir:src/main". */
function dirOf(id: string): string {
  return id.slice(id.indexOf(":") + 1);
}

// Where the map is, from the repository down, each level a way back out. The
// right end says what the filters are keeping off it, so a missing folder is
// never a mystery.
// Over the whole-repository map: how much is drawn, and what the filters keep off it.
function WholeMapChip({ count }: { count: number }) {
  const ws = useWorkspace();
  const hiddenCount = ws.hidden.size;
  return (
    <div className="absolute left-3 top-3 z-10 flex items-center gap-2 rounded-xl border border-line-strong bg-panel/90 px-3 py-1.5 text-[12px] shadow-xl shadow-black/20 backdrop-blur">
      <span className="font-mono font-medium text-fg">{ws.repository.name}</span>
      <span className="text-subtle">
        all {count.toLocaleString("en")} {count === 1 ? "file" : "files"}
      </span>
      {hiddenCount > 0 && (
        <span className="flex items-center gap-1.5 border-l border-line pl-2 text-[11px] text-subtle">
          {hiddenCount.toLocaleString("en")} filtered off
          <button type="button" onClick={ws.showAllCategories} className="font-medium text-violet-soft hover:underline">
            Show
          </button>
        </span>
      )}
    </div>
  );
}

function Breadcrumb() {
  const ws = useWorkspace();
  const levels = trail(ws.scope);
  const hiddenCount = ws.hidden.size;
  return (
    <nav
      aria-label="Folder in view"
      className="absolute left-3 top-3 z-10 flex max-w-[calc(100%-1.5rem)] flex-wrap items-center gap-1 rounded-xl border border-line-strong bg-panel/90 py-1 pl-1 pr-2 text-[12px] shadow-xl shadow-black/20 backdrop-blur"
    >
      <button
        type="button"
        onClick={() => ws.goTo(levels[levels.length - 2] ?? ".")}
        disabled={levels.length < 2}
        className="inline-flex size-7 items-center justify-center rounded-lg text-subtle transition enabled:hover:bg-ink/[0.06] enabled:hover:text-fg disabled:opacity-30"
        aria-label="Up one folder"
        title="Up one folder (⌫)"
      >
        <ArrowUp className="size-3.5" aria-hidden />
      </button>
      {levels.map((dir, i) => {
        const last = i === levels.length - 1;
        const name = dir === "." ? ws.repository.name : (dir.split("/").pop() ?? dir);
        return (
          <span key={dir} className="flex items-center gap-1">
            {i > 0 && <ChevronRight className="size-3 text-subtle/60" aria-hidden />}
            <button
              type="button"
              onClick={() => ws.goTo(dir)}
              disabled={last}
              className={cn("rounded-md px-1.5 py-0.5 font-mono transition", last ? "font-medium text-fg" : "text-muted hover:bg-ink/[0.06] hover:text-fg")}
            >
              {name}
            </button>
          </span>
        );
      })}
      {hiddenCount > 0 && (
        <span className="ml-1 flex items-center gap-1.5 border-l border-line pl-2 text-[11px] text-subtle">
          {hiddenCount.toLocaleString("en")} filtered off
          <button type="button" onClick={ws.showAllCategories} className="font-medium text-violet-soft hover:underline">
            Show
          </button>
        </span>
      )}
    </nav>
  );
}

// The repository as the landing page's mockup shows it, at the top of the
// explorer: its initials, its name, and the commit and framework analysed.
function RepositoryCard() {
  const ws = useWorkspace();
  const frameworks = [...new Set(ws.repository.projects.map((p) => p.adapter).filter((a) => a !== "none"))];
  return (
    <div className="border-b border-line p-3">
      <div className="flex items-center gap-2.5 rounded-lg border border-line bg-ink/[0.02] p-2" title={`${ws.repository.owner}/${ws.repository.name}`}>
        <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-[#2a2f3c] to-[#1a1d25] font-mono text-[11px] font-semibold text-white">
          {ws.repository.name.slice(0, 2).toLowerCase()}
        </span>
        <div className="min-w-0 leading-tight">
          <p className="truncate text-[12.5px] font-medium text-fg">{ws.repository.name}</p>
          <p className="flex items-center gap-1 truncate font-mono text-[10.5px] text-subtle">
            <GitCommitHorizontal className="size-3 shrink-0" aria-hidden />
            {ws.commitSha.slice(0, 7)} · {frameworks.length > 0 ? frameworks.join(", ") : "no framework"}
          </p>
        </div>
      </div>
    </div>
  );
}

// The mockup's four numbers under the explorer.
function RepositoryStats() {
  const ws = useWorkspace();
  const imports = ws.edges.filter((e) => e.kind !== "fetch").length;
  const stats = [
    { label: "Files", value: ws.files.length },
    { label: "Edges", value: imports },
    { label: "Network calls", value: ws.repository.fetches.matched },
    { label: "Routes", value: ws.routes.length },
  ];
  return (
    <dl className="grid shrink-0 grid-cols-2 gap-px border-t border-line bg-line">
      {stats.map((s) => (
        <div key={s.label} className="bg-sidebar px-3 py-2">
          <dt className="text-[10.5px] text-subtle">{s.label}</dt>
          <dd className="font-mono text-[14px] font-medium tabular-nums text-fg">
            <AnimatedNumber value={s.value} />
          </dd>
        </div>
      ))}
    </dl>
  );
}
