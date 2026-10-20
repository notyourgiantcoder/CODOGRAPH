import { FILES } from "@/data/repository";
import { DEPENDENCIES, getFile } from "@/lib/graph";
import type { Dependency } from "@/types/graph";

export const NODE_W = 178;
export const NODE_H = 48;
export const COL_W = 212;
export const ROW_H = 122;

export function nodePosition(id: string) {
  const file = getFile(id);
  return { x: file.col * COL_W - NODE_W / 2, y: file.layer * ROW_H };
}

export function nodeCenter(id: string) {
  const p = nodePosition(id);
  return { x: p.x + NODE_W / 2, y: p.y + NODE_H / 2 };
}

export interface EdgeRouting {
  sourceHandle: string;
  targetHandle: string;
  /** Same-layer edges that would cross another node arc underneath instead. */
  arc: boolean;
}

/**
 * Picks handles so the hand-tuned layered layout reads cleanly:
 * downward edges run bottom → top, upward ones top → bottom, adjacent
 * same-layer edges run side to side and non-adjacent ones arc below the row.
 */
export function routeEdge(dep: Dependency): EdgeRouting {
  const s = getFile(dep.source);
  const t = getFile(dep.target);
  if (t.layer > s.layer) return { sourceHandle: "s-bottom", targetHandle: "t-top", arc: false };
  if (t.layer < s.layer) return { sourceHandle: "s-top", targetHandle: "t-bottom", arc: false };

  const [lo, hi] = s.col < t.col ? [s.col, t.col] : [t.col, s.col];
  const blocked = FILES.some((f) => f.layer === s.layer && f.col > lo && f.col < hi);
  if (blocked) return { sourceHandle: "s-bottom", targetHandle: "t-bottom", arc: true };
  return t.col > s.col
    ? { sourceHandle: "s-right", targetHandle: "t-left", arc: false }
    : { sourceHandle: "s-left", targetHandle: "t-right", arc: false };
}

export const EDGE_ROUTES = new Map(DEPENDENCIES.map((d) => [d.id, routeEdge(d)]));

/** Stable stagger order for entrance animations: top-to-bottom, left-to-right. */
export const ENTRANCE_ORDER = new Map(
  [...FILES]
    .sort((a, b) => a.layer - b.layer || a.col - b.col)
    .map((f, i) => [f.id, i] as const),
);
