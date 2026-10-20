"use client";

import { AnimatePresence, motion } from "motion/react";
import { ChevronRight, Folder, FolderOpen } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useDemo, useRevealedImpact } from "@/components/demo/DemoProvider";
import { CategoryIcon } from "@/components/graph/CategoryIcon";
import { FILES } from "@/data/repository";
import { cn } from "@/lib/cn";
import { ancestorDirs, buildTree, getFile, type TreeNode } from "@/lib/graph";

const TREE = buildTree(FILES.map((f) => f.id));

function countFiles(node: TreeNode): number {
  return node.fileId ? 1 : node.children.reduce((n, c) => n + countFiles(c), 0);
}

export function FileExplorer({ className, dense = false }: { className?: string; dense?: boolean }) {
  const { selectedId } = useDemo();
  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set([...TREE.children.map((c) => c.path), ...(selectedId ? ancestorDirs(selectedId) : [])]),
  );
  const scroller = useRef<HTMLDivElement>(null);

  // Reveal the selected file: expand its folders (adjusting state during render
  // when the selection changes), then scroll it into view inside the panel only.
  const [revealed, setRevealed] = useState(selectedId);
  if (selectedId !== revealed) {
    setRevealed(selectedId);
    if (selectedId) {
      const missing = ancestorDirs(selectedId).filter((d) => !expanded.has(d));
      if (missing.length) setExpanded(new Set([...expanded, ...missing]));
    }
  }

  useEffect(() => {
    if (!selectedId) return;
    const t = window.setTimeout(() => {
      const box = scroller.current;
      const row = box?.querySelector<HTMLElement>(`[data-file="${selectedId}"]`);
      if (!box || !row) return;
      const top = row.getBoundingClientRect().top - box.getBoundingClientRect().top + box.scrollTop;
      if (top < box.scrollTop || top + row.offsetHeight > box.scrollTop + box.clientHeight) {
        box.scrollTo({ top: top - box.clientHeight / 2, behavior: "smooth" });
      }
    }, 260);
    return () => window.clearTimeout(t);
  }, [selectedId]);

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
        {TREE.children.map((node) => (
          <TreeItem key={node.path} node={node} depth={0} expanded={expanded} onToggle={toggle} dense={dense} />
        ))}
      </ul>
    </div>
  );
}

function TreeItem({
  node,
  depth,
  expanded,
  onToggle,
  dense,
}: {
  node: TreeNode;
  depth: number;
  expanded: Set<string>;
  onToggle: (path: string) => void;
  dense: boolean;
}) {
  const { selectedId, select, categories } = useDemo();
  const impact = useRevealedImpact();
  const pad = { paddingLeft: 10 + depth * 13 };
  const total = useMemo(() => countFiles(node), [node]);

  if (node.fileId) {
    const file = getFile(node.fileId);
    const selected = selectedId === file.id;
    const hidden = !categories.includes(file.category);
    const isOrigin = impact?.origin === file.id;
    const depthHit = impact?.revealedDepths.get(file.id);
    return (
      <li role="treeitem" aria-selected={selected}>
        <button
          type="button"
          data-file={file.id}
          onClick={() => select(file.id, { focus: true })}
          style={pad}
          className={cn(
            "group relative flex w-full items-center gap-2 pr-2 text-left transition-colors",
            dense ? "h-[26px] text-[12px]" : "h-7 text-[12.5px]",
            selected ? "bg-violet/[0.14] text-fg" : "text-muted hover:bg-white/[0.04] hover:text-fg",
            hidden && "opacity-40",
          )}
        >
          {selected && <span className="absolute inset-y-1 left-0 w-0.5 rounded-full bg-violet" />}
          <CategoryIcon category={file.category} size="xs" />
          <span className="truncate font-mono">{node.name}</span>
          {isOrigin && <span className="ml-auto size-1.5 shrink-0 rounded-full bg-cyan shadow-[0_0_8px_#67d5ff]" />}
          {depthHit !== undefined && (
            <span className="ml-auto shrink-0 rounded bg-cyan/15 px-1 font-mono text-[9.5px] text-cyan">{depthHit}</span>
          )}
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
        className={cn(
          "flex w-full items-center gap-1.5 pr-2 text-left text-muted transition-colors hover:bg-white/[0.04] hover:text-fg",
          dense ? "h-[26px] text-[12px]" : "h-7 text-[12.5px]",
        )}
      >
        <ChevronRight className={cn("size-3 shrink-0 transition-transform duration-200", open && "rotate-90")} aria-hidden />
        {open ? (
          <FolderOpen className="size-3.5 shrink-0 text-subtle" aria-hidden />
        ) : (
          <Folder className="size-3.5 shrink-0 text-subtle" aria-hidden />
        )}
        <span className="truncate">{node.name}</span>
        <span className="ml-auto font-mono text-[10px] text-subtle/70">{total}</span>
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
              <TreeItem key={child.path} node={child} depth={depth + 1} expanded={expanded} onToggle={onToggle} dense={dense} />
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </li>
  );
}
