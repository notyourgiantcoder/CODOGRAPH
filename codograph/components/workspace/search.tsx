"use client";

import { AnimatePresence, motion } from "motion/react";
import { CornerDownLeft, Search, X } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Kbd } from "@/components/ui/primitives";
import { RoleIcon } from "@/components/ui/role-icon";
import { cn } from "@/lib/cn";
import { searchPaths } from "@/lib/graph/workspace";
import { UNCLASSIFIED } from "@/lib/roles";
import { useWorkspace } from "./context";

// Jump to a file, as the landing page's search does: "/" or ⌘K focuses it,
// arrows move through the matches, Enter reveals one on the map.
export function FileSearch({ className }: { className?: string }) {
  const { files, reveal, roles, names } = useWorkspace();
  const paths = useMemo(() => files.map((f) => f.path), [files]);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const listId = useId();
  const results = useMemo(() => searchPaths(paths, query, 8), [paths, query]);

  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      const typing = e.target instanceof HTMLElement && e.target.closest("input, textarea, [contenteditable]");
      if ((e.key === "/" && !typing) || (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey))) {
        e.preventDefault();
        input.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const choose = (path: string) => {
    reveal(path);
    setQuery("");
    setOpen(false);
    input.current?.blur();
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter" && results[active]) {
      e.preventDefault();
      choose(results[active]);
    } else if (e.key === "Escape") {
      setQuery("");
      setOpen(false);
      input.current?.blur();
    }
  };

  const showList = open && query.trim().length > 0;

  return (
    <div className={cn("relative", className)}>
      <div className="flex h-9 items-center gap-2 rounded-lg border border-line-strong bg-ink/[0.03] px-2.5 transition focus-within:border-violet/60 focus-within:bg-ink/[0.05] focus-within:shadow-[0_0_0_3px_rgba(139,92,246,0.15)]">
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
          placeholder={`Search ${files.length} files…`}
          aria-label="Search files"
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-activedescendant={showList && results[active] ? `${listId}-${active}` : undefined}
          className="min-w-0 flex-1 bg-transparent text-[13px] text-fg outline-none placeholder:text-subtle"
          autoComplete="off"
          spellCheck={false}
        />
        {query ? (
          <button type="button" onClick={() => setQuery("")} aria-label="Clear search" className="text-subtle hover:text-fg">
            <X className="size-3.5" />
          </button>
        ) : (
          <Kbd className="hidden sm:inline-flex">/</Kbd>
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
            className="absolute inset-x-0 top-full z-40 mt-1.5 min-w-[300px] overflow-hidden rounded-xl border border-line-strong bg-panel-2/95 p-1 shadow-2xl shadow-black/40 backdrop-blur"
          >
            {results.length === 0 && <li className="px-3 py-3 text-[12.5px] text-subtle">No files match “{query}”</li>}
            {results.map((path, i) => (
              <li
                key={path}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === active}
                onMouseDown={(e) => {
                  e.preventDefault();
                  choose(path);
                }}
                onMouseEnter={() => setActive(i)}
                className={cn("flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5", i === active && "bg-ink/[0.07]")}
              >
                <RoleIcon role={roles.get(path) ?? UNCLASSIFIED} size="sm" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[12.5px] text-fg">{names.get(path) ?? path}</div>
                  <div className="truncate font-mono text-[10.5px] text-subtle">{path}</div>
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
