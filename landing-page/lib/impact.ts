import { CATEGORIES } from "@/lib/categories";
import { displayName, getFile } from "@/lib/graph";
import type { ImpactMode, ImpactResult } from "@/types/graph";

export const IMPACT_MODES: { id: ImpactMode; label: string; description: string }[] = [
  { id: "direct", label: "Direct", description: "Modules one hop away — files it imports and files that import it." },
  { id: "downstream", label: "Downstream", description: "Everything that transitively depends on this file: its blast radius." },
  { id: "upstream", label: "Upstream", description: "Everything this file transitively relies on." },
];

/** A concise, data-derived explanation of an impact result. */
export function explainImpact(result: ImpactResult): string {
  const name = displayName(result.origin);
  const n = result.order.length;
  const files = `${n} ${n === 1 ? "file" : "files"}`;
  if (n === 0) {
    if (result.mode === "downstream") return `Nothing imports ${name}, so changes stay local to it.`;
    if (result.mode === "upstream") return `${name} has no internal dependencies.`;
    return `${name} has no direct connections.`;
  }
  const chain = result.longestChain.map(displayName).join(" → ");
  const routes = result.order.filter((id) => getFile(id).category === "route").length;
  switch (result.mode) {
    case "direct":
      return `${name} is directly connected to ${files}. Edits to its exports touch these first.`;
    case "downstream":
      return `${files} depend on ${name} across ${result.maxDepth} ${result.maxDepth === 1 ? "hop" : "hops"}${
        routes ? `, reaching ${routes} ${routes === 1 ? "route" : "routes"}` : ""
      }. Longest chain: ${[...result.longestChain].reverse().map(displayName).join(" → ")}.`;
    case "upstream":
      return `${name} relies on ${files} across ${result.maxDepth} ${result.maxDepth === 1 ? "hop" : "hops"}. Deepest path: ${chain}.`;
  }
}

export function impactByCategory(ids: string[]) {
  return CATEGORIES.map((c) => ({ ...c, count: ids.filter((id) => getFile(id).category === c.id).length })).filter(
    (c) => c.count > 0,
  );
}

export function groupByDepth(result: ImpactResult, ids: string[]) {
  const groups = new Map<number, string[]>();
  for (const id of ids) {
    const d = result.depths.get(id)!;
    groups.set(d, [...(groups.get(d) ?? []), id]);
  }
  return [...groups.entries()].sort((a, b) => a[0] - b[0]);
}
