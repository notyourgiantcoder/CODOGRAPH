import type { Edge, EdgeKind } from "../parser/types.ts";

// Pure helpers the workspace UI shares: short names, search, the folder tree,
// and how each kind of edge is worded. Paths in, plain data out.

export function fileName(path: string): string {
  return path.slice(path.lastIndexOf("/") + 1);
}

export function directoryOf(path: string): string {
  const i = path.lastIndexOf("/");
  return i === -1 ? "" : path.slice(0, i);
}

/**
 * A short label, as on the landing page: a framework file named by convention
 * (page.tsx, route.ts, index.ts…) and any name more than one file shares keep
 * their folder, so the label still says which one it is.
 */
export function displayNames(paths: readonly string[]): Map<string, string> {
  const counts = new Map<string, number>();
  for (const p of paths) counts.set(fileName(p), (counts.get(fileName(p)) ?? 0) + 1);
  return new Map(
    paths.map((p) => {
      const name = fileName(p);
      const conventional = /^(page|route|layout|index|loading|error|not-found|template|default|main|mod)\.[cm]?[jt]sx?$/.test(name);
      const keepFolder = conventional || (counts.get(name) ?? 0) > 1;
      return [p, keepFolder && p.includes("/") ? p.split("/").slice(-2).join("/") : name];
    }),
  );
}

/** Best matches first: the name exactly, then its start, anywhere in it, anywhere in the path, then the letters in order. */
export function searchPaths(paths: readonly string[], query: string, limit = 8): string[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const scored: { path: string; score: number }[] = [];
  for (const path of paths) {
    const lower = path.toLowerCase();
    const name = fileName(lower);
    let score = 0;
    if (name === q || lower === q) score = 100;
    else if (name.startsWith(q)) score = 80;
    else if (name.includes(q)) score = 60;
    else if (lower.includes(q)) score = 45;
    else if (isSubsequence(q.replace(/\s+/g, ""), lower)) score = 15;
    if (score) scored.push({ path, score: score - lower.length / 1000 });
  }
  return scored
    .sort((a, b) => b.score - a.score || a.path.localeCompare(b.path))
    .slice(0, limit)
    .map((s) => s.path);
}

function isSubsequence(needle: string, haystack: string): boolean {
  let i = 0;
  for (const ch of haystack) if (ch === needle[i]) i += 1;
  return i === needle.length;
}

export type TreeNode = {
  name: string;
  /** Repository-relative; "" for the root. */
  path: string;
  children: TreeNode[];
  /** Set on a file, never on a folder. */
  file: boolean;
  /** Files at or under this node. */
  count: number;
};

/** Folders first, then files, each alphabetical, as the landing page's explorer shows them. */
export function buildTree(paths: readonly string[]): TreeNode {
  const root: TreeNode = { name: "", path: "", children: [], file: false, count: 0 };
  const index = new Map<string, TreeNode>([["", root]]);
  for (const path of paths) {
    const parts = path.split("/");
    let node = root;
    node.count++;
    parts.forEach((part, i) => {
      const at = parts.slice(0, i + 1).join("/");
      let child = index.get(at);
      if (!child) {
        child = { name: part, path: at, children: [], file: i === parts.length - 1, count: 0 };
        index.set(at, child);
        node.children.push(child);
      }
      child.count++;
      node = child;
    });
  }
  const sort = (n: TreeNode) => {
    n.children.sort((a, b) => Number(a.file) - Number(b.file) || a.name.localeCompare(b.name));
    n.children.forEach(sort);
  };
  sort(root);
  return root;
}

/** Every folder above a file: app, app/products for app/products/page.tsx. */
export function ancestorDirs(path: string): string[] {
  const parts = path.split("/");
  return parts.slice(0, -1).map((_, i) => parts.slice(0, i + 1).join("/"));
}

export type EdgeLabel = { label: string; verb: string };

/** How an edge reads in a list: a type-only import is named as one whatever its syntax. */
export function edgeLabel(edge: Pick<Edge, "kind" | "typeOnly">): EdgeLabel {
  if (edge.typeOnly) return { label: "Type import", verb: "uses types from" };
  return EDGE_KIND_LABELS[edge.kind];
}

export const EDGE_KIND_LABELS: Record<EdgeKind, EdgeLabel> = {
  import: { label: "Import", verb: "imports" },
  "re-export": { label: "Re-export", verb: "re-exports" },
  "dynamic-import": { label: "Dynamic import", verb: "lazily imports" },
  require: { label: "require()", verb: "requires" },
  fetch: { label: "Network call", verb: "calls" },
};
