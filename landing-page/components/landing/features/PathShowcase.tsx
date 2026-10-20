"use client";

import { AnimatePresence, motion } from "motion/react";
import { ArrowDown, ChevronDown } from "lucide-react";
import { useMemo, useState } from "react";
import { CategoryIcon } from "@/components/graph/CategoryIcon";
import { FILES } from "@/data/repository";
import { EDGE_KIND_META } from "@/lib/categories";
import { cn } from "@/lib/cn";
import { displayName, evidenceFor, findPath, getFile } from "@/lib/graph";

const FROM_OPTIONS = FILES.filter((f) => f.category === "route" || f.category === "component");
const TO_OPTIONS = FILES.filter((f) => f.layer >= 5);

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: typeof FILES }) {
  return (
    <label className="relative block min-w-0 flex-1">
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 w-full appearance-none truncate rounded-lg border border-line-strong bg-panel-2 pl-2.5 pr-7 font-mono text-[11.5px] text-fg outline-none transition hover:border-white/20 focus:border-violet/60"
      >
        {options.map((f) => (
          <option key={f.id} value={f.id}>
            {f.path}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2 top-1/2 size-3.5 -translate-y-1/2 text-subtle" aria-hidden />
    </label>
  );
}

export function PathShowcase() {
  const [from, setFrom] = useState("app-products-page");
  const [to, setTo] = useState("lib-database");
  const path = useMemo(() => findPath(from, to), [from, to]);

  return (
    <div className="flex flex-1 flex-col px-6 pb-6 sm:px-7 sm:pb-7">
      <p className="mb-2 text-[12px] text-subtle">How does this…</p>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Select label="From module" value={from} onChange={setFrom} options={FROM_OPTIONS} />
        <span className="text-center text-[12px] text-subtle">reach</span>
        <Select label="To module" value={to} onChange={setTo} options={TO_OPTIONS} />
      </div>

      <div className="mt-4 flex-1 rounded-xl border border-line bg-black/20 p-3">
        <AnimatePresence mode="wait">
          <motion.ol key={`${from}-${to}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-0">
            {path ? (
              [from, ...path.map((d) => d.target)].map((id, i) => {
                const edge = path[i];
                return (
                  <motion.li
                    key={id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.12, duration: 0.3 }}
                  >
                    <div className="flex items-center gap-2 rounded-lg px-1.5 py-1">
                      <CategoryIcon category={getFile(id).category} size="sm" />
                      <span className="truncate font-mono text-[12px] text-fg">{displayName(id)}</span>
                      <span className="ml-auto truncate font-mono text-[10px] text-subtle">{getFile(id).path}</span>
                    </div>
                    {edge && (
                      <div className="ml-[15px] flex items-center gap-2 border-l border-dashed border-line-strong py-1 pl-3.5">
                        <ArrowDown className={cn("size-3", edge.kind === "fetch" ? "text-cyan" : "text-subtle")} aria-hidden />
                        <span className={cn("text-[10.5px]", edge.kind === "fetch" ? "text-cyan" : "text-subtle")}>
                          {EDGE_KIND_META[edge.kind].verb}
                        </span>
                        <code className="hidden min-w-0 truncate font-mono text-[10px] text-[#5d6274] sm:block">
                          L{evidenceFor(edge).line}
                        </code>
                      </div>
                    )}
                  </motion.li>
                );
              })
            ) : (
              <li className="py-6 text-center text-[12.5px] text-subtle">
                No dependency path — <span className="font-mono text-muted">{displayName(from)}</span> never reaches{" "}
                <span className="font-mono text-muted">{displayName(to)}</span>.
              </li>
            )}
          </motion.ol>
        </AnimatePresence>
      </div>
      <p className="mt-3 text-[11.5px] text-subtle">
        {path ? `${path.length} hops, computed by breadth-first search over parsed edges.` : "Computed by breadth-first search over parsed edges."}
      </p>
    </div>
  );
}
