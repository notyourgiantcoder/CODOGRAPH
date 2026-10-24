"use client";

import dagre from "@dagrejs/dagre";
import {
  Background,
  BackgroundVariant,
  Handle,
  MarkerType,
  MiniMap,
  Panel,
  Position,
  ReactFlow,
  ReactFlowProvider,
  getViewportForBounds,
  useReactFlow,
  useStore,
  type EdgeTypes,
  type Node,
  type NodeProps,
  type NodeTypes,
} from "@xyflow/react";
import "@xyflow/react/dist/base.css";
import { Maximize2, Minus, Plus } from "lucide-react";
import { createContext, memo, useContext, useEffect, useMemo, useRef, useState } from "react";
import { IconButton } from "@/components/ui/primitives";
import { RoleIcon } from "@/components/ui/role-icon";
import { cn } from "@/lib/cn";
import { roleColor } from "@/lib/graph/role-style";
import type { Selection } from "@/lib/graph/highlight";
import { directoryOf } from "@/lib/graph/workspace";
import type { Edge, MapFile } from "@/lib/parser/types";
import { UNCLASSIFIED, type RailKey } from "@/lib/roles";
import { usePrefersReducedMotion } from "@/lib/use-media-query";
import type { Camera } from "./dependency-map";
import { facingSides } from "./dependency-map";
import { DependencyEdge, edgeColor, type EdgeState, type MapFlowEdge } from "./edge";
import type { Box } from "./layout";
import { MapLegend } from "./legend";

// A repository small enough to read whole, drawn the way the landing page
// draws its playground: every file a node, every edge a line, laid out in
// layers that follow the imports. Past FULL_MAP_FILES the workspace uses the
// folder view instead.

export { FULL_MAP_FILES } from "@/lib/graph/scope";

const NODE_W = 178;
const NODE_H = 48;
const FIT_PADDING = 0.08;
const MIN_ZOOM = 0.15;
const INITIAL_MIN_ZOOM = 0.35;
const INITIAL_MAX_ZOOM = 1.1;

type Visual = "default" | "hovered" | "selected" | "dependency" | "dependent" | "dimmed";
type FileNodeData = { path: string; visual: Visual };
type FileFlowNode = Node<FileNodeData, "file">;

const Labels = createContext<{ roles: ReadonlyMap<string, RailKey>; names: ReadonlyMap<string, string>; settled: boolean }>({
  roles: new Map(),
  names: new Map(),
  settled: true,
});

const nodeTypes: NodeTypes = { file: memo(FileNodeView) };
const edgeTypes: EdgeTypes = { dependency: DependencyEdge };

export type FileMapProps = {
  /** The files on the map: every one not filtered off. */
  files: MapFile[];
  /** Edges between them, already filtered by the type-only toggle. */
  edges: Edge[];
  selection: Selection;
  hover: Selection;
  roles: ReadonlyMap<string, RailKey>;
  names: ReadonlyMap<string, string>;
  categories: { key: RailKey; count: number }[];
  camera: Camera;
  onSelectFile: (path: string) => void;
  onHover: (hover: Selection) => void;
  onDeselect: () => void;
};

export function FileMap(props: FileMapProps) {
  return (
    <ReactFlowProvider>
      <FileCanvas {...props} />
    </ReactFlowProvider>
  );
}

function FileCanvas({ files, edges, selection, hover, roles, names, categories, camera, onSelectFile, onHover, onDeselect }: FileMapProps) {
  const reduceMotion = usePrefersReducedMotion();
  const flow = useReactFlow();
  const paths = useMemo(() => new Set(files.map((f) => f.path)), [files]);
  const shown = useMemo(() => edges.filter((e) => paths.has(e.source) && paths.has(e.target) && e.source !== e.target), [edges, paths]);
  const boxes = useMemo(() => layoutFiles(files, shown), [files, shown]);

  const [settled, setSettled] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => setSettled(true), reduceMotion ? 0 : 900);
    return () => window.clearTimeout(t);
  }, [reduceMotion]);

  // As on the landing page: the pointer previews a file's neighbourhood, the
  // selection holds one when the pointer is elsewhere.
  const focus = hover?.kind === "file" ? hover.path : selection?.kind === "file" ? selection.path : null;
  const selected = selection?.kind === "file" ? selection.path : null;
  const near = useMemo(() => {
    if (focus === null) return null;
    const dependencies = new Set<string>();
    const dependents = new Set<string>();
    for (const e of shown) {
      if (e.source === focus) dependencies.add(e.target);
      if (e.target === focus) dependents.add(e.source);
    }
    return { dependencies, dependents };
  }, [focus, shown]);

  const nodes = useMemo(
    () =>
      files.map((f): FileFlowNode => {
        const box = boxes.get(f.path);
        let visual: Visual = "default";
        if (f.path === selected) visual = "selected";
        else if (near && focus !== null) {
          if (f.path === focus) visual = "hovered";
          else if (near.dependencies.has(f.path)) visual = "dependency";
          else if (near.dependents.has(f.path)) visual = "dependent";
          else visual = "dimmed";
        }
        return {
          id: f.path,
          type: "file",
          position: { x: box?.x ?? 0, y: box?.y ?? 0 },
          width: NODE_W,
          height: NODE_H,
          data: { path: f.path, visual },
        };
      }),
    [files, boxes, selected, near, focus],
  );

  const flowEdges = useMemo(() => {
    const dim: MapFlowEdge[] = [];
    const bright: MapFlowEdge[] = [];
    shown.forEach((e, i) => {
      const state: EdgeState = focus === null ? "idle" : e.source === focus ? "outgoing" : e.target === focus ? "incoming" : "dim";
      const data = { state, typeOnly: e.typeOnly, network: e.kind === "fetch", count: 1 };
      const sides = facingSides(boxes.get(e.source), boxes.get(e.target), false, false);
      (state === "idle" || state === "dim" ? dim : bright).push({
        id: `${i}:${e.source}>${e.target}:${e.kind}`,
        type: "dependency",
        source: e.source,
        sourceHandle: `s-${sides.from}`,
        target: e.target,
        targetHandle: `t-${sides.to}`,
        markerEnd: { type: MarkerType.ArrowClosed, color: edgeColor(data), width: 14, height: 14 },
        data,
      });
    });
    // Bright lines last, so they cross over the dim ones.
    return [...dim, ...bright];
  }, [shown, focus, boxes]);

  // Fit when the set of files changes; an explicit camera request wins, as on the folder map.
  const paneWidth = useStore((s) => s.width);
  const paneHeight = useStore((s) => s.height);
  const handled = useRef<number | null>(null);
  const fitted = useRef<string | null>(null);
  const layoutKey = useMemo(() => files.map((f) => f.path).join("|"), [files]);
  useEffect(() => {
    if (paneWidth === 0 || paneHeight === 0 || boxes.size === 0) return;
    const duration = reduceMotion ? 0 : 650;
    const fit = () =>
      void flow.setViewport(getViewportForBounds(boundsOf(boxes), paneWidth, paneHeight, INITIAL_MIN_ZOOM, INITIAL_MAX_ZOOM, FIT_PADDING), {
        duration,
      });
    if (camera === null || camera.nonce === handled.current) {
      if (fitted.current !== layoutKey) {
        fitted.current = layoutKey;
        fit();
      }
      return;
    }
    handled.current = camera.nonce;
    fitted.current = layoutKey;
    if (camera.kind !== "focus") return fit();
    const box = boxes.get(camera.path);
    if (!box) return fit();
    void flow.setCenter(box.x + box.width / 2, box.y + box.height / 2, { zoom: Math.max(flow.getZoom(), 0.95), duration });
  }, [paneWidth, paneHeight, camera, layoutKey, boxes, flow, reduceMotion]);

  const labels = useMemo(() => ({ roles, names, settled }), [roles, names, settled]);

  return (
    <Labels.Provider value={labels}>
      <ReactFlow<FileFlowNode, MapFlowEdge>
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
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
        onNodeClick={(_, node) => onSelectFile(node.id)}
        onNodeMouseEnter={(_, node) => onHover({ kind: "file", path: node.id })}
        onNodeMouseLeave={() => onHover(null)}
        onPaneClick={onDeselect}
        aria-label="Every file and the imports between them"
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
            nodeColor={(n) => roleColor(roles.get(n.id) ?? UNCLASSIFIED)}
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
            Drag to pan · scroll to zoom
          </span>
        </Panel>
      </ReactFlow>
    </Labels.Provider>
  );
}

const GAP_X = 22;
const GAP_Y = 28;
const LAYER_GAP = 64;

// Layers that follow the imports, top to bottom, as the landing page lays its
// files out: dagre decides each file's layer and its order within it. A layer
// wider than the map is wrapped onto more rows, with as many columns as keep
// the whole drawing about square, so a layer of thirty components doesn't
// stretch the map into a strip too thin to read. Deterministic.
function layoutFiles(files: readonly MapFile[], edges: readonly Edge[]): Map<string, Box> {
  const g = new dagre.graphlib.Graph<{ rankdir: "TB"; nodesep: number; ranksep: number }, { width: number; height: number; x?: number; y?: number }, object>();
  g.setGraph({ rankdir: "TB", nodesep: GAP_X, ranksep: LAYER_GAP });
  g.setDefaultEdgeLabel(() => ({}));
  for (const f of files) g.setNode(f.path, { width: NODE_W, height: NODE_H });
  const seen = new Set<string>();
  for (const e of edges) {
    const key = `${e.source}>${e.target}`;
    if (seen.has(key)) continue;
    seen.add(key);
    g.setEdge(e.source, e.target);
  }
  dagre.layout(g);

  // Group by dagre's layer (its y), each layer in dagre's left-to-right order.
  const layers = new Map<number, { path: string; x: number }[]>();
  for (const f of files) {
    const n = g.node(f.path);
    if (n.x === undefined || n.y === undefined) throw new Error(`Layout gave ${f.path} no position`);
    const layer = layers.get(n.y) ?? [];
    layer.push({ path: f.path, x: n.x });
    layers.set(n.y, layer);
  }
  const columns = Math.max(4, Math.ceil(Math.sqrt(files.length * 1.4)));
  const width = columns * (NODE_W + GAP_X) - GAP_X;
  const boxes = new Map<string, Box>();
  let y = 0;
  for (const [, layer] of [...layers].sort((a, b) => a[0] - b[0])) {
    layer.sort((a, b) => a.x - b.x || a.path.localeCompare(b.path));
    for (let start = 0; start < layer.length; start += columns) {
      const row = layer.slice(start, start + columns);
      // Each row is centred, so short layers sit under the middle of long ones.
      const rowWidth = row.length * (NODE_W + GAP_X) - GAP_X;
      const left = (width - rowWidth) / 2;
      row.forEach((node, i) => boxes.set(node.path, { x: left + i * (NODE_W + GAP_X), y, width: NODE_W, height: NODE_H }));
      y += NODE_H + GAP_Y;
    }
    y += LAYER_GAP - GAP_Y;
  }
  return boxes;
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

const anchor = "!size-px !min-h-0 !min-w-0 !border-0 !bg-transparent";
const SIDES = [
  ["top", Position.Top],
  ["bottom", Position.Bottom],
  ["left", Position.Left],
  ["right", Position.Right],
] as const;

// The landing page's file node, state for state.
const SHELL: Record<Visual, string> = {
  default: "border-line-strong bg-panel-2",
  hovered: "border-ink/30 bg-panel-3",
  selected: "border-violet bg-panel-2 shadow-[0_0_0_3px_rgba(139,92,246,0.25),0_0_36px_-6px_rgba(139,92,246,0.7)]",
  dependency: "border-cyan/55 bg-tint-cyan",
  dependent: "border-violet-soft/55 bg-tint-violet",
  dimmed: "border-line bg-panel-2 opacity-40",
};

function FileNodeView({ data }: NodeProps<FileFlowNode>) {
  const { roles, names, settled } = useContext(Labels);
  return (
    <div className={cn(!settled && "animate-node-in")} style={{ width: NODE_W, height: NODE_H }}>
      <div
        title={data.path}
        className={cn(
          "relative flex h-full cursor-pointer items-center gap-2.5 rounded-[10px] border px-2.5 transition-[opacity,border-color,box-shadow,background-color] duration-300",
          SHELL[data.visual],
        )}
      >
        {SIDES.map(([side, position]) => (
          <Handle key={`s-${side}`} id={`s-${side}`} type="source" position={position} className={anchor} isConnectable={false} />
        ))}
        {SIDES.map(([side, position]) => (
          <Handle key={`t-${side}`} id={`t-${side}`} type="target" position={position} className={anchor} isConnectable={false} />
        ))}
        <RoleIcon role={roles.get(data.path) ?? UNCLASSIFIED} />
        <div className="min-w-0 flex-1 leading-tight">
          <div className="truncate text-[12.5px] font-medium text-fg">{names.get(data.path) ?? data.path}</div>
          <div className="truncate font-mono text-[10px] text-subtle">{directoryOf(data.path) || "/"}</div>
        </div>
      </div>
    </div>
  );
}
