import {
  Activity,
  Boxes,
  Braces,
  Cog,
  Component,
  Database,
  FileCode2,
  Filter,
  FlaskConical,
  Globe,
  Layers,
  LayoutTemplate,
  Loader,
  Palette,
  Route,
  Settings,
  Shield,
  Tags,
  Waypoints,
  Workflow,
  Wrench,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { roleColor } from "@/lib/graph/role-style";
import { UNCLASSIFIED, type RailKey, type Role } from "@/lib/roles";

const ICONS: Record<Role, LucideIcon> = {
  "page-route": Route,
  layout: LayoutTemplate,
  "route-ui": Loader,
  metadata: Tags,
  "api-endpoint": Globe,
  "server-action": Zap,
  router: Route,
  controller: Globe,
  resolver: Globe,
  gateway: Globe,
  hook: Waypoints,
  entity: Database,
  model: Database,
  dto: Braces,
  util: Wrench,
  service: Cog,
  repository: Database,
  module: Boxes,
  config: Settings,
  middleware: Layers,
  guard: Shield,
  interceptor: Filter,
  pipe: Workflow,
  filter: Filter,
  instrumentation: Activity,
  "theme-override": Palette,
  component: Component,
  test: FlaskConical,
};

export function RoleIcon({ role, size = "md", className }: { role: RailKey; size?: "xs" | "sm" | "md" | "lg"; className?: string }) {
  const Icon = role === UNCLASSIFIED ? FileCode2 : ICONS[role];
  const color = roleColor(role);
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center",
        size === "xs" && "size-4 rounded-[4px]",
        size === "sm" && "size-5 rounded-md",
        size === "md" && "size-7 rounded-lg",
        size === "lg" && "size-9 rounded-xl",
        className,
      )}
      style={{ backgroundColor: `${color}26`, color, boxShadow: `inset 0 0 0 1px ${color}40` }}
      aria-hidden
    >
      <Icon className={cn(size === "xs" ? "size-2.5" : size === "sm" ? "size-3" : size === "md" ? "size-3.5" : "size-4")} strokeWidth={2.2} />
    </span>
  );
}

export function RoleDot({ role, on = true, className }: { role: RailKey; on?: boolean; className?: string }) {
  const color = roleColor(role);
  return (
    <span
      className={cn("inline-block size-2 shrink-0 rounded-full transition", className)}
      style={{ backgroundColor: on ? color : "transparent", boxShadow: `inset 0 0 0 1.5px ${color}` }}
      aria-hidden
    />
  );
}
