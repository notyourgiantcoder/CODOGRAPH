"use client";

import { AnimatePresence, motion } from "motion/react";
import { ChevronRight, Folder, FolderOpen } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { RoleIcon } from "@/components/ui/role-icon";
import { cn } from "@/lib/cn";
import { ancestorDirs, buildTree, type TreeNode } from "@/lib/graph/workspace";
import { UNCLASSIFIED } from "@/lib/roles";
import { useWorkspace } from "./context";

// The repository's real folder tree, as the landing page's explorer draws it.
// Clicking a file reveals it on the map; a file whose category is filtered off
// stays listed, dimmed, so the tree is always the whole repository.
export function Explorer({ className }: { className?: string }) {
  const { files, selection } = useWorkspace();
  const tree = useMemo(() => buildTree(files.map((f) => f.path)), [files]);
  const selectedPath = selection?.kind === "file" ? selection.path : null;
  // Top-level folders start open when there are few of them, as on the landing page.
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(
    () => new Set(tree.children.length <= 6 ? tree.children.filter((c) => !c.file).map((c) => c.path) : []),
  );
  const scroller = useRef<HTMLDivElement>(null);

  // Reveal the selected file: expand its folders (adjusting state during render
  // when the selection changes), then scroll it into view inside the panel only.
  const [revealed, setRevealed] = useState(selectedPath);
  if (selectedPath !== revealed) {
    setRevealed(selectedPath);
    if (selectedPath) {
      const missing = ancestorDirs(selectedPath).filter((d) => !expanded.has(d));
      if (missing.length) setExpanded(new Set([...expanded, ...missing]));
    }
  }

  useEffect(() => {
    if (!selectedPath) return;
    const t = window.setTimeout(() => {
      const box = scroller.current;
      const row = box?.querySelector<HTMLElement>(`[data-file="${CSS.escape(selectedPath)}"]`);
      if (!box || !row) return;
      const top = row.getBoundingClientRect().top - box.getBoundingClientRect().top + box.scrollTop;
      if (top < box.scrollTop || top + row.offsetHeight > box.scrollTop + box.clientHeight) {
        box.scrollTo({ top: top - box.clientHeight / 2, behavior: "smooth" });
      }
    }, 260);
    return () => window.clearTimeout(t);
  }, [selectedPath]);

  const toggle = (path: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });

  return (
    <div ref={scroller} className={cn("scrollbar-thin relative overflow-y-auto", className)} role="tree" aria-label="Repository files">
      <ul className="py-1">
        {tree.children.map((node) => (
          <TreeItem key={node.path} node={node} depth={0} expanded={expanded} onToggle={toggle} />
        ))}
      </ul>
    </div>
  );
}

function TreeItem({ node, depth, expanded, onToggle }: { node: TreeNode; depth: number; expanded: ReadonlySet<string>; onToggle: (path: string) => void }) {
  const { selection, reveal, roles, hidden, setHover } = useWorkspace();
  const pad = { paddingLeft: 10 + depth * 13 };

  if (node.file) {
    const selected = selection?.kind === "file" && selection.path === node.path;
    return (
      <li role="treeitem" aria-selected={selected}>
        <button
          type="button"
          data-file={node.path}
          onClick={() => reveal(node.path)}
          onMouseEnter={() => setHover({ kind: "file", path: node.path })}
          onMouseLeave={() => setHover(null)}
          title={node.path}
          style={pad}
          className={cn(
            "group relative flex h-7 w-full items-center gap-2 pr-2 text-left text-[12.5px] transition-colors",
            selected ? "bg-violet/[0.14] text-fg" : "text-muted hover:bg-ink/[0.04] hover:text-fg",
            hidden.has(node.path) && "opacity-40",
          )}
        >
          {selected && <span className="absolute inset-y-1 left-0 w-0.5 rounded-full bg-violet" />}
          <RoleIcon role={roles.get(node.path) ?? UNCLASSIFIED} size="xs" />
          <span className="truncate font-mono">{node.name}</span>
        </button>
      </li>
    );
  }

  const open = expanded.has(node.path);
  return (
    <li role="treeitem" aria-expanded={open} aria-selected={false}>
      <button
        type="button"
        onClick={() => onToggle(node.path)}
        style={pad}
        className="flex h-7 w-full items-center gap-1.5 pr-2 text-left text-[12.5px] text-muted transition-colors hover:bg-ink/[0.04] hover:text-fg"
      >
        <ChevronRight className={cn("size-3 shrink-0 transition-transform duration-200", open && "rotate-90")} aria-hidden />
        {open ? <FolderOpen className="size-3.5 shrink-0 text-subtle" aria-hidden /> : <Folder className="size-3.5 shrink-0 text-subtle" aria-hidden />}
        <span className="truncate">{node.name}</span>
        <span className="ml-auto font-mono text-[10px] text-subtle/70">{node.count}</span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.ul
            role="group"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
            className="overflow-hidden"
          >
            {node.children.map((child) => (
              <TreeItem key={child.path} node={child} depth={depth + 1} expanded={expanded} onToggle={onToggle} />
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </li>
  );
}
