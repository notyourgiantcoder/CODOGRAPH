import { FILES } from "@/data/repository";
import { COMPLEXITY_BUCKETS, CATEGORIES, complexityBucket } from "@/lib/categories";
import type {
  Dependency,
  ImpactMode,
  ImpactResult,
  ModuleCategory,
  RepoFile,
} from "@/types/graph";

// ── Indexes ─────────────────────────────────────────────────────────────────

export const FILE_MAP = new Map<string, RepoFile>(FILES.map((f) => [f.id, f]));

export const DEPENDENCIES: Dependency[] = FILES.flatMap((file) =>
  file.imports.map((ref) => {
    const target = FILE_MAP.get(ref.target);
    if (!target) throw new Error(`Unknown dependency target "${ref.target}" in ${file.path}`);
    return {
      id: `${file.id}->${ref.target}`,
      source: file.id,
      target: ref.target,
      kind: ref.kind,
      symbols: ref.symbols ?? (ref.kind === "fetch" ? [] : [target.exports[0]]),
    };
  }),
);

export const DEPENDENCY_MAP = new Map(DEPENDENCIES.map((d) => [d.id, d]));

const outgoing = new Map<string, Dependency[]>(FILES.map((f) => [f.id, []]));
const incoming = new Map<string, Dependency[]>(FILES.map((f) => [f.id, []]));
for (const dep of DEPENDENCIES) {
  outgoing.get(dep.source)!.push(dep);
  incoming.get(dep.target)!.push(dep);
}

export function getFile(id: string): RepoFile {
  const file = FILE_MAP.get(id);
  if (!file) throw new Error(`Unknown file "${id}"`);
  return file;
}

/** Edges where `id` is the importer (what this file depends on). */
export const getOutgoing = (id: string) => outgoing.get(id) ?? [];
/** Edges where `id` is the imported module (who depends on this file). */
export const getIncoming = (id: string) => incoming.get(id) ?? [];

export function getNeighbors(id: string): Set<string> {
  const set = new Set<string>();
  for (const d of getOutgoing(id)) set.add(d.target);
  for (const d of getIncoming(id)) set.add(d.source);
  return set;
}

export function fileName(id: string) {
  const path = getFile(id).path;
  return path.slice(path.lastIndexOf("/") + 1);
}

const NAME_COUNTS = new Map<string, number>();
for (const f of FILES) {
  const name = f.path.slice(f.path.lastIndexOf("/") + 1);
  NAME_COUNTS.set(name, (NAME_COUNTS.get(name) ?? 0) + 1);
}

/**
 * A short, human label. Route files are named after their directory, and
 * files whose name is ambiguous (e.g. lib/cart.ts vs types/cart.ts) or that
 * live in types/ keep their parent directory.
 */
export function displayName(id: string) {
  const file = getFile(id);
  const name = fileName(id);
  const parts = file.path.split("/");
  if (/^(page|route|layout)\.tsx?$/.test(name)) return parts.slice(-2).join("/");
  if ((NAME_COUNTS.get(name) ?? 0) > 1 || file.category === "type") return parts.slice(-2).join("/");
  return name;
}

export function directoryOf(id: string) {
  const path = getFile(id).path;
  const i = path.lastIndexOf("/");
  return i === -1 ? "" : path.slice(0, i);
}

// ── Traversal ───────────────────────────────────────────────────────────────

/**
 * Breadth-first traversal over the synthetic graph.
 * - `downstream`: every module that transitively depends on `origin` (follows incoming edges)
 * - `upstream`: every module `origin` transitively depends on (follows outgoing edges)
 * - `direct`: one hop in either direction
 */
export function analyzeImpact(origin: string, mode: ImpactMode): ImpactResult {
  const depths = new Map<string, number>();
  const parents = new Map<string, string>();
  const edges = new Set<string>();
  const order: string[] = [];

  if (mode === "direct") {
    for (const d of [...getIncoming(origin), ...getOutgoing(origin)]) {
      const other = d.source === origin ? d.target : d.source;
      edges.add(d.id);
      if (!depths.has(other)) {
        depths.set(other, 1);
        parents.set(other, origin);
        order.push(other);
      }
    }
  } else {
    const visited = new Set([origin]);
    let frontier = [origin];
    let depth = 0;
    while (frontier.length) {
      depth += 1;
      const next: string[] = [];
      for (const id of frontier) {
        const links = mode === "downstream" ? getIncoming(id) : getOutgoing(id);
        for (const d of links) {
          const other = mode === "downstream" ? d.source : d.target;
          edges.add(d.id);
          if (visited.has(other)) continue;
          visited.add(other);
          depths.set(other, depth);
          parents.set(other, id);
          order.push(other);
          next.push(other);
        }
      }
      frontier = next;
    }
  }

  let maxDepth = 0;
  let deepest = origin;
  for (const id of order) {
    const d = depths.get(id)!;
    if (d > maxDepth) {
      maxDepth = d;
      deepest = id;
    }
  }

  const longestChain: string[] = [deepest];
  while (longestChain[0] !== origin) longestChain.unshift(parents.get(longestChain[0])!);

  return { origin, mode, depths, edges, order, maxDepth, longestChain };
}

/** Shortest dependency path following import direction (from importer to imported). */
export function findPath(from: string, to: string): Dependency[] | null {
  if (from === to) return [];
  const prev = new Map<string, Dependency>();
  const visited = new Set([from]);
  const queue = [from];
  while (queue.length) {
    const id = queue.shift()!;
    for (const d of getOutgoing(id)) {
      if (visited.has(d.target)) continue;
      visited.add(d.target);
      prev.set(d.target, d);
      if (d.target === to) {
        const path: Dependency[] = [];
        let cursor = to;
        while (cursor !== from) {
          const edge = prev.get(cursor)!;
          path.unshift(edge);
          cursor = edge.source;
        }
        return path;
      }
      queue.push(d.target);
    }
  }
  return null;
}

// ── Metrics ─────────────────────────────────────────────────────────────────

export interface FileMetrics {
  id: string;
  fanIn: number;
  fanOut: number;
  degree: number;
  /** Number of modules that transitively depend on this one. */
  reach: number;
}

export const FILE_METRICS = new Map<string, FileMetrics>(
  FILES.map((f) => {
    const fanIn = getIncoming(f.id).length;
    const fanOut = getOutgoing(f.id).length;
    return [
      f.id,
      { id: f.id, fanIn, fanOut, degree: fanIn + fanOut, reach: analyzeImpact(f.id, "downstream").order.length },
    ];
  }),
);

export const getMetrics = (id: string) => FILE_METRICS.get(id)!;

/** Longest import chain length (in edges) starting anywhere in the graph. */
function computeLongestChain(): number {
  const memo = new Map<string, number>();
  const visit = (id: string, stack: Set<string>): number => {
    if (memo.has(id)) return memo.get(id)!;
    if (stack.has(id)) return 0;
    stack.add(id);
    let best = 0;
    for (const d of getOutgoing(id)) best = Math.max(best, 1 + visit(d.target, stack));
    stack.delete(id);
    memo.set(id, best);
    return best;
  };
  return Math.max(...FILES.map((f) => visit(f.id, new Set())));
}

export interface RepoSummary {
  files: number;
  dependencies: number;
  byKind: Record<Dependency["kind"], number>;
  directories: number;
  longestChain: number;
  avgFanOut: number;
  totalLoc: number;
}

export function summarize(ids: string[]): RepoSummary {
  const set = new Set(ids);
  const deps = DEPENDENCIES.filter((d) => set.has(d.source) && set.has(d.target));
  const byKind = { import: 0, type: 0, fetch: 0 };
  for (const d of deps) byKind[d.kind] += 1;
  return {
    files: ids.length,
    dependencies: deps.length,
    byKind,
    directories: new Set(ids.map((id) => getFile(id).path.split("/")[0])).size,
    longestChain: LONGEST_CHAIN,
    avgFanOut: ids.length ? deps.length / ids.length : 0,
    totalLoc: ids.reduce((n, id) => n + getFile(id).loc, 0),
  };
}

export const LONGEST_CHAIN = computeLongestChain();

export function categoryCounts(ids: string[]) {
  return CATEGORIES.map((c) => ({
    ...c,
    count: ids.filter((id) => getFile(id).category === c.id).length,
  }));
}

export function complexityHistogram(ids: string[]) {
  return COMPLEXITY_BUCKETS.map((b) => {
    const files = ids.filter((id) => complexityBucket(getFile(id).complexity).id === b.id);
    return { ...b, count: files.length, files };
  });
}

export function mostConnected(ids: string[], limit = 8) {
  return ids
    .map((id) => getMetrics(id))
    .sort((a, b) => b.degree - a.degree || b.fanIn - a.fanIn || a.id.localeCompare(b.id))
    .slice(0, limit);
}

export function filesInCategories(categories: ModuleCategory[]) {
  return FILES.filter((f) => categories.includes(f.category)).map((f) => f.id);
}

// ── Code generation ─────────────────────────────────────────────────────────

export interface GeneratedSource {
  code: string;
  /** Dependency id -> 1-based line number of the statement that creates it. */
  lines: Map<string, number>;
}

const modulePath = (file: RepoFile) => "@/" + file.path.replace(/\.(tsx?|jsx?)$/, "");

/** Builds the illustrative source shown in the Code tab: generated imports + body. */
export function generateSource(id: string): GeneratedSource {
  const file = getFile(id);
  const lines = new Map<string, number>();
  const header: string[] = [];
  const deps = getOutgoing(id);

  const isClient = file.category === "component" || file.category === "hook";
  if (isClient) header.push(`"use client";`, "");

  for (const d of deps) {
    if (d.kind === "fetch") continue;
    const target = getFile(d.target);
    const keyword = d.kind === "type" ? "import type" : "import";
    header.push(`${keyword} { ${d.symbols.join(", ")} } from "${modulePath(target)}";`);
    lines.set(d.id, header.length);
  }

  const offset = header.length + (header.length ? 1 : 0);
  const bodyLines = file.body.split("\n");
  for (const d of deps) {
    if (d.kind !== "fetch") continue;
    const route = "/" + getFile(d.target).path.replace(/\/route\.ts$/, "");
    const index = bodyLines.findIndex((l) => l.includes(route));
    lines.set(d.id, offset + (index === -1 ? 1 : index + 1));
  }

  const code = (header.length ? header.join("\n") + "\n\n" : "") + file.body;
  return { code, lines };
}

/** The statement that proves a dependency exists, for grounded explanations. */
export function evidenceFor(dep: Dependency) {
  const { code, lines } = generateSource(dep.source);
  const line = lines.get(dep.id) ?? 1;
  return { line, text: code.split("\n")[line - 1]?.trim() ?? "" };
}

// ── Search ──────────────────────────────────────────────────────────────────

export function searchFiles(query: string, limit = 8): RepoFile[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const scored: { file: RepoFile; score: number }[] = [];
  for (const file of FILES) {
    const path = file.path.toLowerCase();
    const name = fileName(file.id).toLowerCase();
    let score = 0;
    if (name === q || path === q) score = 100;
    else if (name.startsWith(q)) score = 80;
    else if (name.includes(q)) score = 60;
    else if (path.includes(q)) score = 45;
    else if (file.aliases.some((a) => a.includes(q))) score = 35;
    else if (isSubsequence(q.replace(/\s+/g, ""), path)) score = 15;
    if (score) scored.push({ file, score: score - path.length / 100 });
  }
  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((s) => s.file);
}

function isSubsequence(needle: string, haystack: string) {
  let i = 0;
  for (const ch of haystack) if (ch === needle[i]) i += 1;
  return i === needle.length;
}

// ── File tree ───────────────────────────────────────────────────────────────

export interface TreeNode {
  name: string;
  path: string;
  children: TreeNode[];
  fileId?: string;
}

export function buildTree(ids: string[]): TreeNode {
  const root: TreeNode = { name: "", path: "", children: [] };
  for (const id of ids) {
    const parts = getFile(id).path.split("/");
    let node = root;
    parts.forEach((part, i) => {
      const path = parts.slice(0, i + 1).join("/");
      let child = node.children.find((c) => c.name === part);
      if (!child) {
        child = { name: part, path, children: [] };
        if (i === parts.length - 1) child.fileId = id;
        node.children.push(child);
      }
      node = child;
    });
  }
  const sort = (n: TreeNode) => {
    n.children.sort((a, b) => Number(!!a.fileId) - Number(!!b.fileId) || a.name.localeCompare(b.name));
    n.children.forEach(sort);
  };
  sort(root);
  return root;
}

/** All ancestor directory paths for a file, e.g. app, app/products for app/products/page.tsx. */
export function ancestorDirs(id: string): string[] {
  const parts = getFile(id).path.split("/");
  return parts.slice(0, -1).map((_, i) => parts.slice(0, i + 1).join("/"));
}
