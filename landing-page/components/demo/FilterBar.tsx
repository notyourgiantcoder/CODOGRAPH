"use client";

import { useDemo } from "@/components/demo/DemoProvider";
import { FILES } from "@/data/repository";
import { ALL_CATEGORIES, CATEGORIES } from "@/lib/categories";
import { cn } from "@/lib/cn";

const COUNTS = Object.fromEntries(CATEGORIES.map((c) => [c.id, FILES.filter((f) => f.category === c.id).length]));

export function CategoryFilters({ className, showTypeToggle = true }: { className?: string; showTypeToggle?: boolean }) {
  const { categories, toggleCategory, setCategories, showTypeEdges, toggleTypeEdges } = useDemo();
  const all = categories.length === ALL_CATEGORIES.length;

  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)} role="group" aria-label="Filter modules by type">
      <button
        type="button"
        onClick={() => setCategories(ALL_CATEGORIES)}
        aria-pressed={all}
        className={cn(
          "h-7 rounded-full border px-2.5 text-[12px] font-medium transition active:scale-95",
          all ? "border-white/20 bg-white/[0.08] text-fg" : "border-line text-subtle hover:text-fg",
        )}
      >
        All
      </button>
      {CATEGORIES.map((c) => {
        const on = categories.includes(c.id);
        return (
          <button
            key={c.id}
            type="button"
            onClick={() => toggleCategory(c.id)}
            aria-pressed={on}
            className={cn(
              "inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-[12px] font-medium transition active:scale-95",
              on ? "border-line-strong bg-white/[0.04] text-fg" : "border-line text-subtle line-through decoration-white/20",
            )}
          >
            <span
              className="size-2 rounded-full transition"
              style={{ backgroundColor: on ? c.color : "transparent", boxShadow: `inset 0 0 0 1.5px ${c.color}` }}
              aria-hidden
            />
            {c.plural}
            <span className="font-mono text-[10.5px] text-subtle">{COUNTS[c.id]}</span>
          </button>
        );
      })}
      {showTypeToggle && (
        <label className="ml-1 inline-flex cursor-pointer items-center gap-2 text-[12px] text-muted select-none">
          <span className="relative inline-flex">
            <input type="checkbox" className="peer sr-only" checked={showTypeEdges} onChange={toggleTypeEdges} />
            <span className="h-4 w-7 rounded-full bg-white/10 transition peer-checked:bg-violet/70 peer-focus-visible:ring-2 peer-focus-visible:ring-violet-soft" />
            <span className="absolute left-0.5 top-0.5 size-3 rounded-full bg-white shadow transition peer-checked:translate-x-3" />
          </span>
          Type-only edges
        </label>
      )}
    </div>
  );
}
