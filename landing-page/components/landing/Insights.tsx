"use client";

import { AnimatePresence, motion, useInView } from "motion/react";
import { ArrowDownUp, BarChart3, Table2 } from "lucide-react";
import { useMemo, useRef, useState, type ReactNode } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useDemo } from "@/components/demo/DemoProvider";
import { CategoryFilters } from "@/components/demo/FilterBar";
import { CategoryIcon } from "@/components/graph/CategoryIcon";
import { useToast } from "@/components/ui/Toast";
import { AnimatedNumber, SectionHeading } from "@/components/ui/primitives";
import { FILES } from "@/data/repository";
import { CATEGORIES, CATEGORY_META, complexityBucket, FLOW_COLORS } from "@/lib/categories";
import { cn, scrollToId } from "@/lib/cn";
import {
  categoryCounts,
  complexityHistogram,
  displayName,
  getFile,
  getMetrics,
  mostConnected,
  summarize,
} from "@/lib/graph";

const AXIS = { fill: "#7d8496", fontSize: 11 };
const GRID = "rgba(255,255,255,0.06)";

export function Insights() {
  const { visibleIds, select, selectedId } = useDemo();
  const toast = useToast();
  const [view, setView] = useState<"charts" | "table">("charts");
  const summary = useMemo(() => summarize(visibleIds), [visibleIds]);

  const pick = (id: string) => {
    select(id, { focus: true });
    toast({
      title: `Selected ${displayName(id)}`,
      description: "The playground graph and inspector now show this module.",
      action: { label: "View in graph", onClick: () => scrollToId("demo") },
    });
  };

  const tiles = [
    { label: "Files in view", value: summary.files, decimals: 0 },
    { label: "Relationships", value: summary.dependencies, decimals: 0 },
    { label: "Network calls", value: summary.byKind.fetch, decimals: 0 },
    { label: "Avg. imports per file", value: summary.avgFanOut, decimals: 1 },
    { label: "Lines (synthetic)", value: summary.totalLoc, decimals: 0 },
  ];

  return (
    <section id="insights" className="relative pb-24 sm:pb-28" aria-labelledby="insights-title">
      <div className="mx-auto max-w-[1180px] px-4 sm:px-6">
        <SectionHeading
          eyebrow="Repository insights"
          title={<span id="insights-title">Metrics that agree with the graph</span>}
          description="Every chart is derived from the same dataset as the playground and respects its filters. Click a module to select it above."
        />

        <div className="mt-12 flex flex-col gap-3 rounded-2xl border border-line bg-panel/70 p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4">
          <CategoryFilters showTypeToggle={false} />
          <div role="tablist" aria-label="Insights view" className="flex shrink-0 rounded-lg border border-line bg-black/20 p-0.5">
            {(
              [
                ["charts", "Charts", BarChart3],
                ["table", "Table", Table2],
              ] as const
            ).map(([id, label, Icon]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={view === id}
                onClick={() => setView(id)}
                className={cn(
                  "flex h-7 items-center gap-1.5 rounded-md px-2.5 text-[12px] font-medium transition",
                  view === id ? "bg-white/[0.08] text-fg" : "text-subtle hover:text-muted",
                )}
              >
                <Icon className="size-3.5" aria-hidden />
                {label}
              </button>
            ))}
          </div>
        </div>

        <dl className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-3 lg:grid-cols-5">
          {tiles.map((t) => (
            <div key={t.label} className="bg-panel px-5 py-4">
              <dt className="text-[12px] text-subtle">{t.label}</dt>
              <dd className="mt-1 text-[26px] font-semibold tracking-tight text-fg">
                <AnimatedNumber value={t.value} decimals={t.decimals} />
              </dd>
            </div>
          ))}
        </dl>

        <AnimatePresence mode="wait" initial={false}>
          {view === "charts" ? (
            <motion.div
              key="charts"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="mt-4 grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-12"
            >
              <ChartCard className="lg:col-span-5" title="Module types" subtitle="Share of all files. Click a slice to show or hide that type.">
                <ModuleTypesChart />
              </ChartCard>
              <ChartCard className="lg:col-span-7" title="Most-connected modules" subtitle="Direct relationships, split by direction. Click a bar to select.">
                <MostConnectedChart onPick={pick} selectedId={selectedId} />
              </ChartCard>
              <ChartCard className="lg:col-span-6" title="Dependency distribution" subtitle="How many files have N direct relationships.">
                <DistributionChart onPick={pick} selectedId={selectedId} />
              </ChartCard>
              <ChartCard className="lg:col-span-6" title="Complexity distribution" subtitle="Synthetic complexity scores, bucketed.">
                <ComplexityChart onPick={pick} selectedId={selectedId} />
              </ChartCard>
            </motion.div>
          ) : (
            <motion.div key="table" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
              <MetricsTable onPick={pick} selectedId={selectedId} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </section>
  );
}

function ChartCard({ title, subtitle, children, className }: { title: string; subtitle: string; children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });
  return (
    <div ref={ref} className={cn("flex flex-col rounded-2xl border border-line bg-panel p-5", className)}>
      <h3 className="text-[14.5px] font-semibold tracking-tight text-fg">{title}</h3>
      <p className="mt-1 text-[12.5px] text-subtle">{subtitle}</p>
      {/* Charts mount on first view so their entrance animation is actually seen. */}
      <div className="mt-4 flex-1">{inView ? children : <div className="h-[260px]" />}</div>
    </div>
  );
}

function TooltipBox({ title, rows }: { title: ReactNode; rows: { label: string; value: ReactNode; color?: string }[] }) {
  return (
    <div className="min-w-[150px] rounded-lg border border-line-strong bg-panel-3/95 px-3 py-2 text-[12px] shadow-xl shadow-black/50 backdrop-blur">
      <p className="mb-1 font-medium text-fg">{title}</p>
      {rows.map((r) => (
        <p key={r.label} className="flex items-center gap-2 text-muted">
          {r.color && <span className="size-2 rounded-sm" style={{ backgroundColor: r.color }} />}
          {r.label}
          <span className="ml-auto pl-3 font-mono tabular-nums text-fg">{r.value}</span>
        </p>
      ))}
    </div>
  );
}

// ── Module types (donut + legend that doubles as the filter) ────────────────

function ModuleTypesChart() {
  const { categories, toggleCategory } = useDemo();
  const data = useMemo(() => categoryCounts(FILES.map((f) => f.id)), []);
  const visible = data.filter((d) => categories.includes(d.id)).reduce((n, d) => n + d.count, 0);

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row">
      <div className="relative h-[220px] w-[220px] shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="count"
              nameKey="plural"
              innerRadius={68}
              outerRadius={100}
              paddingAngle={2}
              stroke="#111318"
              strokeWidth={2}
              animationDuration={900}
              onClick={(_, i) => toggleCategory(data[i].id)}
              className="cursor-pointer outline-none"
            >
              {data.map((d) => (
                <Cell key={d.id} fill={d.color} fillOpacity={categories.includes(d.id) ? 1 : 0.18} />
              ))}
            </Pie>
            <Tooltip
              content={({ active, payload }) =>
                active && payload?.[0] ? (
                  <TooltipBox
                    title={String(payload[0].name)}
                    rows={[
                      { label: "Files", value: payload[0].value as number, color: (payload[0].payload as { color: string }).color },
                      { label: "Share", value: `${Math.round(((payload[0].value as number) / FILES.length) * 100)}%` },
                    ]}
                  />
                ) : null
              }
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <AnimatedNumber value={visible} className="text-[28px] font-semibold tracking-tight text-fg" />
          <span className="text-[11px] text-subtle">of {FILES.length} files</span>
        </div>
      </div>
      <ul className="grid w-full grid-cols-2 gap-1 sm:grid-cols-1">
        {data.map((d) => {
          const on = categories.includes(d.id);
          return (
            <li key={d.id}>
              <button
                type="button"
                onClick={() => toggleCategory(d.id)}
                aria-pressed={on}
                className={cn("flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-[12.5px] transition hover:bg-white/[0.04]", !on && "opacity-45")}
              >
                <CategoryIcon category={d.id} size="xs" />
                <span className="text-muted">{d.plural}</span>
                <span className="ml-auto font-mono tabular-nums text-fg">{d.count}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ── Most connected (stacked horizontal bars) ────────────────────────────────

type LabelGeometry = { x?: number | string; y?: number | string; width?: number | string; height?: number | string; index?: number };

function MostConnectedChart({ onPick, selectedId }: { onPick: (id: string) => void; selectedId: string | null }) {
  const { visibleIds } = useDemo();
  const data = useMemo(
    () =>
      mostConnected(visibleIds, 8).map((m) => ({
        id: m.id,
        name: displayName(m.id),
        fanIn: m.fanIn,
        fanOut: m.fanOut,
        degree: m.degree,
      })),
    [visibleIds],
  );
  const hasSelected = !!selectedId && data.some((d) => d.id === selectedId);
  const dim = (id: string) => (hasSelected && selectedId !== id ? 0.35 : 1);
  // The total sits after whichever segment ends the bar (a zero-width segment renders no label).
  const totalLabel = (segment: "fanIn" | "fanOut") =>
    function TotalLabel({ x, y, width, height, index }: LabelGeometry) {
      const row = data[index ?? 0];
      if (!row || (segment === "fanIn") !== (row.fanOut === 0)) return null;
      return (
        <text x={Number(x) + Number(width) + 6} y={Number(y) + Number(height) / 2} dy={4} fill="#949baa" fontSize={11}>
          {row.degree}
        </text>
      );
    };

  if (!data.length) return <EmptyChart />;
  return (
    <div>
      <div className="mb-2 flex gap-4 text-[11.5px] text-muted">
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm" style={{ backgroundColor: FLOW_COLORS.incoming }} /> Imported by
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm" style={{ backgroundColor: FLOW_COLORS.outgoing }} /> Imports
        </span>
      </div>
      <ResponsiveContainer width="100%" height={262}>
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 28, bottom: 0, left: 0 }} barCategoryGap={6}>
          <CartesianGrid horizontal={false} stroke={GRID} />
          <XAxis type="number" tick={AXIS} axisLine={false} tickLine={false} allowDecimals={false} />
          <YAxis
            type="category"
            dataKey="name"
            width={150}
            tick={{ ...AXIS, fill: "#c3c7d1", fontFamily: "var(--font-geist-mono)" }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            cursor={{ fill: "rgba(255,255,255,0.04)" }}
            content={({ active, payload }) => {
              const row = payload?.[0]?.payload as (typeof data)[number] | undefined;
              return active && row ? (
                <TooltipBox
                  title={<span className="font-mono">{row.name}</span>}
                  rows={[
                    { label: "Imported by", value: row.fanIn, color: FLOW_COLORS.incoming },
                    { label: "Imports", value: row.fanOut, color: FLOW_COLORS.outgoing },
                    { label: "Total", value: row.degree },
                  ]}
                />
              ) : null;
            }}
          />
          <Bar dataKey="fanIn" stackId="d" fill={FLOW_COLORS.incoming} stroke="#111318" strokeWidth={2} animationDuration={800} onClick={(d) => onPick((d.payload as { id: string }).id)} className="cursor-pointer">
            {data.map((d) => (
              <Cell key={d.id} fillOpacity={dim(d.id)} />
            ))}
            <LabelList dataKey="degree" content={totalLabel("fanIn")} />
          </Bar>
          <Bar
            dataKey="fanOut"
            stackId="d"
            fill={FLOW_COLORS.outgoing}
            stroke="#111318"
            strokeWidth={2}
            radius={[0, 4, 4, 0]}
            animationDuration={800}
            animationBegin={150}
            onClick={(d) => onPick((d.payload as { id: string }).id)}
            className="cursor-pointer"
          >
            {data.map((d) => (
              <Cell key={d.id} fillOpacity={dim(d.id)} />
            ))}
            <LabelList dataKey="degree" content={totalLabel("fanOut")} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Dependency distribution (histogram) ─────────────────────────────────────

function DistributionChart({ onPick, selectedId }: { onPick: (id: string) => void; selectedId: string | null }) {
  const { visibleIds } = useDemo();
  const [measure, setMeasure] = useState<"fanIn" | "fanOut">("fanIn");
  const [bin, setBin] = useState<string | null>(null);
  const color = measure === "fanIn" ? FLOW_COLORS.incoming : FLOW_COLORS.outgoing;

  const data = useMemo(() => {
    const values = visibleIds.map((id) => ({ id, v: getMetrics(id)[measure] }));
    const cap = 6;
    return Array.from({ length: cap + 1 }, (_, i) => {
      const files = values.filter((x) => (i === cap ? x.v >= cap : x.v === i)).map((x) => x.id);
      return { label: i === cap ? `${cap}+` : String(i), count: files.length, files };
    });
  }, [visibleIds, measure]);

  const selectedBin = data.find((d) => selectedId && d.files.includes(selectedId))?.label;
  const openBin = data.find((d) => d.label === bin);

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <div role="radiogroup" aria-label="Measure" className="flex rounded-md border border-line bg-black/20 p-0.5 text-[11.5px]">
          {(
            [
              ["fanIn", "Imported by"],
              ["fanOut", "Imports"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={measure === id}
              onClick={() => {
                setMeasure(id);
                setBin(null);
              }}
              className={cn("flex items-center gap-1.5 rounded px-2 py-0.5 transition", measure === id ? "bg-white/[0.08] text-fg" : "text-subtle")}
            >
              <ArrowDownUp className="size-3" aria-hidden />
              {label}
            </button>
          ))}
        </div>
        <span className="text-[11px] text-subtle">x: relationships · y: files</span>
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data} margin={{ top: 16, right: 4, bottom: 0, left: -24 }} barCategoryGap={4}>
          <CartesianGrid vertical={false} stroke={GRID} />
          <XAxis dataKey="label" tick={AXIS} axisLine={{ stroke: GRID }} tickLine={false} />
          <YAxis tick={AXIS} axisLine={false} tickLine={false} allowDecimals={false} />
          <Tooltip
            cursor={{ fill: "rgba(255,255,255,0.04)" }}
            content={({ active, payload }) => {
              const row = payload?.[0]?.payload as (typeof data)[number] | undefined;
              return active && row ? (
                <TooltipBox
                  title={`${row.label} ${measure === "fanIn" ? "dependents" : "dependencies"}`}
                  rows={[
                    { label: "Files", value: row.count, color },
                    ...row.files.slice(0, 3).map((id) => ({ label: displayName(id), value: "" })),
                  ]}
                />
              ) : null;
            }}
          />
          <Bar
            dataKey="count"
            fill={color}
            radius={[4, 4, 0, 0]}
            animationDuration={800}
            onClick={(d) => setBin((d.payload as { label: string }).label)}
            className="cursor-pointer"
          >
            {data.map((d) => (
              <Cell
                key={d.label}
                fillOpacity={bin && bin !== d.label ? 0.35 : 1}
                stroke={selectedBin === d.label ? "#f4f5f7" : "none"}
                strokeWidth={selectedBin === d.label ? 1.5 : 0}
              />
            ))}
            <LabelList dataKey="count" position="top" fill="#949baa" fontSize={11} formatter={(v) => (Number(v) ? v : "")} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <FileChips
        files={openBin?.files ?? []}
        hint={selectedBin ? `Outlined bar contains ${displayName(selectedId!)}. Click a bar to list its files.` : "Click a bar to list its files."}
        onPick={onPick}
        onClose={() => setBin(null)}
      />
    </div>
  );
}

// ── Complexity distribution ─────────────────────────────────────────────────

function ComplexityChart({ onPick, selectedId }: { onPick: (id: string) => void; selectedId: string | null }) {
  const { visibleIds } = useDemo();
  const [bucket, setBucket] = useState<string | null>(null);
  const data = useMemo(() => complexityHistogram(visibleIds), [visibleIds]);
  const selectedBucket = selectedId ? complexityBucket(getFile(selectedId).complexity).id : null;
  const open = data.find((d) => d.id === bucket);

  return (
    <div>
      <div className="mb-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted">
        {data.map((d) => (
          <span key={d.id} className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm" style={{ backgroundColor: d.color }} />
            {d.label} <span className="text-subtle">({d.range})</span>
          </span>
        ))}
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data} margin={{ top: 16, right: 4, bottom: 0, left: -24 }} barCategoryGap={10}>
          <CartesianGrid vertical={false} stroke={GRID} />
          <XAxis dataKey="label" tick={AXIS} axisLine={{ stroke: GRID }} tickLine={false} />
          <YAxis tick={AXIS} axisLine={false} tickLine={false} allowDecimals={false} />
          <Tooltip
            cursor={{ fill: "rgba(255,255,255,0.04)" }}
            content={({ active, payload }) => {
              const row = payload?.[0]?.payload as (typeof data)[number] | undefined;
              if (!active || !row) return null;
              const top = [...row.files].sort((a, b) => getFile(b).complexity - getFile(a).complexity).slice(0, 3);
              return (
                <TooltipBox
                  title={`${row.label} complexity · ${row.range}`}
                  rows={[
                    { label: "Files", value: row.count, color: row.color },
                    ...top.map((id) => ({ label: displayName(id), value: getFile(id).complexity })),
                  ]}
                />
              );
            }}
          />
          <Bar dataKey="count" radius={[4, 4, 0, 0]} animationDuration={800} onClick={(d) => setBucket((d.payload as { id: string }).id)} className="cursor-pointer">
            {data.map((d) => (
              <Cell
                key={d.id}
                fill={d.color}
                fillOpacity={bucket && bucket !== d.id ? 0.35 : 1}
                stroke={selectedBucket === d.id ? "#f4f5f7" : "none"}
                strokeWidth={selectedBucket === d.id ? 1.5 : 0}
              />
            ))}
            <LabelList dataKey="count" position="top" fill="#949baa" fontSize={11} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <FileChips
        files={open ? [...open.files].sort((a, b) => getFile(b).complexity - getFile(a).complexity) : []}
        hint="Click a bar to list the files in that bucket."
        onPick={onPick}
        onClose={() => setBucket(null)}
      />
    </div>
  );
}

function FileChips({ files, hint, onPick, onClose }: { files: string[]; hint: string; onPick: (id: string) => void; onClose: () => void }) {
  return (
    <div className="mt-3 min-h-[34px]">
      <AnimatePresence mode="wait" initial={false}>
        {files.length ? (
          <motion.div key={files.join()} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex flex-wrap items-center gap-1.5">
            {files.map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => onPick(id)}
                className="inline-flex items-center gap-1.5 rounded-md border border-line-strong bg-white/[0.03] px-1.5 py-0.5 font-mono text-[11px] text-muted transition hover:border-violet/50 hover:text-fg"
              >
                <CategoryIcon category={getFile(id).category} size="xs" />
                {displayName(id)}
              </button>
            ))}
            <button type="button" onClick={onClose} className="px-1 text-[11px] text-subtle hover:text-fg">
              Clear
            </button>
          </motion.div>
        ) : (
          <motion.p key="hint" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="pt-1.5 text-[11.5px] text-subtle">
            {hint}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}

function EmptyChart() {
  return (
    <div className="flex h-[262px] items-center justify-center rounded-lg border border-dashed border-line text-[12.5px] text-subtle">
      No module types selected.
    </div>
  );
}

// ── Table view (accessible equivalent of the charts) ────────────────────────

type SortKey = "path" | "category" | "fanIn" | "fanOut" | "reach" | "complexity";

function MetricsTable({ onPick, selectedId }: { onPick: (id: string) => void; selectedId: string | null }) {
  const { visibleIds } = useDemo();
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "fanIn", dir: -1 });
  const rows = useMemo(() => {
    const r = visibleIds.map((id) => {
      const f = getFile(id);
      const m = getMetrics(id);
      return { id, path: f.path, category: f.category, fanIn: m.fanIn, fanOut: m.fanOut, reach: m.reach, complexity: f.complexity };
    });
    const order = CATEGORIES.map((c) => c.id);
    return r.sort((a, b) => {
      const k = sort.key;
      const av = k === "category" ? order.indexOf(a.category) : a[k];
      const bv = k === "category" ? order.indexOf(b.category) : b[k];
      return (av < bv ? -1 : av > bv ? 1 : a.path.localeCompare(b.path)) * sort.dir;
    });
  }, [visibleIds, sort]);

  const head: { key: SortKey; label: string; numeric?: boolean }[] = [
    { key: "path", label: "File" },
    { key: "category", label: "Type" },
    { key: "fanIn", label: "Imported by", numeric: true },
    { key: "fanOut", label: "Imports", numeric: true },
    { key: "reach", label: "Reach", numeric: true },
    { key: "complexity", label: "Complexity", numeric: true },
  ];

  return (
    <div className="scrollbar-thin mt-4 max-h-[620px] overflow-auto rounded-2xl border border-line bg-panel">
      <table className="w-full min-w-[640px] text-left text-[12.5px]">
        <thead className="sticky top-0 z-10 bg-panel-2">
          <tr>
            {head.map((h) => (
              <th key={h.key} scope="col" className={cn("border-b border-line px-4 py-2.5 font-medium text-subtle", h.numeric && "text-right")} aria-sort={sort.key === h.key ? (sort.dir === 1 ? "ascending" : "descending") : "none"}>
                <button
                  type="button"
                  onClick={() => setSort((s) => ({ key: h.key, dir: s.key === h.key ? (s.dir === 1 ? -1 : 1) : h.numeric ? -1 : 1 }))}
                  className={cn("inline-flex items-center gap-1 transition hover:text-fg", sort.key === h.key && "text-fg")}
                >
                  {h.label}
                  {sort.key === h.key && <span aria-hidden>{sort.dir === 1 ? "↑" : "↓"}</span>}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.id}
              onClick={() => onPick(r.id)}
              className={cn("cursor-pointer border-b border-line/60 transition last:border-0 hover:bg-white/[0.03]", selectedId === r.id && "bg-violet/[0.1]")}
            >
              <td className="px-4 py-2 font-mono text-fg">
                <button type="button" className="text-left hover:underline" onClick={(e) => { e.stopPropagation(); onPick(r.id); }}>
                  {r.path}
                </button>
              </td>
              <td className="px-4 py-2">
                <span className="inline-flex items-center gap-1.5 text-muted">
                  <CategoryIcon category={r.category} size="xs" />
                  {CATEGORY_META[r.category].label}
                </span>
              </td>
              <td className="px-4 py-2 text-right font-mono tabular-nums text-fg">{r.fanIn}</td>
              <td className="px-4 py-2 text-right font-mono tabular-nums text-fg">{r.fanOut}</td>
              <td className="px-4 py-2 text-right font-mono tabular-nums text-fg">{r.reach}</td>
              <td className="px-4 py-2 text-right font-mono tabular-nums text-fg">{r.complexity}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
