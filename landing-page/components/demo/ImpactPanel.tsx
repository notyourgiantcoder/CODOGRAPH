"use client";

import { AnimatePresence, motion } from "motion/react";
import { useId } from "react";
import { Radar, RotateCcw, TriangleAlert, X } from "lucide-react";
import { useDemo, useRevealedImpact } from "@/components/demo/DemoProvider";
import { CategoryIcon } from "@/components/graph/CategoryIcon";
import { AnimatedNumber, Button } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";
import { displayName, getFile } from "@/lib/graph";
import { explainImpact, groupByDepth, IMPACT_MODES, impactByCategory } from "@/lib/impact";

export function ImpactModeToggle({ className }: { className?: string }) {
  const { impactMode, setImpactMode } = useDemo();
  const pill = useId();
  return (
    <div
      role="radiogroup"
      aria-label="Impact analysis mode"
      className={cn("grid grid-cols-3 rounded-lg border border-line bg-black/20 p-0.5", className)}
    >
      {IMPACT_MODES.map((m) => (
        <button
          key={m.id}
          type="button"
          role="radio"
          aria-checked={impactMode === m.id}
          title={m.description}
          onClick={() => setImpactMode(m.id)}
          className={cn(
            "relative h-7 rounded-md text-[12px] font-medium transition",
            impactMode === m.id ? "text-fg" : "text-subtle hover:text-muted",
          )}
        >
          {impactMode === m.id && (
            <motion.span
              layoutId={pill}
              className="absolute inset-0 rounded-md border border-line-strong bg-white/[0.07]"
              transition={{ type: "spring", stiffness: 500, damping: 38 }}
            />
          )}
          <span className="relative">{m.label}</span>
        </button>
      ))}
    </div>
  );
}

export function ImpactPanel({ fileId }: { fileId: string }) {
  const { impactMode, runImpact, clearImpact, select, isRevealing } = useDemo();
  const impact = useRevealedImpact();
  const mode = IMPACT_MODES.find((m) => m.id === impactMode)!;
  const isCurrent = impact && impact.origin === fileId && impact.mode === impactMode;

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <ImpactModeToggle />
        <p className="text-[12px] leading-relaxed text-subtle">{mode.description}</p>
      </div>

      <div className="flex gap-2">
        <Button size="sm" className="flex-1" onClick={() => runImpact(fileId, impactMode)}>
          {isCurrent ? <RotateCcw className="size-3.5" aria-hidden /> : <Radar className="size-3.5" aria-hidden />}
          {isCurrent ? "Re-run analysis" : "Analyze impact"}
        </Button>
        {impact && (
          <Button size="sm" variant="secondary" onClick={clearImpact}>
            <X className="size-3.5" aria-hidden />
            Clear analysis
          </Button>
        )}
      </div>

      <AnimatePresence mode="wait">
        {impact ? (
          <motion.div
            key={`${impact.origin}-${impact.mode}`}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2 }}
            className="space-y-4"
          >
            {impact.origin !== fileId && (
              <p className="rounded-lg border border-line bg-white/[0.02] px-3 py-2 text-[12px] text-muted">
                Showing the analysis for{" "}
                <button type="button" className="font-mono text-cyan hover:underline" onClick={() => select(impact.origin, { focus: true })}>
                  {displayName(impact.origin)}
                </button>
                .
              </p>
            )}

            <div className="grid grid-cols-3 gap-2">
              <Metric label={impact.mode === "upstream" ? "Dependencies" : "Affected files"} value={impact.revealed} accent />
              <Metric label="Max hops" value={impact.maxDepth} />
              <Metric
                label="Routes reached"
                value={impact.order.slice(0, impact.revealed).filter((id) => getFile(id).category === "route").length}
              />
            </div>

            {impact.order.length > 0 && (
              <div className="flex h-1.5 overflow-hidden rounded-full bg-white/[0.04]" aria-hidden>
                {impactByCategory(impact.order.slice(0, impact.revealed)).map((c) => (
                  <motion.span
                    key={c.id}
                    layout
                    className="h-full border-r-2 border-panel last:border-r-0"
                    style={{ backgroundColor: c.color, flexGrow: c.count }}
                  />
                ))}
              </div>
            )}

            <p className="text-[12.5px] leading-relaxed text-muted">
              {isRevealing ? "Traversing the dependency graph…" : explainImpact(impact)}
            </p>

            <div className="space-y-3">
              {groupByDepth(impact, impact.order.slice(0, impact.revealed)).map(([depth, ids]) => (
                <div key={depth}>
                  <p className="mb-1.5 font-mono text-[10.5px] uppercase tracking-wider text-subtle">
                    Hop {depth} · {ids.length}
                  </p>
                  <ul className="space-y-1">
                    {ids.map((id) => (
                      <motion.li key={id} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.2 }}>
                        <button
                          type="button"
                          onClick={() => select(id, { focus: true })}
                          className="flex w-full items-center gap-2 rounded-md border border-transparent px-2 py-1 text-left transition hover:border-line hover:bg-white/[0.03]"
                        >
                          <CategoryIcon category={getFile(id).category} size="xs" />
                          <span className="truncate font-mono text-[12px] text-fg">{displayName(id)}</span>
                          <span className="ml-auto truncate font-mono text-[10.5px] text-subtle">{getFile(id).path.split("/")[0]}/</span>
                        </button>
                      </motion.li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            <ImpactDisclaimer />
          </motion.div>
        ) : (
          <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <ImpactDisclaimer />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function ImpactDisclaimer() {
  return (
    <p className="flex gap-2 rounded-lg border border-amber-400/15 bg-amber-400/[0.04] px-3 py-2 text-[11.5px] leading-relaxed text-amber-100/70">
      <TriangleAlert className="mt-0.5 size-3.5 shrink-0 text-amber-300/80" aria-hidden />
      Illustrative dependency analysis over synthetic data. It shows static relationships, not a prediction of runtime breakage.
    </p>
  );
}

function Metric({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className="rounded-lg border border-line bg-white/[0.02] px-2.5 py-2">
      <AnimatedNumber value={value} className={cn("block text-xl font-semibold tracking-tight", accent ? "text-cyan" : "text-fg")} />
      <span className="text-[10.5px] text-subtle">{label}</span>
    </div>
  );
}

/** Floating summary shown over the graph while an analysis is active. */
export function ImpactBanner({ className }: { className?: string }) {
  const { clearImpact, isRevealing } = useDemo();
  const impact = useRevealedImpact();
  return (
    <AnimatePresence>
      {impact && (
        <motion.div
          initial={{ opacity: 0, y: -8, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8, scale: 0.97 }}
          transition={{ type: "spring", stiffness: 420, damping: 34 }}
          className={cn(
            "pointer-events-auto flex max-w-[calc(100%-1.5rem)] items-center gap-3 overflow-hidden rounded-xl border border-cyan/30 bg-[#0c1a21]/90 py-1.5 pl-3 pr-1.5 shadow-[0_10px_40px_-10px_rgba(103,213,255,0.45)] backdrop-blur",
            className,
          )}
          role="status"
        >
          <span className="relative flex size-2 shrink-0">
            {isRevealing && <span className="absolute inset-0 animate-ping rounded-full bg-cyan/70" />}
            <span className="relative size-2 rounded-full bg-cyan" />
          </span>
          <p className="min-w-0 truncate text-[12px] text-muted">
            <span className="font-medium capitalize text-fg">{impact.mode}</span> from{" "}
            <span className="font-mono text-cyan">{displayName(impact.origin)}</span>
            <span className="text-subtle"> · </span>
            <span className="font-medium text-fg tabular-nums">{impact.revealed}</span> files
            <span className="text-subtle"> · </span>
            {impact.maxDepth} hops
          </p>
          <button
            type="button"
            onClick={clearImpact}
            className="inline-flex h-6 shrink-0 items-center gap-1 rounded-md border border-line-strong px-2 text-[11px] font-medium text-fg transition hover:bg-white/[0.06]"
          >
            <X className="size-3" aria-hidden />
            Clear
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
