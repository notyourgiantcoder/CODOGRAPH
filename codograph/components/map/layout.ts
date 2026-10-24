import type { MapObject } from "@/lib/graph/view";

// Sizes are fixed px, not rem: the layout works in the same units React Flow
// draws in, and the zoom does the scaling. The node components read these
// constants so the box drawn is the box laid out.
export const CHAR_WIDTH = 6.9; // Geist Mono advance at 11.5px, the row labels
const LABEL_CHAR_WIDTH = 7.2; // Geist Sans at 12.5px, generous: the folder labels
const META_CHAR_WIDTH = 6.1; // Geist Mono at 10px: the counts line under a label
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
  // The counts line can be the wider of the two, so it's measured too: a
  // short folder name with a big count would otherwise wrap.
  const meta = `${o.fileCount.toLocaleString("en")} ${o.outside ? "linked " : ""}files  ←${o.fanIn}  ${o.fanOut}→`;
  const labelWidth = Math.max(o.label.length * LABEL_CHAR_WIDTH, meta.length * META_CHAR_WIDTH) + ICON_WIDTH + 2 * PAD_X;
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

/** Space between boxes in a grid, and between the layout's bands. */
const GAP_X = 32;
const GAP_Y = 24;
const BAND_GAP = 72;

// The folder in view, laid out the same way every time: the folders outside
// it that imports reach in a band across the top, its own files as a panel on
// the left, and its subfolders in a grid to the right, biggest first. A box's
// place says which of those it is, nothing more; the lines say what imports
// what. Shaped to be about as tall as it is wide, so it fills the canvas.
export function layout(objects: readonly MapObject[]): Map<string, Box> {
  const bySize = (a: MapObject, b: MapObject) => b.fileCount - a.fileCount || a.label.localeCompare(b.label);
  const panel = objects.find((o) => o.kind === "panel");
  const inside = objects.filter((o) => o.kind === "folded" && !o.outside).sort(bySize);
  const outside = objects.filter((o) => o.kind === "folded" && o.outside).sort(bySize);
  const size = new Map(objects.map((o) => [o.id, sizeOf(o)]));
  const boxes = new Map<string, Box>();

  // Every cell of a grid is as big as its biggest box, so the grid lines up.
  const cellOf = (list: readonly MapObject[]) => ({
    width: Math.max(0, ...list.map((o) => size.get(o.id)?.width ?? 0)) + GAP_X,
    height: Math.max(0, ...list.map((o) => size.get(o.id)?.height ?? 0)) + GAP_Y,
  });
  const place = (list: readonly MapObject[], columns: number, left: number, top: number) => {
    const cell = cellOf(list);
    list.forEach((o, i) => {
      const s = size.get(o.id);
      if (!s) return;
      boxes.set(o.id, { x: left + (i % columns) * cell.width, y: top + Math.floor(i / columns) * cell.height, ...s });
    });
    const rows = Math.ceil(list.length / columns);
    return { width: Math.min(columns, list.length) * cell.width - GAP_X, height: rows * cell.height - GAP_Y };
  };

  // As many columns as make the grid about square in pixels.
  const cell = cellOf(inside);
  const columns = inside.length === 0 ? 1 : Math.max(1, Math.ceil(Math.sqrt((inside.length * cell.height) / cell.width)));
  const panelSize = panel ? size.get(panel.id) : undefined;
  const gridLeft = panelSize ? panelSize.width + BAND_GAP : 0;
  const mainWidth = gridLeft + Math.min(columns, Math.max(1, inside.length)) * cell.width;

  // The outside band wraps at the width of what's below it, but never past two
  // rows: it's context, and a tall stack of it would push the folder down.
  const outsideCell = cellOf(outside);
  const outsideColumns = Math.max(1, Math.floor((mainWidth + GAP_X) / Math.max(1, outsideCell.width)), Math.ceil(outside.length / 2));
  const band = outside.length > 0 ? place(outside, outsideColumns, 0, 0) : { width: 0, height: -BAND_GAP };
  const top = band.height + BAND_GAP;

  if (panel && panelSize) boxes.set(panel.id, { x: 0, y: top, ...panelSize });
  place(inside, columns, gridLeft, top);
  return boxes;
}
