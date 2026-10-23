"use client";

import { RoleDot } from "@/components/ui/role-icon";
import { cn } from "@/lib/cn";
import { railLabel } from "@/lib/roles";
import { useWorkspace } from "./context";

// The landing page's filter chips, one per category this repository's
// frameworks define. A category with no files has nothing to filter, so it
// isn't offered.
export function CategoryFilters({ className }: { className?: string }) {
  const { categories, hiddenCategories, toggleCategory, showAllCategories, showTypeEdges, toggleTypeEdges } = useWorkspace();
  const all = hiddenCategories.size === 0;
  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)} role="group" aria-label="Filter files by category">
      <button
        type="button"
        onClick={showAllCategories}
        aria-pressed={all}
        className={cn(
          "h-7 rounded-full border px-2.5 text-[12px] font-medium transition active:scale-95",
          all ? "border-ink/20 bg-ink/[0.08] text-fg" : "border-line text-subtle hover:text-fg",
        )}
      >
        All
      </button>
      {categories
        .filter((c) => c.count > 0)
        .map((c) => {
          const on = !hiddenCategories.has(c.key);
          return (
            <button
              key={c.key}
              type="button"
              onClick={() => toggleCategory(c.key)}
              aria-pressed={on}
              className={cn(
                "inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-[12px] font-medium transition active:scale-95",
                on ? "border-line-strong bg-ink/[0.04] text-fg" : "border-line text-subtle line-through decoration-ink/20",
              )}
            >
              <RoleDot role={c.key} on={on} />
              {railLabel(c.key)}
              <span className="font-mono text-[10.5px] text-subtle">{c.count}</span>
            </button>
          );
        })}
      <label className="ml-1 inline-flex cursor-pointer items-center gap-2 text-[12px] text-muted select-none">
        <span className="relative inline-flex">
          <input type="checkbox" className="peer sr-only" checked={showTypeEdges} onChange={toggleTypeEdges} />
          <span className="h-4 w-7 rounded-full bg-ink/10 transition peer-checked:bg-violet/70 peer-focus-visible:ring-2 peer-focus-visible:ring-violet-soft" />
          <span className="absolute left-0.5 top-0.5 size-3 rounded-full bg-white shadow transition peer-checked:translate-x-3" />
        </span>
        Type-only edges
      </label>
    </div>
  );
}
