"use client";

import { AnimatePresence, motion } from "motion/react";
import { CornerDownLeft, Search, X } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useDemo } from "@/components/demo/DemoProvider";
import { CategoryIcon } from "@/components/graph/CategoryIcon";
import { Kbd } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";
import { displayName, searchFiles } from "@/lib/graph";

export function GraphSearch({
  className,
  hotkey = false,
  placeholder = "Search files…",
}: {
  className?: string;
  /** Bind "/" and ⌘K to focus this search. Only one instance on the page should. */
  hotkey?: boolean;
  placeholder?: string;
}) {
  const { select } = useDemo();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const listId = useId();
  const results = useMemo(() => searchFiles(query, 7), [query]);

  useEffect(() => {
    if (!hotkey) return;
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLElement && e.target.closest("input, textarea, [contenteditable]");
      if ((e.key === "/" && !typing) || (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey))) {
        e.preventDefault();
        input.current?.focus();
        input.current?.scrollIntoView({ block: "center", behavior: "smooth" });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [hotkey]);

  const choose = (id: string) => {
    select(id, { focus: true });
    setQuery("");
    setOpen(false);
    input.current?.blur();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter" && results[active]) {
      e.preventDefault();
      choose(results[active].id);
    } else if (e.key === "Escape") {
      setQuery("");
      setOpen(false);
      input.current?.blur();
    }
  };

  const showList = open && query.trim().length > 0;

  return (
    <div className={cn("relative", className)}>
      <div className="flex h-9 items-center gap-2 rounded-lg border border-line-strong bg-white/[0.03] px-2.5 transition focus-within:border-violet/60 focus-within:bg-white/[0.05] focus-within:shadow-[0_0_0_3px_rgba(139,92,246,0.15)]">
        <Search className="size-3.5 shrink-0 text-subtle" aria-hidden />
        <input
          ref={input}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => window.setTimeout(() => setOpen(false), 120)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          aria-label="Search files in the dependency graph"
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-activedescendant={showList && results[active] ? `${listId}-${results[active].id}` : undefined}
          className="min-w-0 flex-1 bg-transparent text-[13px] text-fg outline-none placeholder:text-subtle"
          autoComplete="off"
          spellCheck={false}
        />
        {query ? (
          <button type="button" onClick={() => setQuery("")} aria-label="Clear search" className="text-subtle hover:text-fg">
            <X className="size-3.5" />
          </button>
        ) : (
          hotkey && <Kbd className="hidden sm:inline-flex">/</Kbd>
        )}
      </div>

      <AnimatePresence>
        {showList && (
          <motion.ul
            id={listId}
            role="listbox"
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.14 }}
            className="absolute inset-x-0 top-full z-40 mt-1.5 min-w-[260px] overflow-hidden rounded-xl border border-line-strong bg-panel-2/95 p-1 shadow-2xl shadow-black/60 backdrop-blur"
          >
            {results.length === 0 && <li className="px-3 py-3 text-[12.5px] text-subtle">No files match “{query}”</li>}
            {results.map((file, i) => (
              <li
                key={file.id}
                id={`${listId}-${file.id}`}
                role="option"
                aria-selected={i === active}
                onMouseDown={(e) => {
                  e.preventDefault();
                  choose(file.id);
                }}
                onMouseEnter={() => setActive(i)}
                className={cn(
                  "flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5",
                  i === active ? "bg-white/[0.07]" : "",
                )}
              >
                <CategoryIcon category={file.category} size="sm" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[12.5px] text-fg">{displayName(file.id)}</div>
                  <div className="truncate font-mono text-[10.5px] text-subtle">{file.path}</div>
                </div>
                {i === active && <CornerDownLeft className="size-3.5 text-subtle" aria-hidden />}
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}
