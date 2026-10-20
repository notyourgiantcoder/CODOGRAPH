"use client";

import { Bot, FolderTree, Maximize2, PanelRight, Radar, RotateCcw } from "lucide-react";
import { useId, useState } from "react";
import { motion } from "motion/react";
import { AssistantPanel } from "@/components/demo/AssistantPanel";
import { DemoProvider, useDemo } from "@/components/demo/DemoProvider";
import { FileExplorer } from "@/components/demo/FileExplorer";
import { CategoryFilters } from "@/components/demo/FilterBar";
import { GraphSearch } from "@/components/demo/GraphSearch";
import { ImpactBanner, ImpactModeToggle } from "@/components/demo/ImpactPanel";
import { Inspector } from "@/components/demo/Inspector";
import { DependencyGraph } from "@/components/graph/DependencyGraph";
import { Insights } from "@/components/landing/Insights";
import { useToast } from "@/components/ui/Toast";
import { Button, IconButton, Reveal, SectionHeading } from "@/components/ui/primitives";
import { FILES } from "@/data/repository";
import { cn } from "@/lib/cn";
import { DEPENDENCIES, displayName } from "@/lib/graph";
import { useMediaQuery } from "@/lib/useMediaQuery";

type PanelId = "inspector" | "assistant" | "files";

export function Playground() {
  return (
    <DemoProvider initialSelected="lib-products">
      <section id="demo" className="relative py-24 sm:py-28">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px hairline-top" aria-hidden />
        <div className="mx-auto max-w-[1180px] px-4 sm:px-6">
          <SectionHeading
            eyebrow="Interactive playground"
            title="Explore a living dependency graph"
            description={`A synthetic Next.js storefront with ${FILES.length} files and ${DEPENDENCIES.length} relationships. Search, filter, analyze impact and ask questions. No sign-in, no backend.`}
          />
        </div>
        <Reveal className="mx-auto mt-14 max-w-[1440px] px-3 sm:px-6">
          <Workspace />
        </Reveal>
      </section>
      <Insights />
    </DemoProvider>
  );
}

function Workspace() {
  const { selectedId, runImpact, impactMode, reset, fitView } = useDemo();
  const toast = useToast();
  const desktop = useMediaQuery("(min-width: 1024px)");
  const [panel, setPanel] = useState<PanelId>("inspector");
  const pill = useId();

  const panels: { id: PanelId; label: string; icon: typeof Bot }[] = desktop
    ? [
        { id: "inspector", label: "Inspector", icon: PanelRight },
        { id: "assistant", label: "Assistant", icon: Bot },
      ]
    : [
        { id: "inspector", label: "Inspector", icon: PanelRight },
        { id: "assistant", label: "Assistant", icon: Bot },
        { id: "files", label: "Files", icon: FolderTree },
      ];
  const activePanel = desktop && panel === "files" ? "inspector" : panel;

  const onReset = () => {
    reset();
    setPanel("inspector");
    toast({ title: "Playground reset", description: "Filters, selection and analysis restored.", tone: "info" });
  };

  return (
    <div className="panel-shadow overflow-hidden rounded-2xl border border-line-strong bg-panel">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 border-b border-line bg-[#0e1015] p-3 sm:px-4">
        <div className="flex flex-wrap items-center gap-2">
          <GraphSearch hotkey className="w-full sm:w-72" />
          <div className="flex flex-1 flex-wrap items-center gap-2 sm:justify-end">
            <ImpactModeToggle className="w-full sm:w-[260px]" />
            <Button
              size="sm"
              className="h-9 flex-1 sm:flex-none"
              disabled={!selectedId}
              onClick={() => selectedId && runImpact(selectedId, impactMode)}
            >
              <Radar className="size-3.5" aria-hidden />
              Analyze impact
              {selectedId && <span className="hidden max-w-[120px] truncate font-mono text-[11px] opacity-60 xl:inline">{displayName(selectedId)}</span>}
            </Button>
            <div className="flex items-center">
              <IconButton label="Fit graph to view" onClick={fitView} className="size-9">
                <Maximize2 className="size-4" />
              </IconButton>
              <IconButton label="Reset playground" onClick={onReset} className="size-9">
                <RotateCcw className="size-4" />
              </IconButton>
            </div>
          </div>
        </div>
        <CategoryFilters />
      </div>

      <div className={cn(desktop ? "grid h-[720px] grid-cols-[240px_minmax(0,1fr)_380px]" : "flex flex-col")}>
        {desktop && (
          <aside className="flex min-h-0 flex-col border-r border-line bg-[#0f1116]">
            <p className="flex items-center justify-between px-3 pb-1 pt-3 text-[10.5px] font-medium uppercase tracking-wider text-subtle">
              Explorer <span className="font-mono normal-case tracking-normal">{FILES.length} files</span>
            </p>
            <FileExplorer className="min-h-0 flex-1" />
          </aside>
        )}

        <div className={cn("relative min-h-0", !desktop && "h-[58vh] min-h-[380px] max-h-[560px] border-b border-line")}>
          <DependencyGraph variant="full" animateOnView />
          <div className="pointer-events-none absolute inset-x-0 top-3 flex justify-center px-3">
            <ImpactBanner />
          </div>
        </div>

        <aside className={cn("flex min-h-0 flex-col bg-[#0f1116]", desktop ? "border-l border-line" : "h-[600px]")}>
          <div role="tablist" aria-label="Side panel" className="flex shrink-0 gap-1 border-b border-line p-1.5">
            {panels.map((p) => (
              <button
                key={p.id}
                type="button"
                role="tab"
                aria-selected={activePanel === p.id}
                onClick={() => setPanel(p.id)}
                className={cn(
                  "relative flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg text-[12.5px] font-medium transition",
                  activePanel === p.id ? "text-fg" : "text-subtle hover:text-muted",
                )}
              >
                {activePanel === p.id && (
                  <motion.span layoutId={pill} className="absolute inset-0 rounded-lg bg-white/[0.07]" transition={{ type: "spring", stiffness: 500, damping: 38 }} />
                )}
                <p.icon className="relative size-3.5" aria-hidden />
                <span className="relative">{p.label}</span>
              </button>
            ))}
          </div>
          {/* Panels stay mounted so the conversation survives tab switches. */}
          <div className={cn("min-h-0 flex-1", activePanel !== "inspector" && "hidden")}>
            <Inspector className="h-full" />
          </div>
          <div className={cn("min-h-0 flex-1", activePanel !== "assistant" && "hidden")}>
            <AssistantPanel className="h-full" />
          </div>
          {!desktop && (
            <div className={cn("min-h-0 flex-1", activePanel !== "files" && "hidden")}>
              <FileExplorer className="h-full" />
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
