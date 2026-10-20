import { Braces, Component, Globe, Route, Waypoints, Wrench, type LucideIcon } from "lucide-react";
import { CATEGORY_META } from "@/lib/categories";
import { cn } from "@/lib/cn";
import type { ModuleCategory } from "@/types/graph";

export const CATEGORY_ICONS: Record<ModuleCategory, LucideIcon> = {
  route: Route,
  api: Globe,
  hook: Waypoints,
  type: Braces,
  utility: Wrench,
  component: Component,
};

export function CategoryIcon({
  category,
  size = "md",
  className,
}: {
  category: ModuleCategory;
  size?: "xs" | "sm" | "md";
  className?: string;
}) {
  const Icon = CATEGORY_ICONS[category];
  const color = CATEGORY_META[category].color;
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-md",
        size === "xs" && "size-4 rounded-[4px]",
        size === "sm" && "size-5",
        size === "md" && "size-7 rounded-lg",
        className,
      )}
      style={{ backgroundColor: `${color}26`, color, boxShadow: `inset 0 0 0 1px ${color}40` }}
      aria-hidden
    >
      <Icon className={cn(size === "xs" ? "size-2.5" : size === "sm" ? "size-3" : "size-3.5")} strokeWidth={2.2} />
    </span>
  );
}

export function CategoryDot({ category, className }: { category: ModuleCategory; className?: string }) {
  return (
    <span
      className={cn("inline-block size-2 shrink-0 rounded-full", className)}
      style={{ backgroundColor: CATEGORY_META[category].color }}
      aria-hidden
    />
  );
}
