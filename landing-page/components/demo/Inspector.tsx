"use client";

import { AnimatePresence, motion } from "motion/react";
import { ArrowDownRight, ArrowUpLeft, MousePointerClick, Radar } from "lucide-react";
import { useId, type ReactNode } from "react";
import { useDemo, type InspectorTab } from "@/components/demo/DemoProvider";
import { ImpactPanel } from "@/components/demo/ImpactPanel";
import { CategoryIcon } from "@/components/graph/CategoryIcon";
import { CodeBlock } from "@/components/ui/CodeBlock";
import { Button, CopyButton } from "@/components/ui/primitives";
import { CATEGORY_META, complexityBucket, EDGE_KIND_META } from "@/lib/categories";
import { cn } from "@/lib/cn";
import {
  displayName,
  evidenceFor,
  generateSource,
  getFile,
  getIncoming,
  getMetrics,
  getOutgoing,
} from "@/lib/graph";
import type { Dependency } from "@/types/graph";

const QUICK_PICKS = ["lib-products", "hooks-use-cart", "components-product-card"];

const TABS: { id: InspectorTab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "dependencies", label: "Deps" },
  { id: "dependents", label: "Dependents" },
  { id: "code", label: "Code" },
  { id: "impact", label: "Impact" },
];

export function Inspector({ variant = "full", className }: { variant?: "full" | "compact"; className?: string }) {
  const { selectedId, select } = useDemo();

  if (!selectedId) {
    return (
      <div className={cn("flex h-full flex-col items-center justify-center gap-4 p-6 text-center", className)}>
        <div className="flex size-11 items-center justify-center rounded-xl border border-line-strong bg-white/[0.03]">
          <MousePointerClick className="size-5 text-muted" aria-hidden />
        </div>
        <div>
          <p className="text-sm font-medium text-fg">Select a module</p>
          <p className="mt-1 text-[12.5px] text-subtle">Click a node, a file in the explorer, or search to inspect it.</p>
        </div>
        <div className="flex flex-wrap justify-center gap-1.5">
          {QUICK_PICKS.map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => select(id, { focus: true })}
              className="inline-flex items-center gap-1.5 rounded-full border border-line-strong px-2.5 py-1 font-mono text-[11px] text-muted transition hover:bg-white/[0.05] hover:text-fg"
            >
              <CategoryIcon category={getFile(id).category} size="xs" />
              {displayName(id)}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return variant === "compact" ? (
    <CompactInspector id={selectedId} className={className} />
  ) : (
    <FullInspector id={selectedId} className={className} />
  );
}

function Header({ id, compact }: { id: string; compact?: boolean }) {
  const file = getFile(id);
  const meta = CATEGORY_META[file.category];
  return (
    <div className="flex items-start gap-3">
      <CategoryIcon category={file.category} className={compact ? undefined : "size-9 rounded-xl"} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h3 className="truncate text-[15px] font-semibold tracking-tight text-fg">{displayName(id)}</h3>
          <span
            className="shrink-0 rounded-full px-1.5 py-px text-[10px] font-medium"
            style={{ color: meta.color, backgroundColor: `${meta.color}1f` }}
          >
            {meta.label}
          </span>
        </div>
        <p className="mt-0.5 truncate font-mono text-[11px] text-subtle">{file.path}</p>
      </div>
      {!compact && <CopyButton text={file.path} label="Path" toastTitle={`Copied ${file.path}`} />}
    </div>
  );
}

function Stats({ id, compact }: { id: string; compact?: boolean }) {
  const file = getFile(id);
  const m = getMetrics(id);
  const bucket = complexityBucket(file.complexity);
  const items = [
    { label: "Incoming", value: m.fanIn, hint: "Files that import it" },
    { label: "Outgoing", value: m.fanOut, hint: "Files it imports" },
    { label: "Complexity", value: file.complexity, hint: `${bucket.label} (synthetic)` },
    ...(compact ? [] : [{ label: "Lines", value: file.loc, hint: "Illustrative LOC" }]),
  ];
  return (
    <dl className={cn("grid gap-1.5", compact ? "grid-cols-3" : "grid-cols-4")}>
      {items.map((s) => (
        <div key={s.label} className="rounded-lg border border-line bg-white/[0.02] px-2 py-1.5" title={s.hint}>
          <dt className="text-[10px] text-subtle">{s.label}</dt>
          <dd className="font-mono text-[15px] font-medium tabular-nums text-fg">{s.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function FullInspector({ id, className }: { id: string; className?: string }) {
  const { tab, setTab } = useDemo();
  const pill = useId();
  const counts: Partial<Record<InspectorTab, number>> = {
    dependencies: getOutgoing(id).length,
    dependents: getIncoming(id).length,
  };

  return (
    <div className={cn("flex h-full min-h-0 flex-col", className)}>
      <div className="space-y-3 border-b border-line p-4">
        <Header id={id} />
        <Stats id={id} />
      </div>
      <div role="tablist" aria-label="Inspector sections" className="scrollbar-thin flex shrink-0 overflow-x-auto border-b border-line px-1.5">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "relative flex h-9 shrink-0 items-center gap-1 px-2 text-[12.5px] font-medium transition",
              tab === t.id ? "text-fg" : "text-subtle hover:text-muted",
            )}
          >
            {t.label}
            {counts[t.id] !== undefined && (
              <span className="rounded bg-white/[0.06] px-1 font-mono text-[10px] text-muted">{counts[t.id]}</span>
            )}
            {tab === t.id && (
              <motion.span layoutId={pill} className="absolute inset-x-1.5 -bottom-px h-0.5 rounded-full bg-violet" />
            )}
          </button>
        ))}
      </div>
      <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto p-4" role="tabpanel">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={`${tab}-${id}`}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.16, ease: "easeOut" }}
          >
            {tab === "overview" && <Overview id={id} />}
            {tab === "dependencies" && <DependencyList deps={getOutgoing(id)} direction="out" />}
            {tab === "dependents" && <DependencyList deps={getIncoming(id)} direction="in" />}
            {tab === "code" && <CodeTab id={id} />}
            {tab === "impact" && <ImpactPanel fileId={id} />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

function CompactInspector({ id, className }: { id: string; className?: string }) {
  const { runImpact, select } = useDemo();
  const neighbors = [
    ...getOutgoing(id).map((d) => ({ id: d.target, dir: "out" as const })),
    ...getIncoming(id).map((d) => ({ id: d.source, dir: "in" as const })),
  ];
  return (
    <div className={cn("flex h-full min-h-0 flex-col gap-3 p-3.5", className)}>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={id}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.16 }}
          className="flex min-h-0 flex-1 flex-col gap-3"
        >
          <Header id={id} compact />
          <p className="line-clamp-2 text-[12px] leading-relaxed text-muted">{getFile(id).description}</p>
          <Stats id={id} compact />
          <div className="min-h-0 flex-1">
            <p className="mb-1.5 text-[10.5px] font-medium uppercase tracking-wider text-subtle">Connected modules</p>
            <ul className="scrollbar-thin max-h-full space-y-0.5 overflow-y-auto">
              {neighbors.slice(0, 6).map((n) => (
                <li key={`${n.dir}-${n.id}`}>
                  <button
                    type="button"
                    onClick={() => select(n.id, { focus: true })}
                    className="flex w-full items-center gap-2 rounded-md px-1.5 py-1 text-left transition hover:bg-white/[0.04]"
                  >
                    <DirectionIcon dir={n.dir} />
                    <span className="truncate font-mono text-[11.5px] text-muted">{displayName(n.id)}</span>
                  </button>
                </li>
              ))}
              {neighbors.length > 6 && (
                <li className="px-1.5 py-1 text-[11px] text-subtle">+{neighbors.length - 6} more</li>
              )}
            </ul>
          </div>
        </motion.div>
      </AnimatePresence>
      <Button size="sm" onClick={() => runImpact(id, "downstream")} className="w-full">
        <Radar className="size-3.5" aria-hidden />
        Analyze impact
      </Button>
    </div>
  );
}

function DirectionIcon({ dir }: { dir: "in" | "out" }) {
  return dir === "out" ? (
    <ArrowDownRight className="size-3.5 shrink-0 text-cyan" aria-label="imports" />
  ) : (
    <ArrowUpLeft className="size-3.5 shrink-0 text-violet-soft" aria-label="imported by" />
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h4 className="mb-2 text-[10.5px] font-medium uppercase tracking-wider text-subtle">{title}</h4>
      {children}
    </section>
  );
}

function Overview({ id }: { id: string }) {
  const { select, setTab } = useDemo();
  const file = getFile(id);
  const bucket = complexityBucket(file.complexity);
  const neighbors = [
    ...getOutgoing(id).map((d) => ({ id: d.target, dir: "out" as const, kind: d.kind })),
    ...getIncoming(id).map((d) => ({ id: d.source, dir: "in" as const, kind: d.kind })),
  ];
  return (
    <div className="space-y-5">
      <Section title="Description">
        <p className="text-[13px] leading-relaxed text-fg/90">{file.description}</p>
        <p className="mt-2 text-[12.5px] leading-relaxed text-muted">{file.summary}</p>
      </Section>
      <Section title="Exports">
        <div className="flex flex-wrap gap-1.5">
          {file.exports.map((e) => (
            <code key={e} className="rounded-md border border-line bg-white/[0.03] px-1.5 py-0.5 font-mono text-[11px] text-fg/90">
              {e}
            </code>
          ))}
        </div>
      </Section>
      <Section title="Complexity">
        <div className="flex items-center gap-3">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.05]">
            <motion.div
              className="h-full rounded-full"
              style={{ backgroundColor: bucket.color }}
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(100, (file.complexity / 20) * 100)}%` }}
              transition={{ duration: 0.6, ease: [0.2, 0.8, 0.2, 1] }}
            />
          </div>
          <span className="text-[12px] text-muted">
            {file.complexity} · {bucket.label}
          </span>
        </div>
      </Section>
      <Section title={`Connected modules · ${neighbors.length}`}>
        {neighbors.length === 0 ? (
          <p className="text-[12.5px] text-subtle">No connections.</p>
        ) : (
          <ul className="space-y-0.5">
            {neighbors.map((n) => (
              <li key={`${n.dir}-${n.id}`}>
                <button
                  type="button"
                  onClick={() => select(n.id, { focus: true })}
                  className="flex w-full items-center gap-2 rounded-md px-1.5 py-1 text-left transition hover:bg-white/[0.04]"
                >
                  <DirectionIcon dir={n.dir} />
                  <CategoryIcon category={getFile(n.id).category} size="xs" />
                  <span className="truncate font-mono text-[12px] text-fg/90">{displayName(n.id)}</span>
                  <span className="ml-auto shrink-0 text-[10.5px] text-subtle">
                    {n.dir === "out" ? EDGE_KIND_META[n.kind].verb : "imported by"}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
        <button type="button" onClick={() => setTab("impact")} className="mt-3 text-[12px] font-medium text-violet-soft hover:underline">
          Analyze the impact of changing this file →
        </button>
      </Section>
    </div>
  );
}

function DependencyList({ deps, direction }: { deps: Dependency[]; direction: "in" | "out" }) {
  const { select } = useDemo();
  if (!deps.length) {
    return (
      <p className="rounded-lg border border-dashed border-line px-3 py-6 text-center text-[12.5px] text-subtle">
        {direction === "out" ? "This module has no internal dependencies." : "No module imports this file — it's an entry point."}
      </p>
    );
  }
  return (
    <ul className="space-y-2">
      {deps.map((d) => {
        const other = direction === "out" ? d.target : d.source;
        const ev = evidenceFor(d);
        return (
          <li key={d.id}>
            <button
              type="button"
              onClick={() => select(other, { focus: true })}
              className="w-full rounded-lg border border-line bg-white/[0.015] p-2.5 text-left transition hover:border-line-strong hover:bg-white/[0.035]"
            >
              <div className="flex items-center gap-2">
                <CategoryIcon category={getFile(other).category} size="sm" />
                <span className="truncate font-mono text-[12.5px] text-fg">{displayName(other)}</span>
                <span
                  className={cn(
                    "ml-auto shrink-0 rounded px-1.5 py-px text-[10px] font-medium",
                    d.kind === "fetch" ? "bg-cyan/10 text-cyan" : d.kind === "type" ? "bg-white/[0.05] text-subtle" : "bg-white/[0.07] text-muted",
                  )}
                >
                  {EDGE_KIND_META[d.kind].label}
                </span>
              </div>
              <p className="mt-1.5 truncate font-mono text-[10.5px] text-subtle">
                <span className="text-[#5d6274]">{displayName(d.source)}:{ev.line}</span> {ev.text}
              </p>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function CodeTab({ id }: { id: string }) {
  const file = getFile(id);
  const { code, lines } = generateSource(id);
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="truncate font-mono text-[11px] text-subtle">{file.path}</p>
        <CopyButton text={code} label="Copy code" toastTitle={`Copied ${displayName(id)}`} />
      </div>
      <CodeBlock code={code} highlightLines={[...lines.values()]} className="max-h-[420px]" />
      <p className="text-[11px] text-subtle">
        Illustrative snippet. Highlighted lines are the statements that create graph edges.
      </p>
    </div>
  );
}
