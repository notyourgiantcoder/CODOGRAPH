"use client";

import { Handle, Position, useUpdateNodeInternals, type Node, type NodeProps } from "@xyflow/react";
import { CornerUpRight, Folder, FolderOpen } from "lucide-react";
import { createContext, memo, useContext, useEffect, useRef, type WheelEvent } from "react";
import { cn } from "@/lib/cn";
import { endpointKey, type Highlight, type Selection } from "@/lib/graph/highlight";
import { ABOVE_HANDLE, BELOW_HANDLE, MAX_ROWS, type FoldedObject, type PanelObject } from "@/lib/graph/view";
import { UNCLASSIFIED, type RailKey } from "@/lib/roles";
import { RoleIcon } from "@/components/ui/role-icon";
import { PANEL_HEADER_HEIGHT, PAD_X, ROW_HEIGHT } from "./layout";

export type FoldedNode = Node<FoldedObject, "folded">;
export type PanelNode = Node<PanelObject, "panel">;

// Actions and selection come through context rather than node data, so node
// data stays the plain view object and React Flow never diffs a fresh closure.
// Opening a folded node isn't here: it goes through React Flow's onNodeClick
// (see the map), because a node that's neither draggable nor selectable only
// receives pointer events when that handler exists.
export const MapActions = createContext<{
  close: (id: string) => void;
  selectFile: (path: string) => void;
  /** Move a panel's window by this many rows; the view clamps it. */
  scroll: (id: string, offset: number) => void;
  /** Reports what the pointer is over, so the inspector can mark it too. */
  hover: (hover: Selection) => void;
}>({ close: () => {}, selectFile: () => {}, scroll: () => {}, hover: () => {} });

export const MapSelection = createContext<{
  selection: Selection;
  /** What the selection, or failing that the pointer, leaves bright. */
  highlight: Highlight | null;
  /** Endpoint key of what's hovered, here or in the inspector. */
  hovered: string | null;
  /** Every file's rail category, for its row icon. */
  roles: ReadonlyMap<string, RailKey>;
  /** Whether the entrance has played, so nodes only animate in once. */
  settled: boolean;
}>({ selection: null, highlight: null, hovered: null, roles: new Map(), settled: true });

type Visual = "default" | "hovered" | "selected" | "dependent" | "dependency" | "dimmed";

// The landing page's node states, one class list each.
const SHELL: Record<Visual, string> = {
  default: "border-line-strong bg-panel-2",
  hovered: "border-ink/30 bg-panel-3",
  selected: "border-violet bg-panel-2 shadow-[0_0_0_3px_rgba(139,92,246,0.25),0_0_36px_-6px_rgba(139,92,246,0.7)]",
  dependent: "border-violet-soft/55 bg-tint-violet",
  dependency: "border-cyan/55 bg-tint-cyan",
  dimmed: "border-line bg-panel-2 opacity-40",
};

function visualOf(key: string, highlight: Highlight | null, hovered: boolean, selected: boolean): Visual {
  if (selected) return "selected";
  if (hovered) return "hovered";
  if (!highlight) return "default";
  if (highlight.dependents.has(key)) return "dependent";
  if (highlight.dependencies.has(key)) return "dependency";
  return highlight.endpoints.has(key) ? "default" : "dimmed";
}

// Handles are invisible anchors: an edge ends at the box or row, not at a dot.
const anchor = "!size-px !min-h-0 !min-w-0 !border-0 !bg-transparent";

const SIDES = [
  ["top", Position.Top],
  ["bottom", Position.Bottom],
  ["left", Position.Left],
  ["right", Position.Right],
] as const;

/** A box can be reached from any side; the map picks the side facing the other end (see sideHandles). */
function SideHandles() {
  return (
    <>
      {SIDES.map(([side, position]) => (
        <Handle key={`s-${side}`} id={`s-${side}`} type="source" position={position} className={anchor} isConnectable={false} />
      ))}
      {SIDES.map(([side, position]) => (
        <Handle key={`t-${side}`} id={`t-${side}`} type="target" position={position} className={anchor} isConnectable={false} />
      ))}
    </>
  );
}

/** A row can be reached from either side, for the same reason. */
function RowHandles({ id }: { id: string }) {
  return (
    <>
      <Handle id={`${id}|s-left`} type="source" position={Position.Left} className={anchor} isConnectable={false} />
      <Handle id={`${id}|s-right`} type="source" position={Position.Right} className={anchor} isConnectable={false} />
      <Handle id={`${id}|t-left`} type="target" position={Position.Left} className={anchor} isConnectable={false} />
      <Handle id={`${id}|t-right`} type="target" position={Position.Right} className={anchor} isConnectable={false} />
    </>
  );
}

// Everything inside a node is sized in px, never rem: the layout boxes are px,
// so rem spacing in here would overflow the box it was laid out for.

function FoldedNodeComponent({ id, data }: NodeProps<FoldedNode>) {
  const { hover } = useContext(MapActions);
  const { selection, highlight, hovered, settled } = useContext(MapSelection);
  const key = endpointKey(id, null);
  const visual = visualOf(key, highlight, hovered === key, selection?.kind === "group" && selection.id === id);
  // An outside box is somewhere else in the repository: dashed, and counted
  // by how many of its files the folder in view is linked to.
  const outside = data.outside;
  return (
    <div className={cn("size-full", !settled && "animate-node-in")}>
      <div
        title={`${data.dir === "." ? "the repository root" : data.dir} — click to ${outside ? "go there" : "go inside"}`}
        onMouseEnter={() => hover({ kind: "group", id })}
        onMouseLeave={() => hover(null)}
        className={cn(
          "relative flex size-full cursor-pointer items-center gap-2.5 rounded-[10px] border transition-[opacity,border-color,box-shadow,background-color] duration-300",
          SHELL[visual],
          outside && "border-dashed",
          outside && visual === "default" && "bg-transparent",
        )}
        style={{ paddingInline: PAD_X }}
      >
        <SideHandles />
        <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-lg bg-ink/[0.05] text-muted shadow-[inset_0_0_0_1px_var(--line-strong)]">
          {outside ? <CornerUpRight className="size-3.5" aria-hidden /> : <Folder className="size-3.5" aria-hidden />}
        </span>
        <div className="min-w-0 flex-1 leading-tight">
          <div className={cn("truncate text-[12.5px] font-medium", outside ? "text-muted" : "text-fg")}>{data.label}</div>
          <Meta fileCount={data.fileCount} fanIn={data.fanIn} fanOut={data.fanOut} linked={outside} />
        </div>
      </div>
    </div>
  );
}

export const FoldedNodeView = memo(FoldedNodeComponent);

function PanelNodeComponent({ id, data }: NodeProps<PanelNode>) {
  const { close, selectFile, scroll, hover } = useContext(MapActions);
  const { selection, highlight, hovered, roles } = useContext(MapSelection);
  const selected = selection?.kind === "group" && selection.id === id;
  // Whole means every row stays bright: nothing is highlighted, or this panel is.
  const whole = highlight === null || highlight.objects.has(id);
  const rowVisual = (handle: string, isSelected: boolean): Visual => {
    const key = endpointKey(id, handle);
    if (isSelected) return "selected";
    if (hovered === key) return "hovered";
    if (whole) return "default";
    return visualOf(key, highlight, false, false);
  };
  const anyLit = whole || data.rows.some((r) => rowVisual(r.path, false) !== "dimmed");

  // Wheel deltas arrive in pixels from trackpads and in lines from some mice;
  // they add up until they make a whole row, so slow scrolling still moves.
  const pending = useRef(0);
  // React Flow measures handles when a node resizes. Scrolling swaps rows at a
  // fixed size, so the new rows' handles have to be measured explicitly or
  // their edges have nothing to attach to.
  const updateNodeInternals = useUpdateNodeInternals();
  useEffect(() => updateNodeInternals(id), [id, data.offset, updateNodeInternals]);
  function onWheel(event: WheelEvent) {
    if (!data.scrolls) return;
    pending.current += event.deltaMode === 1 ? event.deltaY * ROW_HEIGHT : event.deltaY;
    const rows = Math.trunc(pending.current / ROW_HEIGHT);
    if (rows === 0) return;
    pending.current -= rows * ROW_HEIGHT;
    scroll(id, data.offset + rows);
  }

  return (
    <div
      className={cn(
        "flex size-full flex-col overflow-hidden rounded-[12px] border bg-panel shadow-xl shadow-black/20 transition-[opacity,border-color,box-shadow] duration-300",
        selected ? "border-violet shadow-[0_0_0_3px_rgba(139,92,246,0.25),0_0_36px_-6px_rgba(139,92,246,0.7)]" : "border-line-strong",
        !anyLit && "opacity-40",
      )}
    >
      <button
        type="button"
        onClick={() => close(id)}
        onMouseEnter={() => hover({ kind: "group", id })}
        onMouseLeave={() => hover(null)}
        title={`${data.dir === "." ? "the repository root" : data.dir} — click to inspect the folder`}
        className="group/header flex shrink-0 items-center gap-2.5 border-b border-line bg-panel-2 text-left transition hover:bg-panel-3"
        style={{ height: PANEL_HEADER_HEIGHT, paddingInline: PAD_X }}
      >
        <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-lg bg-violet/15 text-violet-soft shadow-[inset_0_0_0_1px_rgba(139,92,246,0.35)]">
          <FolderOpen className="size-3.5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1 leading-tight">
          <div className="truncate text-[12.5px] font-semibold text-fg">{data.label}</div>
          <Meta fileCount={data.fileCount} fanIn={data.fanIn} fanOut={data.fanOut} />
        </div>
      </button>
      {/* nowheel: the wheel scrolls the rows here instead of zooming the map. */}
      <ul className={data.scrolls ? "nowheel" : undefined} onWheel={onWheel}>
        {data.scrolls && (
          <OffscreenRow
            handle={ABOVE_HANDLE}
            count={data.above}
            label="above"
            visual={rowVisual(ABOVE_HANDLE, false)}
            onClick={() => scroll(id, data.offset - MAX_ROWS)}
          />
        )}
        {data.rows.map((row) => {
          const rowSelected = selection?.kind === "file" && selection.path === row.path;
          const visual = rowVisual(row.path, rowSelected);
          return (
            <li key={row.path} className="relative" style={{ height: ROW_HEIGHT }}>
              <RowHandles id={row.path} />
              <button
                type="button"
                onClick={() => selectFile(row.path)}
                onMouseEnter={() => hover({ kind: "file", path: row.path })}
                onMouseLeave={() => hover(null)}
                title={row.path}
                aria-pressed={rowSelected}
                className={cn(
                  "relative flex size-full items-center gap-2 text-left text-[11.5px] transition-colors",
                  visual === "selected" && "bg-violet/[0.14] text-fg",
                  visual === "hovered" && "bg-ink/[0.06] text-fg",
                  visual === "dependent" && "bg-tint-violet text-fg",
                  visual === "dependency" && "bg-tint-cyan text-fg",
                  visual === "default" && "text-fg/90 hover:bg-ink/[0.04]",
                  visual === "dimmed" && "text-muted opacity-40",
                )}
                style={{ paddingInline: PAD_X }}
              >
                {visual === "selected" && <span className="absolute inset-y-1 left-0 w-0.5 rounded-full bg-violet" />}
                {visual === "dependent" && <span className="absolute inset-y-1 left-0 w-0.5 rounded-full bg-violet-soft" />}
                {visual === "dependency" && <span className="absolute inset-y-1 left-0 w-0.5 rounded-full bg-cyan" />}
                <RoleIcon role={roles.get(row.path) ?? UNCLASSIFIED} size="xs" />
                <span className="min-w-0 flex-1 truncate font-mono">{row.label}</span>
                <Fan fanIn={row.fanIn} fanOut={row.fanOut} />
              </button>
            </li>
          );
        })}
        {data.scrolls && (
          <OffscreenRow
            handle={BELOW_HANDLE}
            count={data.below}
            label="below"
            visual={rowVisual(BELOW_HANDLE, false)}
            onClick={() => scroll(id, data.offset + MAX_ROWS)}
          />
        )}
      </ul>
    </div>
  );
}

export const PanelNodeView = memo(PanelNodeComponent);

// Stands for the files scrolled out of the window on one side. Edges to those
// files end here, so they stay attached to the panel rather than vanishing.
// Clicking pages the window that way.
function OffscreenRow(props: { handle: string; count: number; label: string; visual: Visual; onClick: () => void }) {
  return (
    <li className="relative" style={{ height: ROW_HEIGHT }}>
      <RowHandles id={props.handle} />
      <button
        type="button"
        onClick={props.onClick}
        disabled={props.count === 0}
        className={cn(
          "flex size-full items-center text-left font-mono text-[10.5px] text-subtle tabular-nums transition enabled:hover:bg-ink/[0.04] enabled:hover:text-fg disabled:opacity-50",
          props.visual === "dependent" && "bg-tint-violet",
          props.visual === "dependency" && "bg-tint-cyan",
          props.visual === "dimmed" && "opacity-40",
        )}
        style={{ paddingInline: PAD_X }}
      >
        {props.count} {props.count === 1 ? "file" : "files"} {props.label}
      </button>
    </li>
  );
}

function Meta({ fileCount, fanIn, fanOut, linked = false }: { fileCount: number; fanIn: number; fanOut: number; linked?: boolean }) {
  return (
    <span className="flex items-center gap-2 font-mono text-[10px] text-subtle tabular-nums">
      <span>{`${fileCount.toLocaleString("en")} ${linked ? "linked " : ""}${fileCount === 1 ? "file" : "files"}`}</span>
      <Fan fanIn={fanIn} fanOut={fanOut} />
    </span>
  );
}

// Violet for what flows in, cyan for what flows out: the only two colours
// direction ever gets.
function Fan({ fanIn, fanOut }: { fanIn: number; fanOut: number }) {
  return (
    <span className="flex shrink-0 items-center gap-1.5 font-mono text-[10px] tabular-nums">
      <span className="text-violet-soft" title="Distinct files that import this">
        ←{fanIn}
      </span>
      <span className="text-cyan" title="Distinct files this imports">
        {fanOut}→
      </span>
    </span>
  );
}
