"use client";

import { AnimatePresence, motion } from "motion/react";
import { ChevronRight } from "lucide-react";
import { useState } from "react";
import { FILES } from "@/data/repository";
import { CATEGORIES } from "@/lib/categories";
import { cn } from "@/lib/cn";
import { displayName, getMetrics } from "@/lib/graph";

const DIRS = [...new Set(FILES.map((f) => f.path.split("/")[0]))].map((dir) => {
  const files = FILES.filter((f) => f.path.startsWith(dir + "/"));
  return {
    dir,
    files,
    loc: files.reduce((n, f) => n + f.loc, 0),
    segments: CATEGORIES.map((c) => ({ ...c, count: files.filter((f) => f.category === c.id).length })).filter((s) => s.count),
  };
});
const MAX = Math.max(...DIRS.map((d) => d.files.length));

export function ExplorationShowcase() {
  const [open, setOpen] = useState<string | null>("components");
  return (
    <ul className="flex-1 space-y-1 px-4 pb-5 sm:px-5">
      {DIRS.map((d, i) => {
        const isOpen = open === d.dir;
        return (
          <li key={d.dir}>
            <button
              type="button"
              onClick={() => setOpen(isOpen ? null : d.dir)}
              aria-expanded={isOpen}
              className={cn(
                "w-full rounded-lg px-2 py-2 text-left transition hover:bg-white/[0.03]",
                isOpen && "bg-white/[0.03]",
              )}
            >
              <div className="flex items-center gap-1.5 text-[12.5px]">
                <ChevronRight className={cn("size-3 text-subtle transition-transform", isOpen && "rotate-90")} aria-hidden />
                <span className="font-mono text-fg">{d.dir}/</span>
                <span className="ml-auto font-mono text-[10.5px] text-subtle">
                  {d.files.length} files · {d.loc} loc
                </span>
              </div>
              <div className="ml-[18px] mt-1.5 flex h-1.5 gap-0.5" style={{ width: `${(d.files.length / MAX) * 100 - 6}%` }}>
                {d.segments.map((s) => (
                  <motion.span
                    key={s.id}
                    className="h-full rounded-full"
                    style={{ backgroundColor: s.color, flexGrow: s.count }}
                    initial={{ scaleX: 0 }}
                    whileInView={{ scaleX: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.6, delay: 0.1 + i * 0.06 }}
                    title={`${s.count} ${s.count === 1 ? s.label.toLowerCase() : s.plural.toLowerCase()}`}
                  />
                ))}
              </div>
            </button>
            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.ul
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.22 }}
                  className="overflow-hidden"
                >
                  {d.files.map((f) => (
                    <li key={f.id} className="flex items-center gap-2 py-0.5 pl-7 pr-2 font-mono text-[11px] text-muted">
                      <span className="truncate">{displayName(f.id)}</span>
                      <span className="ml-auto shrink-0 text-subtle">{getMetrics(f.id).fanIn} ←</span>
                    </li>
                  ))}
                </motion.ul>
              )}
            </AnimatePresence>
          </li>
        );
      })}
    </ul>
  );
}
