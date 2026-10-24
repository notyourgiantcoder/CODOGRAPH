"use client";

import { AnimatePresence, motion } from "motion/react";
import { ChevronDown, Layers } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { railLabel, type RailKey } from "@/lib/roles";
import { RoleIcon } from "@/components/ui/role-icon";

const EDGE_SAMPLES = [
  { label: "Import", dash: undefined, color: "color-mix(in srgb, var(--subtle) 80%, transparent)" },
  { label: "Type-only", dash: "2 4", color: "color-mix(in srgb, var(--subtle) 70%, transparent)" },
  { label: "Network", dash: "7 5", color: "color-mix(in srgb, var(--cyan) 80%, transparent)" },
  { label: "Imports", dash: undefined, color: "var(--cyan)" },
  { label: "Imported by", dash: undefined, color: "var(--violet-soft)" },
];

export function MapLegend({ categories, className }: { categories: { key: RailKey; count: number }[]; className?: string }) {
  // Closed at first: open, it covers a corner of the map's boxes.
  const [open, setOpen] = useState(false);
  const shown = categories.filter((c) => c.count > 0);
  return (
    <div className={cn("w-[248px] overflow-hidden rounded-xl border border-line-strong bg-panel/90 text-[11px] shadow-xl shadow-black/30 backdrop-blur", className)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-3 py-2 text-left font-medium text-fg transition hover:bg-ink/[0.03]"
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
            <ul className="scrollbar-thin grid max-h-[132px] grid-cols-2 gap-x-3 gap-y-1.5 overflow-y-auto border-t border-line px-3 py-2.5">
              {shown.map((c) => (
                <li key={c.key} className="flex min-w-0 items-center gap-2 text-muted">
                  <RoleIcon role={c.key} size="xs" />
                  <span className="truncate">{railLabel(c.key)}</span>
                  <span className="ml-auto font-mono tabular-nums text-subtle">{c.count}</span>
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
