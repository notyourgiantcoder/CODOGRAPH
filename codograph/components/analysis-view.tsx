"use client";

import { motion } from "motion/react";
import { Maximize2, Network, RotateCcw, Route as RouteIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { DependencyMap } from "@/components/map/dependency-map";
import { RerunButton } from "@/components/progress/rerun-button";
import { IconButton } from "@/components/ui/primitives";
import { ToastProvider, useToast } from "@/components/ui/toast";
import { WorkspaceProvider, useWorkspace, type RepositoryFacts } from "@/components/workspace/context";
import { Explorer } from "@/components/workspace/explorer";
import { CategoryFilters } from "@/components/workspace/filters";
import { Inspector } from "@/components/workspace/inspector";
import { FileSearch } from "@/components/workspace/search";
import { cn } from "@/lib/cn";
import type { Coverage, Edge, ParsedFile, Route } from "@/lib/parser/types";
import type { ModelRole } from "@/lib/roles";
import { RouteTable } from "./route-table";

// The landing page's playground, on a real repository: toolbar on top,
// explorer on the left, the map in the middle, the inspector on the right.
export function AnalysisView(props: {
  files: ParsedFile[];
  edges: Edge[];
  routes: Route[];
  routeCoverage: Coverage["routes"];
  /** Roles the model gave files no convention identified, by path. */
  modelRoles: Record<string, ModelRole>;
  analysisId: string;
  commitSha: string;
  repository: RepositoryFacts;
}) {
  return (
    <ToastProvider>
      <WorkspaceProvider {...props}>
        <Workspace />
      </WorkspaceProvider>
    </ToastProvider>
  );
}

function Workspace() {
  const ws = useWorkspace();
  const toast = useToast();
  const router = useRouter();
  // The centre shows the map or the route table; explorer and inspector keep working on either.
  const [centre, setCentre] = useState<"map" | "routes">("map");
  const pill = useId();

  const onReset = () => {
    ws.reset();
    setCentre("map");
    toast({ title: "Workspace reset", description: "Filters, selection and open folders restored.", tone: "info" });
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col p-3 sm:p-4">
      <div className="panel-shadow flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-line-strong bg-panel">
        {/* Toolbar */}
        <div className="flex flex-col gap-3 border-b border-line bg-toolbar p-3 sm:px-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="mr-1 flex min-w-0 items-center gap-2">
              <span className="flex gap-1.5" aria-hidden>
                <span className="size-2.5 rounded-full bg-[#ff5f57]" />
                <span className="size-2.5 rounded-full bg-[#febc2e]" />
                <span className="size-2.5 rounded-full bg-[#28c840]" />
              </span>
              <h1 className="ml-1.5 truncate font-mono text-[13px]">
                <span className="text-subtle">{ws.repository.owner} / </span>
                <span className="text-fg">{ws.repository.name}</span>
              </h1>
              <span className="hidden rounded-md border border-line px-1.5 py-0.5 font-mono text-[10.5px] text-subtle sm:inline" title={ws.commitSha}>
                {ws.commitSha.slice(0, 7)}
              </span>
            </div>
            <FileSearch className="w-full sm:w-72" />
            <div className="flex flex-1 flex-wrap items-center gap-2 sm:justify-end">
              <div role="tablist" aria-label="Centre view" className="grid grid-cols-2 rounded-lg border border-line bg-ink/[0.03] p-0.5">
                {(
                  [
                    ["map", "Map", Network, null],
                    ["routes", "Routes", RouteIcon, ws.routes.length],
                  ] as const
                ).map(([id, label, Icon, count]) => (
                  <button
                    key={id}
                    type="button"
                    role="tab"
                    aria-selected={centre === id}
                    onClick={() => setCentre(id)}
                    className={cn("relative flex h-7 items-center gap-1.5 rounded-md px-3 text-[12px] font-medium transition", centre === id ? "text-fg" : "text-subtle hover:text-muted")}
                  >
                    {centre === id && (
                      <motion.span layoutId={pill} className="absolute inset-0 rounded-md border border-line-strong bg-ink/[0.07]" transition={{ type: "spring", stiffness: 500, damping: 38 }} />
                    )}
                    <Icon className="relative size-3.5" aria-hidden />
                    <span className="relative">{label}</span>
                    {count !== null && <span className="relative font-mono text-[10px] text-subtle">{count}</span>}
                  </button>
                ))}
              </div>
              <div className="flex items-center">
                <IconButton label="Fit map to view" onClick={ws.fit} className="size-9">
                  <Maximize2 className="size-4" />
                </IconButton>
                <IconButton label="Reset workspace" onClick={onReset} className="size-9">
                  <RotateCcw className="size-4" />
                </IconButton>
              </div>
              <RerunButton analysisId={ws.analysisId} label="Re-analyse" onStarted={() => router.refresh()} />
            </div>
          </div>
          <CategoryFilters />
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[250px_minmax(0,1fr)_400px]">
          <aside className="hidden min-h-0 flex-col border-r border-line bg-sidebar lg:flex">
            <p className="flex items-center justify-between px-3 pb-1 pt-3 text-[10.5px] font-medium uppercase tracking-wider text-subtle">
              Explorer <span className="font-mono normal-case tracking-normal">{ws.files.length} files</span>
            </p>
            <Explorer className="min-h-0 flex-1" />
          </aside>

          <section aria-label="Map" className="relative min-h-[420px] min-w-0 bg-bg">
            {/* The map stays mounted under the table, so switching back keeps its viewport. */}
            <div className={cn("absolute inset-0", centre !== "map" && "invisible")}>
              <DependencyMap
                files={ws.files}
                edges={ws.shownEdges}
                folding={ws.folding}
                open={ws.open}
                selection={ws.selection}
                hover={ws.hover}
                hidden={ws.hidden}
                roles={ws.roles}
                categories={ws.categories}
                camera={ws.camera}
                onOpen={ws.openGroup}
                onClose={ws.closeGroup}
                onSelectFile={ws.toggleFile}
                onScroll={ws.scroll}
                onHover={ws.setHover}
                onDeselect={ws.deselect}
              />
            </div>
            {centre === "routes" && (
              <div className="absolute inset-0 bg-panel">
                <RouteTable
                  routes={ws.routes}
                  coverage={ws.routeCoverage}
                  selection={ws.selection}
                  hover={ws.hover}
                  onReveal={(path) => {
                    ws.reveal(path);
                    setCentre("map");
                  }}
                  onHover={ws.setHover}
                />
              </div>
            )}
          </section>

          <aside aria-label="Inspector" className="flex min-h-0 flex-col border-l border-line bg-sidebar max-lg:h-[640px] max-lg:border-t">
            <Inspector className="min-h-0 flex-1" />
          </aside>
        </div>
      </div>
    </div>
  );
}
