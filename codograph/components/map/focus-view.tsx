"use client";

import {
  Background,
  BackgroundVariant,
  Handle,
  MarkerType,
  Panel,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type EdgeTypes,
  type Node,
  type NodeProps,
  type NodeTypes,
} from "@xyflow/react";
import "@xyflow/react/dist/base.css";
import { ArrowLeft, Maximize2, Minus, Plus } from "lucide-react";
import { createContext, memo, useContext, useMemo } from "react";
import { IconButton } from "@/components/ui/primitives";
import { RoleIcon } from "@/components/ui/role-icon";
import { cn } from "@/lib/cn";
import { directoryOf } from "@/lib/graph/workspace";
import type { Edge, MapFile } from "@/lib/parser/types";
import { UNCLASSIFIED, type RailKey } from "@/lib/roles";
import { usePrefersReducedMotion } from "@/lib/use-media-query";
import { DependencyEdge, edgeColor, type MapEdgeData, type MapFlowEdge } from "./edge";

// One file and its neighbours, nothing else: what imports it on the left, what
// it imports on the right, each on an arc around it as the landing page draws
// a neighbourhood. Every node is a real neighbour; a side with more than fits
// says how many it leaves out.

/** Neighbours drawn on each side. The inspector's tabs list every one. */
const PER_SIDE = 16;
const NODE_W = 196;
const NODE_H = 48;

type FocusData = { path: string; centre: boolean } | { more: number; side: "in" | "out" };
type FocusNode = Node<FocusData, "focus">;

const FocusActions = createContext<{
  select: (path: string) => void;
  roles: ReadonlyMap<string, RailKey>;
  names: ReadonlyMap<string, string>;
}>({ select: () => {}, roles: new Map(), names: new Map() });

const nodeTypes: NodeTypes = { focus: memo(FocusNodeView) };
const edgeTypes: EdgeTypes = { dependency: DependencyEdge };

export function FocusView(props: {
  path: string;
  byPath: ReadonlyMap<string, MapFile>;
  edges: Edge[];
  roles: ReadonlyMap<string, RailKey>;
  names: ReadonlyMap<string, string>;
  onSelect: (path: string) => void;
  onBack: () => void;
}) {
  return (
    <ReactFlowProvider>
      {/* Keyed by the file, so each new centre fits itself to the view. */}
      <FocusCanvas key={props.path} {...props} />
    </ReactFlowProvider>
  );
}

function FocusCanvas({ path, byPath, edges, roles, names, onSelect, onBack }: Parameters<typeof FocusView>[0]) {
  const reduceMotion = usePrefersReducedMotion();
  const flow = useReactFlow();

  const { nodes, flowEdges, counts } = useMemo(() => {
    // One entry per neighbour, whichever of its edges comes first; a file
    // importing itself isn't its own neighbour.
    const side = (pick: (e: Edge) => string | null) => {
      const found = new Map<string, Edge>();
      for (const e of edges) {
        const other = pick(e);
        if (other !== null && other !== path && !found.has(other)) found.set(other, e);
      }
      // Most-imported first: the neighbours the rest of the repository leans on.
      return [...found].sort((a, b) => (byPath.get(b[0])?.fanIn ?? 0) - (byPath.get(a[0])?.fanIn ?? 0) || a[0].localeCompare(b[0]));
    };
    const incoming = side((e) => (e.target === path ? e.source : null));
    const outgoing = side((e) => (e.source === path ? e.target : null));

    const out: FocusNode[] = [{ id: path, type: "focus", position: { x: -NODE_W / 2, y: -NODE_H / 2 }, data: { path, centre: true } }];
    const lines: MapFlowEdge[] = [];
    const place = (list: [string, Edge][], direction: -1 | 1) => {
      const shown = list.slice(0, PER_SIDE);
      const slots = shown.length + (list.length > PER_SIDE ? 1 : 0);
      const radius = Math.max(320, slots * 34);
      const spread = (Math.PI * 140) / 180;
      shown.forEach(([other, e], i) => {
        const angle = slots === 1 ? 0 : -spread / 2 + (spread * i) / (slots - 1);
        const x = direction * radius * Math.cos(angle) - NODE_W / 2;
        const y = radius * Math.sin(angle) - NODE_H / 2;
        const id = `${direction}:${other}`;
        out.push({ id, type: "focus", position: { x, y }, data: { path: other, centre: false } });
        const data: MapEdgeData = { state: direction === -1 ? "incoming" : "outgoing", typeOnly: e.typeOnly, network: e.kind === "fetch", count: 1 };
        lines.push({
          id: `line:${id}`,
          type: "dependency",
          source: direction === -1 ? id : path,
          sourceHandle: "right",
          target: direction === -1 ? path : id,
          targetHandle: "left",
          markerEnd: { type: MarkerType.ArrowClosed, color: edgeColor(data), width: 14, height: 14 },
          data,
        });
      });
      if (list.length > PER_SIDE) {
        const angle = spread / 2;
        out.push({
          id: `${direction}:more`,
          type: "focus",
          position: { x: direction * radius * Math.cos(angle) - NODE_W / 2, y: radius * Math.sin(angle) - NODE_H / 2 },
          data: { more: list.length - PER_SIDE, side: direction === -1 ? "in" : "out" },
        });
      }
    };
    place(incoming, -1);
    place(outgoing, 1);
    return { nodes: out, flowEdges: lines, counts: { in: incoming.length, out: outgoing.length } };
  }, [path, edges, byPath]);

  const actions = useMemo(() => ({ select: onSelect, roles, names }), [onSelect, roles, names]);

  return (
    <FocusActions.Provider value={actions}>
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
        minZoom={0.2}
        maxZoom={2}
        fitView
        fitViewOptions={{ padding: 0.15, maxZoom: 1.1 }}
        proOptions={{ hideAttribution: true }}
        onNodeClick={(_, node) => {
          if ("path" in node.data && !node.data.centre) onSelect(node.data.path);
        }}
        aria-label="Focus on one file and its neighbours"
      >
        <Background variant={BackgroundVariant.Dots} gap={22} size={1} color="color-mix(in srgb, var(--ink) 9%, transparent)" />
        <Panel position="top-left" className="!m-3">
          <div className="flex items-center gap-2 rounded-xl border border-line-strong bg-panel/90 py-1 pl-1 pr-3 shadow-xl shadow-black/20 backdrop-blur">
            <button
              type="button"
              onClick={onBack}
              className="inline-flex h-7 items-center gap-1.5 rounded-lg px-2 text-[12px] font-medium text-muted transition hover:bg-ink/[0.06] hover:text-fg"
            >
              <ArrowLeft className="size-3.5" aria-hidden />
              Map
            </button>
            <span className="h-4 w-px bg-line-strong" aria-hidden />
            <span className="font-mono text-[11.5px] text-subtle tabular-nums">
              <span className="text-violet-soft">←{counts.in} import it</span> · <span className="text-cyan">it imports {counts.out}→</span>
            </span>
          </div>
        </Panel>
        <Panel position="bottom-right" className="!m-3">
          <div className="flex items-center gap-0.5 rounded-xl border border-line-strong bg-panel/90 p-1 shadow-xl shadow-black/30 backdrop-blur">
            <IconButton label="Zoom out" onClick={() => void flow.zoomOut({ duration: 200 })}>
              <Minus className="size-4" />
            </IconButton>
            <IconButton label="Zoom in" onClick={() => void flow.zoomIn({ duration: 200 })}>
              <Plus className="size-4" />
            </IconButton>
            <IconButton label="Fit to view" onClick={() => void flow.fitView({ duration: reduceMotion ? 0 : 600, padding: 0.15 })}>
              <Maximize2 className="size-3.5" />
            </IconButton>
          </div>
        </Panel>
      </ReactFlow>
    </FocusActions.Provider>
  );
}

// Handles are invisible anchors: a line ends at the card, not at a dot.
const anchor = "!size-px !min-h-0 !min-w-0 !border-0 !bg-transparent";

function FocusNodeView({ data }: NodeProps<FocusNode>) {
  const { roles, names } = useContext(FocusActions);
  if ("more" in data) {
    return (
      <div
        className="flex items-center justify-center rounded-[10px] border border-dashed border-line-strong px-3 text-[11.5px] text-subtle"
        style={{ width: NODE_W, height: NODE_H }}
      >
        +{data.more.toLocaleString("en")} more · see {data.side === "in" ? "Dependents" : "Deps"}
      </div>
    );
  }
  const dir = directoryOf(data.path);
  return (
    <div className="animate-node-in" style={{ width: NODE_W, height: NODE_H }}>
      <div
        title={data.path}
        className={cn(
          "relative flex h-full items-center gap-2.5 rounded-[10px] border px-2.5 transition-[border-color,background-color] duration-300",
          data.centre
            ? "border-violet bg-panel-2 shadow-[0_0_0_3px_rgba(139,92,246,0.25),0_0_36px_-6px_rgba(139,92,246,0.7)]"
            : "cursor-pointer border-line-strong bg-panel-2 hover:border-ink/30 hover:bg-panel-3",
        )}
      >
        <Handle id="left" type="target" position={Position.Left} className={anchor} isConnectable={false} />
        <RoleIcon role={roles.get(data.path) ?? UNCLASSIFIED} />
        <div className="min-w-0 flex-1 leading-tight">
          <div className="truncate text-[12.5px] font-medium text-fg">{names.get(data.path) ?? data.path}</div>
          <div className="truncate font-mono text-[10px] text-subtle">{dir || "/"}</div>
        </div>
        <Handle id="right" type="source" position={Position.Right} className={anchor} isConnectable={false} />
      </div>
    </div>
  );
}
