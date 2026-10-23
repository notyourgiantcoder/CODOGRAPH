import dagre from "@dagrejs/dagre";
import type { MapEdge, MapObject } from "@/lib/graph/view";

// Sizes are fixed px, not rem: dagre lays out in the same units React Flow
// draws in, and the zoom does the scaling. The node components read these
// constants so the box drawn is the box laid out.
export const CHAR_WIDTH = 6.9; // Geist Mono advance at 11.5px, the row labels
const LABEL_CHAR_WIDTH = 7.2; // Geist Sans at 12.5px, generous: the folder labels
export const PAD_X = 10;
const ICON_WIDTH = 38; // the role tile and the gap after it
// The landing page draws every node 178 by 48; a folder that many files import
// grows a little taller, so the box still says it's a hub.
export const FOLDED_MIN_HEIGHT = 52;
export const FOLDED_MIN_WIDTH = 178;
export const PANEL_HEADER_HEIGHT = 52;
export const ROW_HEIGHT = 26;
const ROW_NUMBERS_WIDTH = 104; // icon, gaps and the fan counts
const PANEL_MIN_WIDTH = 230;
const PANEL_MAX_WIDTH = 470;
const FAN_IN_SCALE = 3;
const FOLDED_MAX_HEIGHT = 96;

export type Box = { x: number; y: number; width: number; height: number };

// Height carries fan-in; sqrt so one hub doesn't flatten everything else into
// the minimum. Width comes from the label alone, so a long name doesn't read
// as an important file.
export function sizeOf(o: MapObject): { width: number; height: number } {
  const labelWidth = o.label.length * LABEL_CHAR_WIDTH + ICON_WIDTH + 2 * PAD_X;
  if (o.kind === "folded") {
    return {
      width: Math.ceil(Math.max(FOLDED_MIN_WIDTH, labelWidth)),
      height: Math.round(Math.min(FOLDED_MAX_HEIGHT, FOLDED_MIN_HEIGHT + FAN_IN_SCALE * Math.sqrt(o.fanIn))),
    };
  }
  const widest = Math.max(labelWidth, o.rowChars * CHAR_WIDTH + 2 * PAD_X + ROW_NUMBERS_WIDTH);
  // A scrolling panel always keeps its above and below rows, so its height is
  // the same at every offset and scrolling never moves the layout.
  const rowCount = o.rows.length + (o.scrolls ? 2 : 0);
  return {
    width: Math.ceil(Math.min(PANEL_MAX_WIDTH, Math.max(PANEL_MIN_WIDTH, widest))),
    height: PANEL_HEADER_HEIGHT + rowCount * ROW_HEIGHT,
  };
}

// Deterministic: objects and edges arrive sorted, and dagre has no randomness,
// so the same data and the same open set give the same picture.
export function layout(objects: readonly MapObject[], edges: readonly MapEdge[]): Map<string, Box> {
  const g = new dagre.graphlib.Graph<{ rankdir: "LR"; nodesep: number; ranksep: number }, { width: number; height: number; x?: number; y?: number }, object>();
  g.setGraph({ rankdir: "LR", nodesep: 22, ranksep: 96 });
  g.setDefaultEdgeLabel(() => ({}));
  for (const o of objects) g.setNode(o.id, sizeOf(o));
  // Several row-level lines between the same two objects are one constraint
  // for layout purposes.
  const seen = new Set<string>();
  for (const e of edges) {
    const key = `${e.source}>${e.target}`;
    if (seen.has(key)) continue;
    seen.add(key);
    g.setEdge(e.source, e.target);
  }
  dagre.layout(g);

  const boxes = new Map<string, Box>();
  for (const o of objects) {
    const n = g.node(o.id);
    if (n.x === undefined || n.y === undefined) throw new Error(`Layout gave ${o.id} no position`);
    // dagre positions centres; React Flow positions top-left corners.
    boxes.set(o.id, { x: n.x - n.width / 2, y: n.y - n.height / 2, width: n.width, height: n.height });
  }
  return boxes;
}
