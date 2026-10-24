"use client";

import {
  Background,
  BackgroundVariant,
  MarkerType,
  MiniMap,
  Panel,
  ReactFlow,
  ReactFlowProvider,
  getViewportForBounds,
  useReactFlow,
  useStore,
  type EdgeTypes,
  type NodeTypes,
} from "@xyflow/react";
import "@xyflow/react/dist/base.css";
import { Maximize2, Minus, Plus } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { IconButton } from "@/components/ui/primitives";
import type { Folding } from "@/lib/graph/fold";
import { highlight as highlightFor, hoverEndpoint, type Selection } from "@/lib/graph/highlight";
import { buildView } from "@/lib/graph/view";
import type { Edge, MapFile } from "@/lib/parser/types";
import type { RailKey } from "@/lib/roles";
import { usePrefersReducedMotion } from "@/lib/use-media-query";
import { DependencyEdge, edgeColor, type EdgeState, type MapFlowEdge } from "./edge";
import { layout, PANEL_HEADER_HEIGHT, ROW_HEIGHT, type Box } from "./layout";
import { MapLegend } from "./legend";
import { FoldedNodeView, MapActions, MapSelection, PanelNodeView, type FoldedNode, type PanelNode } from "./nodes";

const nodeTypes: NodeTypes = { folded: FoldedNodeView, panel: PanelNodeView };
const edgeTypes: EdgeTypes = { dependency: DependencyEdge };
const FIT_PADDING = 0.08;
const MIN_ZOOM = 0.1;
const MAX_ZOOM = 2;
/** Initial fit may enlarge a small graph a little, never to poster size. */
const INITIAL_MAX_ZOOM = 1.15;
/**
 * Nor shrink a big one past where labels stay readable: as on the landing
 * page, the first view is close enough to read, and the minimap and a drag
 * reach the rest.
 */
const INITIAL_MIN_ZOOM = 0.55;
const ENTRANCE_MS = 900;
/** Lines drawn when there are more than this many, unless every line is asked for. */
const STRONGEST = 40;

/** A request to move the camera; a new nonce asks again. */
export type Camera =
  | { kind: "fit"; nonce: number }
  | { kind: "focus"; path: string; nonce: number }
  /** A folder just opened: bring its panel to the middle. */
  | { kind: "group"; id: string; nonce: number }
  | null;

/** What the map draws and what it reports back. State lives with the caller, so the inspector can drive the same selection. */
export type MapControl = {
  files: MapFile[];
  /** Already filtered by the type-only toggle. */
  edges: Edge[];
  folding: Folding;
  /** Open groups and how far each has been scrolled. */
  open: ReadonlyMap<string, number>;
  selection: Selection;
  /** Whatever the pointer is over, here or in the inspector. */
  hover: Selection;
  /** Files whose category is filtered off. */
  hidden: ReadonlySet<string>;
  /** Every file's rail category. */
  roles: ReadonlyMap<string, RailKey>;
  /** For the legend: every category with its count. */
  categories: { key: RailKey; count: number }[];
  camera: Camera;
  /** Draw every line, not just the strongest. */
  allLines: boolean;
  onToggleAllLines: () => void;
  /** A folder box was clicked: go into it. */
  onOpen: (id: string) => void;
  /** The open panel's header was clicked. */
  onClose: (id: string) => void;
  onSelectFile: (path: string) => void;
  onScroll: (id: string, offset: number) => void;
  onHover: (hover: Selection) => void;
  onDeselect: () => void;
};

export function DependencyMap(props: MapControl) {
  return (
    <ReactFlowProvider>
      <MapCanvas {...props} />
    </ReactFlowProvider>
  );
}

function MapCanvas({
  files,
  edges,
  folding,
  open,
  selection,
  hover,
  hidden,
  roles,
  categories,
  camera,
  allLines,
  onToggleAllLines,
  onOpen,
  onClose,
  onSelectFile,
  onScroll,
  onHover,
  onDeselect,
}: MapControl) {
  const reduceMotion = usePrefersReducedMotion();
  const view = useMemo(() => buildView(files, edges, folding, open, hidden), [files, edges, folding, open, hidden]);
  const boxes = useMemo(() => layout(view.objects), [view]);
  // As on the landing page, the pointer previews a neighbourhood and the
  // selection holds one when the pointer is elsewhere.
  // A folder that isn't a box here has nothing to light up, so it leaves the
  // map as it is rather than dimming all of it.
  const lit = useMemo(() => {
    const target = hover ?? selection;
    // The open panel is the folder in view itself: it's the context, and
    // lighting every line it has would light most of the map.
    if (target?.kind === "group" && !view.objects.some((o) => o.id === target.id && o.kind === "folded")) return null;
    return highlightFor(view, edges, target);
  }, [view, edges, hover, selection]);
  const hovered = useMemo(() => hoverEndpoint(view, hover), [view, hover]);

  const [settled, setSettled] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => setSettled(true), reduceMotion ? 0 : ENTRANCE_MS);
    return () => window.clearTimeout(t);
  }, [reduceMotion]);

  const nodes = useMemo(
    () =>
      view.objects.map((o): FoldedNode | PanelNode => {
        const box = boxes.get(o.id);
        if (!box) throw new Error(`No layout box for ${o.id}`);
        const base = { id: o.id, position: { x: box.x, y: box.y }, width: box.width, height: box.height };
        return o.kind === "folded" ? { ...base, type: "folded", data: o } : { ...base, type: "panel", data: o };
      }),
    [view, boxes],
  );

  // Many lines at once read as noise. The strongest, by how many imports
  // each stands for, stay, and so does every line touching what's lit; the
  // layout is still worked out from all of them, so nothing moves on toggle.
  const drawn = useMemo(() => {
    if (allLines || view.edges.length <= STRONGEST) return view.edges;
    const strongest = new Set(
      [...view.edges]
        .sort((a, b) => b.count - a.count || a.id.localeCompare(b.id))
        .slice(0, STRONGEST)
        .map((e) => e.id),
    );
    return view.edges.filter((e) => strongest.has(e.id) || lit?.incoming.has(e.id) || lit?.outgoing.has(e.id));
  }, [view, allLines, lit]);

  const flowEdges = useMemo(() => {
    const dim: MapFlowEdge[] = [];
    const bright: MapFlowEdge[] = [];
    for (const e of drawn) {
      const state: EdgeState = !lit ? "idle" : lit.incoming.has(e.id) ? "incoming" : lit.outgoing.has(e.id) ? "outgoing" : "dim";
      const data = { state, typeOnly: e.typeOnly, network: e.network, count: e.count };
      const color = edgeColor(data);
      const sides = facingSides(boxes.get(e.source), boxes.get(e.target), e.sourceHandle !== null, e.targetHandle !== null);
      (state === "incoming" || state === "outgoing" ? bright : dim).push({
        id: e.id,
        type: "dependency",
        source: e.source,
        sourceHandle: e.sourceHandle === null ? `s-${sides.from}` : `${e.sourceHandle}|s-${sides.from}`,
        target: e.target,
        targetHandle: e.targetHandle === null ? `t-${sides.to}` : `${e.targetHandle}|t-${sides.to}`,
        markerEnd: { type: MarkerType.ArrowClosed, color, width: 14, height: 14 },
        data,
      });
    }
    // Bright edges are drawn last so they cross over the dim ones. Order,
    // not zIndex: a raised edge would also draw over the nodes.
    return [...dim, ...bright];
  }, [drawn, lit, boxes]);

  const flow = useReactFlow();

  // The camera is worked out from the layout's own boxes, which are exact,
  // not from what React Flow has measured so far: a fit against boxes it
  // hasn't sized yet lands somewhere arbitrary. It waits only for the canvas
  // to have a size. A new set of boxes (another folder, a filter) fits
  // itself; an explicit request (fit, or bring a file into view) is applied
  // in its place, so it wins.
  const paneWidth = useStore((state) => state.width);
  const paneHeight = useStore((state) => state.height);
  const handledCamera = useRef<number | null>(null);
  const fittedLayout = useRef<string | null>(null);
  const layoutKey = useMemo(() => view.objects.map((o) => o.id).join("|"), [view]);
  useEffect(() => {
    if (paneWidth === 0 || paneHeight === 0 || boxes.size === 0) return;
    const duration = reduceMotion ? 0 : 650;
    const fit = () =>
      void flow.setViewport(getViewportForBounds(boundsOf(boxes), paneWidth, paneHeight, INITIAL_MIN_ZOOM, INITIAL_MAX_ZOOM, FIT_PADDING), {
        duration,
      });
    const fresh = camera !== null && camera.nonce !== handledCamera.current;
    if (!fresh) {
      if (layoutKey !== fittedLayout.current) {
        fittedLayout.current = layoutKey;
        fit();
      }
      return;
    }
    handledCamera.current = camera.nonce;
    fittedLayout.current = layoutKey;
    if (camera.kind === "fit") return fit();
    if (camera.kind === "group") {
      const box = boxes.get(camera.id);
      if (box) void flow.setCenter(box.x + box.width / 2, box.y + box.height / 2, { zoom: Math.max(flow.getZoom(), 0.85), duration });
      return;
    }
    const at = view.endpointOf.get(camera.path);
    const box = at ? boxes.get(at.object) : undefined;
    if (!at || !box) return fit();
    // A row sits inside its panel: aim at the row, not the panel's middle.
    const object = view.objects.find((o) => o.id === at.object);
    let y = box.y + box.height / 2;
    if (object?.kind === "panel" && at.handle !== null) {
      const index = object.rows.findIndex((r) => r.path === at.handle);
      // A scrolling panel's "above" row comes first.
      if (index >= 0) y = box.y + PANEL_HEADER_HEIGHT + (index + (object.scrolls ? 1 : 0)) * ROW_HEIGHT + ROW_HEIGHT / 2;
    }
    void flow.setCenter(box.x + box.width / 2, y, { zoom: Math.max(flow.getZoom(), 0.95), duration });
  }, [paneWidth, paneHeight, camera, layoutKey, flow, view, boxes, reduceMotion]);

  const actions = useMemo(
    () => ({ close: onClose, selectFile: onSelectFile, scroll: onScroll, hover: onHover }),
    [onClose, onSelectFile, onScroll, onHover],
  );
  const selectionValue = useMemo(() => ({ selection, highlight: lit, hovered, roles, settled }), [selection, lit, hovered, roles, settled]);

  return (
    <MapActions.Provider value={actions}>
      <MapSelection.Provider value={selectionValue}>
        <ReactFlow
          nodes={nodes}
          edges={flowEdges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          nodesFocusable={false}
          edgesFocusable={false}
          minZoom={MIN_ZOOM}
          maxZoom={MAX_ZOOM}
          proOptions={{ hideAttribution: true }}
          // Folded nodes open here. Panels handle their own header and row
          // clicks, which bubble up to this too and are ignored.
          onNodeClick={(_, node) => {
            if (node.type === "folded") onOpen(node.id);
          }}
          onPaneClick={onDeselect}
          aria-label="Dependency map"
        >
          <Background variant={BackgroundVariant.Dots} gap={22} size={1} color="color-mix(in srgb, var(--ink) 9%, transparent)" />

          <Panel position="bottom-left" className="!m-3 hidden sm:block">
            <MapLegend categories={categories} />
          </Panel>

          <Panel position="bottom-right" className="!m-3 flex flex-col items-end gap-2">
            <MiniMap
              className="!relative !m-0 hidden md:block"
              style={{ width: 168, height: 104 }}
              pannable
              zoomable
              nodeBorderRadius={6}
              nodeColor={(n) => (n.type === "panel" ? "#8b5cf6" : "#5d6274")}
              nodeStrokeWidth={0}
              ariaLabel="Map overview"
            />
            <div className="flex items-center gap-0.5 rounded-xl border border-line-strong bg-panel/90 p-1 shadow-xl shadow-black/30 backdrop-blur">
              <IconButton label="Zoom out" onClick={() => void flow.zoomOut({ duration: 200 })}>
                <Minus className="size-4" />
              </IconButton>
              <IconButton label="Zoom in" onClick={() => void flow.zoomIn({ duration: 200 })}>
                <Plus className="size-4" />
              </IconButton>
              <IconButton
                label="Fit to view"
                onClick={() =>
                  void flow.setViewport(getViewportForBounds(boundsOf(boxes), paneWidth, paneHeight, MIN_ZOOM, INITIAL_MAX_ZOOM, FIT_PADDING), {
                    duration: reduceMotion ? 0 : 600,
                  })
                }
              >
                <Maximize2 className="size-3.5" />
              </IconButton>
            </div>
          </Panel>

          <Panel position="top-right" className="!m-3 hidden xl:block">
            <span className="rounded-md border border-line bg-panel/80 px-2 py-1 text-[10.5px] text-subtle backdrop-blur">
              Click a box to go inside · drag to pan · scroll to zoom
            </span>
          </Panel>

          {view.edges.length > STRONGEST && (
            <Panel position="bottom-center" className="!mb-3">
              <button
                type="button"
                onClick={onToggleAllLines}
                className="rounded-full border border-line-strong bg-panel/90 px-3 py-1 text-[11.5px] text-muted shadow-lg shadow-black/20 backdrop-blur transition hover:text-fg"
              >
                {allLines ? (
                  <>
                    All {view.edges.length} connections · <span className="text-violet-soft">show the strongest</span>
                  </>
                ) : (
                  <>
                    The {STRONGEST} strongest of {view.edges.length} connections · <span className="text-violet-soft">show all</span>
                  </>
                )}
              </button>
            </Panel>
          )}
        </ReactFlow>
      </MapSelection.Provider>
    </MapActions.Provider>
  );
}

function boundsOf(boxes: ReadonlyMap<string, Box>): Box {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const b of boxes.values()) {
    minX = Math.min(minX, b.x);
    minY = Math.min(minY, b.y);
    maxX = Math.max(maxX, b.x + b.width);
    maxY = Math.max(maxY, b.y + b.height);
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

type Side = "top" | "bottom" | "left" | "right";

/**
 * Which sides a line leaves and enters by: the ones facing each other, so a
 * box beside another is joined straight across and one below by a drop.
 * A row only has its left and right sides.
 */
export function facingSides(from: Box | undefined, to: Box | undefined, fromRow: boolean, toRow: boolean): { from: Side; to: Side } {
  if (!from || !to) return { from: "right", to: "left" };
  const dx = to.x + to.width / 2 - (from.x + from.width / 2);
  const dy = to.y + to.height / 2 - (from.y + from.height / 2);
  const across = fromRow || toRow || Math.abs(dx) > Math.abs(dy);
  if (across) return dx >= 0 ? { from: "right", to: "left" } : { from: "left", to: "right" };
  return dy >= 0 ? { from: "bottom", to: "top" } : { from: "top", to: "bottom" };
}
