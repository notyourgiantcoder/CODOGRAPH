import type { DependencyKind, ModuleCategory } from "@/types/graph";

export interface CategoryMeta {
  id: ModuleCategory;
  label: string;
  plural: string;
  /** Categorical slot colour, validated for CVD separation on the dark panel surface. */
  color: string;
}

/**
 * Fixed order matters: it is the order the palette was validated in, and every
 * legend, filter row and chart uses it so colours never get reassigned.
 */
export const CATEGORIES: CategoryMeta[] = [
  { id: "route", label: "Route", plural: "Routes", color: "#3987e5" },
  { id: "api", label: "API", plural: "APIs", color: "#d95926" },
  { id: "hook", label: "Hook", plural: "Hooks", color: "#199e70" },
  { id: "type", label: "Type", plural: "Types", color: "#c98500" },
  { id: "utility", label: "Utility", plural: "Utilities", color: "#d55181" },
  { id: "component", label: "Component", plural: "Components", color: "#9085e9" },
];

export const CATEGORY_META = Object.fromEntries(CATEGORIES.map((c) => [c.id, c])) as Record<
  ModuleCategory,
  CategoryMeta
>;

export const ALL_CATEGORIES = CATEGORIES.map((c) => c.id);

export const EDGE_KIND_META: Record<DependencyKind, { label: string; verb: string; description: string }> = {
  import: { label: "Import", verb: "imports", description: "Value import" },
  type: { label: "Type import", verb: "uses types from", description: "Type-only import, erased at runtime" },
  fetch: { label: "Network call", verb: "calls", description: "HTTP request to an API route" },
};

/** Ordinal ramp for complexity buckets (low → very high), validated with --ordinal. */
export const COMPLEXITY_BUCKETS = [
  { id: "low", label: "Low", range: "1–4", min: 1, max: 4, color: "#5b3bbf" },
  { id: "moderate", label: "Moderate", range: "5–8", min: 5, max: 8, color: "#7c5ce6" },
  { id: "high", label: "High", range: "9–12", min: 9, max: 12, color: "#a48cf2" },
  { id: "very-high", label: "Very high", range: "13+", min: 13, max: Infinity, color: "#c8b8fa" },
] as const;

export type ComplexityBucketId = (typeof COMPLEXITY_BUCKETS)[number]["id"];

export function complexityBucket(score: number) {
  return COMPLEXITY_BUCKETS.find((b) => score >= b.min && score <= b.max) ?? COMPLEXITY_BUCKETS[0];
}

/** Series colours for incoming vs outgoing counts (validated pair). */
export const FLOW_COLORS = { incoming: "#8B5CF6", outgoing: "#2A9DCC" } as const;
