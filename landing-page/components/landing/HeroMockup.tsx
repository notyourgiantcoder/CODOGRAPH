"use client";

import { GitBranch, GitCommitHorizontal, Radar } from "lucide-react";
import { AssistantPanel } from "@/components/demo/AssistantPanel";
import { DemoProvider, useDemo } from "@/components/demo/DemoProvider";
import { FileExplorer } from "@/components/demo/FileExplorer";
import { GraphSearch } from "@/components/demo/GraphSearch";
import { ImpactBanner } from "@/components/demo/ImpactPanel";
import { Inspector } from "@/components/demo/Inspector";
import { DependencyGraph } from "@/components/graph/DependencyGraph";
import { CategoryIcon } from "@/components/graph/CategoryIcon";
import { AnimatedNumber, Button } from "@/components/ui/primitives";
import { FILES, REPOSITORY } from "@/data/repository";
import { DEPENDENCIES, displayName, getFile, getIncoming, LONGEST_CHAIN } from "@/lib/graph";

const NETWORK_CALLS = DEPENDENCIES.filter((d) => d.kind === "fetch").length;

export function HeroMockup() {
  return (
    <DemoProvider initialSelected="hooks-use-cart">
      <MockupWindow />
    </DemoProvider>
  );
}

function MockupWindow() {
  const { selectedId, runImpact, impact } = useDemo();
  return (
    <div className="panel-shadow relative overflow-hidden rounded-2xl border border-line-strong bg-panel">
      {/* Window chrome */}
      <div className="flex h-11 items-center gap-3 border-b border-line bg-[#0e1015] px-3 sm:px-4">
        <div className="flex gap-1.5" aria-hidden>
          <span className="size-2.5 rounded-full bg-[#ff5f57]/80" />
          <span className="size-2.5 rounded-full bg-[#febc2e]/80" />
          <span className="size-2.5 rounded-full bg-[#28c840]/80" />
        </div>
        <div className="hidden items-center gap-1.5 font-mono text-[11.5px] text-subtle md:flex">
          <span className="text-muted">{REPOSITORY.owner}</span>/<span className="text-fg">{REPOSITORY.name}</span>
          <span className="mx-1 text-line-strong">|</span>
          <GitBranch className="size-3" aria-hidden />
          {REPOSITORY.branch}
        </div>
        <GraphSearch className="mx-auto w-full max-w-[300px]" placeholder="Jump to file…" />
        <span className="hidden shrink-0 rounded-full border border-line-strong px-2 py-0.5 text-[10.5px] text-subtle sm:inline">
          Synthetic demo data
        </span>
      </div>

      <div className="grid h-[440px] grid-cols-1 sm:h-[520px] lg:h-[600px] lg:grid-cols-[214px_minmax(0,1fr)_290px]">
        {/* Repository sidebar */}
        <aside className="hidden min-h-0 min-w-0 flex-col border-r border-line bg-[#0f1116] lg:flex">
          <div className="border-b border-line p-3">
            <div className="flex items-center gap-2.5 rounded-lg border border-line bg-white/[0.02] p-2">
              <span className="flex size-7 items-center justify-center rounded-md bg-gradient-to-br from-[#2a2f3c] to-[#1a1d25] font-mono text-[11px] font-semibold text-fg">
                ac
              </span>
              <div className="min-w-0 leading-tight">
                <p className="truncate text-[12.5px] font-medium text-fg">{REPOSITORY.name}</p>
                <p className="flex items-center gap-1 font-mono text-[10.5px] text-subtle">
                  <GitCommitHorizontal className="size-3" aria-hidden />
                  {REPOSITORY.commit} · {REPOSITORY.framework}
                </p>
              </div>
            </div>
          </div>
          <p className="px-3 pb-1 pt-3 text-[10.5px] font-medium uppercase tracking-wider text-subtle">Explorer</p>
          <FileExplorer dense className="min-h-0 flex-1" />
          <dl className="grid grid-cols-2 gap-px border-t border-line bg-line">
            {[
              { label: "Files", value: FILES.length },
              { label: "Edges", value: DEPENDENCIES.length },
              { label: "Network calls", value: NETWORK_CALLS },
              { label: "Longest chain", value: LONGEST_CHAIN },
            ].map((s) => (
              <div key={s.label} className="bg-[#0f1116] px-3 py-2">
                <dt className="text-[10px] text-subtle">{s.label}</dt>
                <dd>
                  <AnimatedNumber value={s.value} className="font-mono text-[14px] font-medium text-fg" />
                </dd>
              </div>
            ))}
          </dl>
        </aside>

        {/* Graph */}
        <div className="relative min-h-0 bg-[radial-gradient(ellipse_at_center,rgba(139,92,246,0.06),transparent_70%)]">
          <DependencyGraph variant="hero" />
          <div className="pointer-events-none absolute inset-x-0 top-3 flex justify-center px-3">
            <ImpactBanner />
          </div>
          {selectedId && !impact && (
            <div className="pointer-events-none absolute left-3 top-3 lg:hidden">
              <div className="pointer-events-auto flex items-center gap-2 rounded-xl border border-line-strong bg-panel/90 py-1.5 pl-2 pr-1.5 backdrop-blur">
                <CategoryIcon category={getFile(selectedId).category} size="sm" />
                <span className="font-mono text-[12px] text-fg">{displayName(selectedId)}</span>
                <span className="text-[11px] text-subtle">{getIncoming(selectedId).length} dependents</span>
                <Button size="sm" className="h-6 rounded-md px-2 text-[11px]" onClick={() => runImpact(selectedId, "downstream")}>
                  <Radar className="size-3" aria-hidden />
                  Impact
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Inspector + assistant */}
        <aside className="hidden min-h-0 min-w-0 grid-cols-[minmax(0,1fr)] grid-rows-[minmax(0,1fr)_minmax(0,1.1fr)] border-l border-line bg-[#0f1116] lg:grid">
          <Inspector variant="compact" className="border-b border-line" />
          <AssistantPanel variant="mini" seedQuestion="Which files depend on the cart hook?" />
        </aside>
      </div>
    </div>
  );
}
