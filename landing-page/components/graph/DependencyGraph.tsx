"use client";

import {
  Background,
  BackgroundVariant,
  MarkerType,
  MiniMap,
  Panel,
  ReactFlow,
  ReactFlowProvider,
  useNodesState,
  useReactFlow,
  type NodeMouseHandler,
} from "@xyflow/react";

import { Maximize2, Minus, Plus } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { DependencyEdge, EDGE_COLORS, type DependencyEdgeType, type EdgeVisual } from "@/components/graph/DependencyEdge";
import { FileNode, type FileNodeType, type NodeVisual } from "@/components/graph/FileNode";
import { GraphLegend } from "@/components/graph/GraphLegend";
import { EDGE_ROUTES, ENTRANCE_ORDER, NODE_H, NODE_W, nodePosition } from "@/components/graph/layout";
import { useDemo, useRevealedImpact } from "@/components/demo/DemoProvider";
import { IconButton } from "@/components/ui/primitives";
import { FILES } from "@/data/repository";
import { CATEGORY_META } from "@/lib/categories";
import { cn } from "@/lib/cn";
import { usePrefersReducedMotion } from "@/lib/useMediaQuery";
import { DEPENDENCIES, getFile, getIncoming, getOutgoing } from "@/lib/graph";

const nodeTypes = { file: FileNode };
const edgeTypes = { dependency: DependencyEdge };

const ENTRANCE_MS = 1700;

const initialNodes: FileNodeType[] = FILES.map((f) => ({
  id: f.id,
  type: "file",
  position: nodePosition(f.id),
  width: NODE_W,
  height: NODE_H,
  data: { fileId: f.id, visual: "default", selected: false, enterDelay: 0 },
}));

export interface DependencyGraphProps {
  variant: "hero" | "full";
  className?: string;
  /** Delay the entrance until the graph is first scrolled into view. */
  animateOnView?: boolean;
}

export function DependencyGraph(props: DependencyGraphProps) {
  return (
    <ReactFlowProvider>
      <GraphCanvas {...props} />
    </ReactFlowProvider>
  );
}

function GraphCanvas({ variant, className, animateOnView = false }: DependencyGraphProps) {
  const { selectedId, categories, showTypeEdges, camera, select, impact } = useDemo();
  const revealed = useRevealedImpact();
  const reduceMotion = usePrefersReducedMotion();
  const flow = useReactFlow();
  const container = useRef<HTMLDivElement>(null);

  const [baseNodes, , onNodesChange] = useNodesState(initialNodes);
  const [hovered, setHovered] = useState<string | null>(null);
  const [visible, setVisible] = useState(!animateOnView);
  const [settled, setSettled] = useState(false);

  // Start the entrance only once the canvas is on screen, so it is actually seen.
  useEffect(() => {
    if (visible || !container.current) return;
    const io = new IntersectionObserver(
      ([entry]) => entry.isIntersecting && setVisible(true),
      { threshold: 0.25 },
    );
    io.observe(container.current);
    return () => io.disconnect();
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    const t = window.setTimeout(() => setSettled(true), reduceMotion ? 0 : ENTRANCE_MS);
    return () => window.clearTimeout(t);
  }, [visible, reduceMotion]);

  // After the whole network has drawn itself, glide to the selected module's
  // neighbourhood so labels become readable. Shared types are left out of the
  // framing because almost everything imports them.
  const introDone = useRef(false);
  useEffect(() => {
    if (!settled || introDone.current || !selectedId) return;
    introDone.current = true;
    if (impact) return;
    const neighbours = [...getOutgoing(selectedId).map((d) => d.target), ...getIncoming(selectedId).map((d) => d.source)].filter(
      (id) => getFile(id).category !== "type",
    );
    flow.fitView({
      nodes: [selectedId, ...neighbours].map((id) => ({ id })),
      padding: 0.25,
      minZoom: variant === "hero" ? 0.78 : 0.7,
      maxZoom: 1,
      duration: reduceMotion ? 0 : 1400,
    });
  }, [settled, variant, selectedId, flow, reduceMotion, impact]);

  // Camera requests coming from the explorer, search, inspector or assistant.
  const lastCamera = useRef<number | null>(null);
  useEffect(() => {
    if (!camera || camera.nonce === lastCamera.current) return;
    lastCamera.current = camera.nonce;
    const duration = reduceMotion ? 0 : 650;
    if (camera.kind === "fit") {
      flow.fitView({ duration, padding: 0.1 });
    } else if (camera.kind === "focus" && selectedId) {
      const n = flow.getNode(selectedId);
      if (n && !n.hidden) {
        flow.setCenter(n.position.x + NODE_W / 2, n.position.y + NODE_H / 2, {
          zoom: Math.max(flow.getZoom(), 0.95),
          duration,
        });
      }
    } else if (camera.kind === "impact" && impact) {
      const ids = [impact.result.origin, ...impact.result.order];
      flow.fitView({ nodes: ids.map((id) => ({ id })), duration: reduceMotion ? 0 : 800, padding: 0.22, maxZoom: 1.1 });
    }
  }, [camera, flow, selectedId, impact, reduceMotion]);

  const hiddenNodes = useMemo(
    () => new Set(FILES.filter((f) => !categories.includes(f.category)).map((f) => f.id)),
    [categories],
  );

  const focusId = impact ? null : (hovered ?? selectedId);
  const focusSets = useMemo(() => {
    if (!focusId) return null;
    return {
      deps: new Set(getOutgoing(focusId).map((d) => d.target)),
      dependents: new Set(getIncoming(focusId).map((d) => d.source)),
    };
  }, [focusId]);

  const nodes = useMemo<FileNodeType[]>(
    () =>
      baseNodes.map((node) => {
        const id = node.id;
        let visual: NodeVisual = "default";
        let depth: number | undefined;
        if (revealed) {
          if (id === revealed.origin) visual = "origin";
          else if (revealed.revealedIds.has(id)) {
            visual = "impacted";
            depth = revealed.revealedDepths.get(id);
          } else visual = revealed.depths.has(id) ? "pending" : "dimmed";
        } else if (focusId && focusSets) {
          if (id === focusId) visual = hovered === id && selectedId !== id ? "hovered" : "default";
          else if (focusSets.deps.has(id)) visual = "dependency";
          else if (focusSets.dependents.has(id)) visual = "dependent";
          else visual = "dimmed";
        }
        return {
          ...node,
          hidden: hiddenNodes.has(id),
          data: {
            ...node.data,
            visual,
            depth,
            selected: id === selectedId,
            enterDelay: settled || reduceMotion ? 0 : (ENTRANCE_ORDER.get(id) ?? 0) * 24,
          },
        };
      }),
    [baseNodes, revealed, focusId, focusSets, hovered, selectedId, hiddenNodes, settled, reduceMotion],
  );

  const edges = useMemo<DependencyEdgeType[]>(() => {
    const depthOf = (id: string) => (revealed ? (id === revealed.origin ? 0 : revealed.revealedDepths.get(id)) : undefined);
    return DEPENDENCIES.map((d) => {
      const route = EDGE_ROUTES.get(d.id)!;
      let visual: EdgeVisual = "idle";
      let reverse = false;
      if (revealed) {
        const ds = depthOf(d.source);
        const dt = depthOf(d.target);
        if (revealed.edges.has(d.id) && ds !== undefined && dt !== undefined) {
          visual = "impact";
          reverse = dt < ds;
        } else visual = "dim";
      } else if (focusId) {
        if (d.source === focusId) visual = "dependency";
        else if (d.target === focusId) {
          visual = "dependent";
          reverse = true;
        } else visual = "dim";
      }
      const color =
        visual === "idle"
          ? d.kind === "fetch"
            ? "rgba(103,213,255,0.5)"
            : "rgba(148,155,170,0.45)"
          : EDGE_COLORS[visual];
      const sourceLayer = getFile(d.source).layer;
      return {
        id: d.id,
        source: d.source,
        target: d.target,
        type: "dependency",
        sourceHandle: route.sourceHandle,
        targetHandle: route.targetHandle,
        hidden: hiddenNodes.has(d.source) || hiddenNodes.has(d.target) || (d.kind === "type" && !showTypeEdges),
        zIndex: visual === "idle" || visual === "dim" ? 0 : 1,
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: visual === "dim" ? "rgba(148,155,170,0.1)" : color,
          width: 14,
          height: 14,
        },
        data: {
          kind: d.kind,
          visual,
          arc: route.arc,
          reverse,
          drawDelay: settled || reduceMotion ? null : 350 + sourceLayer * 110,
        },
      };
    });
  }, [revealed, focusId, hiddenNodes, showTypeEdges, settled, reduceMotion]);

  const onNodeClick: NodeMouseHandler<FileNodeType> = (_, node) => select(node.id);
  const onNodeEnter: NodeMouseHandler<FileNodeType> = (_, node) => setHovered(node.id);
  const onNodeLeave = () => setHovered(null);

  return (
    <div ref={container} className={cn("relative h-full w-full", className)}>
      {visible && (
      <ReactFlow<FileNodeType, DependencyEdgeType>
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onNodeClick={onNodeClick}
        onNodeMouseEnter={onNodeEnter}
        onNodeMouseLeave={onNodeLeave}
        onPaneClick={() => !impact && select(null)}
        nodesDraggable
        nodesConnectable={false}
        elementsSelectable={false}
        zoomOnScroll={false}
        preventScrolling={false}
        zoomActivationKeyCode={["Meta", "Control"]}
        zoomOnPinch
        panOnDrag
        minZoom={0.2}
        maxZoom={2}
        fitView
        fitViewOptions={{ padding: variant === "hero" ? 0.06 : 0.08 }}
        proOptions={{ hideAttribution: true }}
        aria-label="Interactive dependency graph of the synthetic acme/storefront repository"
      >
        <Background variant={BackgroundVariant.Dots} gap={22} size={1} color="rgba(255,255,255,0.09)" />

        <Panel position="bottom-left" className="!m-3 hidden sm:block">
          <GraphLegend defaultOpen={variant === "full"} />
        </Panel>

        <Panel position="bottom-right" className="!m-3 flex flex-col items-end gap-2">
          {variant === "full" && (
            <MiniMap
              className="!relative !m-0 hidden md:block"
              style={{ width: 168, height: 104 }}
              pannable
              zoomable
              nodeBorderRadius={6}
              nodeColor={(n) => CATEGORY_META[getFile(n.id).category].color}
              nodeStrokeWidth={0}
              ariaLabel="Graph minimap"
            />
          )}
          <div className="flex items-center gap-0.5 rounded-xl border border-line-strong bg-panel/90 p-1 shadow-xl shadow-black/40 backdrop-blur">
            <IconButton label="Zoom out" onClick={() => flow.zoomOut({ duration: 200 })}>
              <Minus className="size-4" />
            </IconButton>
            <IconButton label="Zoom in" onClick={() => flow.zoomIn({ duration: 200 })}>
              <Plus className="size-4" />
            </IconButton>
            <IconButton label="Fit to view" onClick={() => flow.fitView({ duration: reduceMotion ? 0 : 600, padding: 0.1 })}>
              <Maximize2 className="size-3.5" />
            </IconButton>
          </div>
        </Panel>

        <Panel position="top-right" className={cn("!m-3 hidden", variant === "full" && "lg:block")}>
          <span className="rounded-md border border-line bg-panel/80 px-2 py-1 text-[10.5px] text-subtle backdrop-blur">
            Drag to pan · <span className="font-mono">⌘/Ctrl</span> + scroll to zoom
          </span>
        </Panel>
      </ReactFlow>
      )}
    </div>
  );
}
