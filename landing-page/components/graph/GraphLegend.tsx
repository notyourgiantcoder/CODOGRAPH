"use client";

import { AnimatePresence, motion } from "motion/react";
import { ChevronDown, Layers } from "lucide-react";
import { useState } from "react";
import { CategoryIcon } from "@/components/graph/CategoryIcon";
import { CATEGORIES } from "@/lib/categories";
import { cn } from "@/lib/cn";
import { FILES } from "@/data/repository";

const EDGE_SAMPLES = [
  { label: "Import", dash: undefined, color: "rgba(148,155,170,0.7)" },
  { label: "Type-only", dash: "2 4", color: "rgba(148,155,170,0.6)" },
  { label: "Network", dash: "7 5", color: "rgba(103,213,255,0.8)" },
  { label: "Imports", dash: undefined, color: "#67d5ff" },
  { label: "Imported by", dash: undefined, color: "#a78bfa" },
];

export function GraphLegend({ defaultOpen = true, className }: { defaultOpen?: boolean; className?: string }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div
      className={cn(
        "w-[232px] overflow-hidden rounded-xl border border-line-strong bg-panel/90 text-[11px] shadow-xl shadow-black/40 backdrop-blur",
        className,
      )}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-3 py-2 text-left font-medium text-fg transition hover:bg-white/[0.03]"
      >
        <Layers className="size-3.5 text-muted" aria-hidden />
        Legend
        <ChevronDown className={cn("ml-auto size-3.5 text-muted transition-transform", open && "rotate-180")} aria-hidden />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.2, 0.8, 0.2, 1] }}
          >
            <ul className="grid grid-cols-2 gap-x-3 gap-y-1.5 border-t border-line px-3 py-2.5">
              {CATEGORIES.map((c) => (
                <li key={c.id} className="flex items-center gap-2 text-muted">
                  <CategoryIcon category={c.id} size="xs" />
                  {c.plural}
                  <span className="ml-auto font-mono tabular-nums text-subtle">
                    {FILES.filter((f) => f.category === c.id).length}
                  </span>
                </li>
              ))}
            </ul>
            <ul className="grid grid-cols-2 gap-x-3 gap-y-1.5 border-t border-line px-3 py-2.5">
              {EDGE_SAMPLES.map((e) => (
                <li key={e.label} className="flex items-center gap-2 text-muted">
                  <svg width="16" height="6" className="shrink-0" aria-hidden>
                    <line x1="0" y1="3" x2="16" y2="3" stroke={e.color} strokeWidth="1.6" strokeDasharray={e.dash} />
                  </svg>
                  {e.label}
                </li>
              ))}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
