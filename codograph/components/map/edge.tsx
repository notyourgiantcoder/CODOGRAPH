"use client";

import { BaseEdge, getBezierPath, type Edge, type EdgeProps } from "@xyflow/react";
import { memo } from "react";

export type EdgeState = "idle" | "dim" | "incoming" | "outgoing";

export type MapEdgeData = {
  state: EdgeState;
  typeOnly: boolean;
  network: boolean;
  /** How many file-level edges the line stands for; thickness says it, gently. */
  count: number;
};

export type MapFlowEdge = Edge<MapEdgeData, "dependency">;

// The landing page's edge: grey at rest, violet into the selection, cyan out
// of it, with a moving dash along a lit line. Type-only imports and network
// calls are dashed at rest so they never pass for a plain import.
export const EDGE_COLORS: Record<EdgeState, string> = {
  idle: "var(--edge)",
  dim: "color-mix(in srgb, var(--subtle) 10%, transparent)",
  incoming: "var(--violet-soft)",
  outgoing: "var(--cyan)",
};

export function edgeColor(data: MapEdgeData): string {
  if (data.state === "idle" && data.network) return "color-mix(in srgb, var(--cyan) 45%, transparent)";
  if (data.state === "idle" && data.typeOnly) return "color-mix(in srgb, var(--subtle) 22%, transparent)";
  return EDGE_COLORS[data.state];
}

function DependencyEdgeComponent({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, markerEnd, data }: EdgeProps<MapFlowEdge>) {
  if (!data) return null;
  const [path] = getBezierPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, curvature: 0.32 });
  const active = data.state === "incoming" || data.state === "outgoing";
  const width = Math.min(2.6, 1.15 + Math.log2(data.count) / 3);
  return (
    <>
      <BaseEdge
        path={path}
        markerEnd={markerEnd}
        style={{
          stroke: edgeColor(data),
          strokeWidth: active ? width + 0.6 : width,
          strokeDasharray: active ? undefined : data.network ? "7 5" : data.typeOnly ? "2 4" : undefined,
          transition: "stroke 250ms, stroke-width 250ms",
        }}
      />
      {active && (
        <path
          d={path}
          fill="none"
          strokeOpacity={0.85}
          strokeWidth={1.75}
          strokeLinecap="round"
          className="edge-flow"
          // Set as style, not an attribute: light-dark() is CSS. The dash
          // flows along the import, from the importer to what it imports.
          style={{ stroke: data.state === "incoming" ? "light-dark(#ffffff, #ede9fe)" : "light-dark(#ffffff, #e0f7ff)" }}
        />
      )}
    </>
  );
}

export const DependencyEdge = memo(DependencyEdgeComponent);
