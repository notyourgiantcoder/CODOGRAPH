"use client";

import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { memo } from "react";
import { CategoryIcon } from "@/components/graph/CategoryIcon";
import { NODE_H, NODE_W } from "@/components/graph/layout";
import { cn } from "@/lib/cn";
import { directoryOf, displayName, getFile } from "@/lib/graph";

export type NodeVisual =
  | "default"
  | "hovered"
  | "dependency"
  | "dependent"
  | "dimmed"
  | "origin"
  | "impacted"
  | "pending";

export type FileNodeData = {
  fileId: string;
  visual: NodeVisual;
  selected: boolean;
  depth?: number;
  enterDelay: number;
};

export type FileNodeType = Node<FileNodeData, "file">;

function FileNodeComponent({ data }: NodeProps<FileNodeType>) {
  const file = getFile(data.fileId);
  const { visual, selected } = data;
  const dir = directoryOf(file.id);

  return (
    <div
      className="animate-node-in"
      style={{ animationDelay: `${data.enterDelay}ms`, width: NODE_W, height: NODE_H }}
    >
      <div
        className={cn(
          "relative flex h-full items-center gap-2.5 rounded-[10px] border bg-panel-2 px-2.5 transition-[opacity,border-color,box-shadow,background-color] duration-300",
          visual === "default" && "border-line-strong",
          visual === "hovered" && "border-white/30 bg-panel-3",
          visual === "dependency" && "border-cyan/55 bg-[#13202a]",
          visual === "dependent" && "border-violet-soft/55 bg-[#1b1728]",
          visual === "dimmed" && "border-line opacity-40",
          visual === "pending" && "border-line opacity-30",
          visual === "impacted" && "animate-pop border-cyan/60 bg-[#0f2029] shadow-[0_0_24px_-6px_rgba(103,213,255,0.55)]",
          visual === "origin" && "border-cyan bg-[#0f2029] shadow-[0_0_0_3px_rgba(103,213,255,0.18),0_0_40px_-4px_rgba(103,213,255,0.6)]",
          selected &&
            visual !== "origin" &&
            "border-violet shadow-[0_0_0_3px_rgba(139,92,246,0.25),0_0_36px_-6px_rgba(139,92,246,0.7)]",
        )}
      >
        {visual === "origin" && (
          <span className="pointer-events-none absolute inset-0 animate-pulse-ring rounded-[10px] border border-cyan/70" />
        )}
        <CategoryIcon category={file.category} />
        <div className="min-w-0 flex-1 leading-tight">
          <div className="truncate text-[12.5px] font-medium text-fg">{displayName(file.id)}</div>
          <div className="truncate font-mono text-[10px] text-subtle">{dir || "/"}</div>
        </div>
        {visual === "impacted" && data.depth !== undefined && (
          <span className="rounded bg-cyan/15 px-1 font-mono text-[9.5px] font-semibold text-cyan">
            {data.depth}
          </span>
        )}
        {visual === "origin" && (
          <span className="rounded bg-cyan px-1 font-mono text-[9.5px] font-semibold text-bg">0</span>
        )}
      </div>

      <Handle id="t-top" type="target" position={Position.Top} isConnectable={false} />
      <Handle id="t-bottom" type="target" position={Position.Bottom} isConnectable={false} />
      <Handle id="t-left" type="target" position={Position.Left} isConnectable={false} />
      <Handle id="t-right" type="target" position={Position.Right} isConnectable={false} />
      <Handle id="s-bottom" type="source" position={Position.Bottom} isConnectable={false} />
      <Handle id="s-top" type="source" position={Position.Top} isConnectable={false} />
      <Handle id="s-left" type="source" position={Position.Left} isConnectable={false} />
      <Handle id="s-right" type="source" position={Position.Right} isConnectable={false} />
    </div>
  );
}

export const FileNode = memo(FileNodeComponent);
