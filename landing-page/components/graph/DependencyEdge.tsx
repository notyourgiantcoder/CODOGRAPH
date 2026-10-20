"use client";

import { BaseEdge, getBezierPath, type Edge, type EdgeProps } from "@xyflow/react";
import { memo } from "react";
import type { DependencyKind } from "@/types/graph";

export type EdgeVisual = "idle" | "dim" | "dependency" | "dependent" | "impact";

export type DependencyEdgeData = {
  kind: DependencyKind;
  visual: EdgeVisual;
  arc: boolean;
  /** Animate the highlight against the import direction (e.g. blast radius flowing outward). */
  reverse: boolean;
  /** Entrance draw animation delay in ms, or null once the graph has settled. */
  drawDelay: number | null;
};

export type DependencyEdgeType = Edge<DependencyEdgeData, "dependency">;

export const EDGE_COLORS: Record<EdgeVisual, string> = {
  idle: "rgba(148,155,170,0.34)",
  dim: "rgba(148,155,170,0.07)",
  dependency: "#67d5ff",
  dependent: "#a78bfa",
  impact: "#67d5ff",
};

const DASH: Record<DependencyKind, string | undefined> = {
  import: undefined,
  type: "2 4",
  fetch: "7 5",
};

function DependencyEdgeComponent(props: EdgeProps<DependencyEdgeType>) {
  const { sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, markerEnd, data } = props;
  if (!data) return null;

  let path: string;
  if (data.arc) {
    const dip = 46 + Math.abs(targetX - sourceX) * 0.08;
    path = `M ${sourceX},${sourceY} C ${sourceX},${sourceY + dip} ${targetX},${targetY + dip} ${targetX},${targetY}`;
  } else {
    [path] = getBezierPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, curvature: 0.32 });
  }

  const active = data.visual === "dependency" || data.visual === "dependent" || data.visual === "impact";
  const color =
    data.visual === "idle" && data.kind === "fetch"
      ? "rgba(103,213,255,0.42)"
      : data.visual === "idle" && data.kind === "type"
        ? "rgba(148,155,170,0.2)"
        : EDGE_COLORS[data.visual];

  if (data.drawDelay !== null) {
    return (
      <path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth={1.25}
        pathLength={1}
        className="edge-draw"
        style={{ animationDelay: `${data.drawDelay}ms` }}
      />
    );
  }

  return (
    <>
      <BaseEdge
        path={path}
        markerEnd={markerEnd}
        style={{
          stroke: color,
          strokeWidth: active ? 1.75 : 1.15,
          strokeDasharray: active ? undefined : DASH[data.kind],
          transition: "stroke 250ms, stroke-width 250ms",
        }}
      />
      {active && (
        <path
          d={path}
          fill="none"
          stroke={data.visual === "dependent" ? "#ede9fe" : "#e0f7ff"}
          strokeOpacity={0.85}
          strokeWidth={1.75}
          strokeLinecap="round"
          className="edge-flow"
          style={{ animationDirection: data.reverse ? "reverse" : "normal" }}
        />
      )}
    </>
  );
}

export const DependencyEdge = memo(DependencyEdgeComponent);
