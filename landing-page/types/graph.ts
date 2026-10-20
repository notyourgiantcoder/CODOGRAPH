export type ModuleCategory =
  | "route"
  | "api"
  | "hook"
  | "type"
  | "utility"
  | "component";

/**
 * How one module depends on another.
 * - `import`: a value import (`import { x } from "..."`)
 * - `type`: a type-only import (`import type { X } from "..."`)
 * - `fetch`: a network call to an API route (`fetch("/api/...")`)
 */
export type DependencyKind = "import" | "type" | "fetch";

export interface DependencyRef {
  target: string;
  kind: DependencyKind;
  /** Imported symbols. Defaults to the target's primary export. */
  symbols?: string[];
}

export interface RepoFile {
  id: string;
  path: string;
  category: ModuleCategory;
  description: string;
  /** Plain-language explanation used by the simulated assistant. */
  summary: string;
  exports: string[];
  imports: DependencyRef[];
  /** Synthetic cyclomatic-style complexity score. */
  complexity: number;
  loc: number;
  /** Graph layer (row) and column, for the hand-tuned layout. */
  layer: number;
  col: number;
  /** Phrases the assistant can use to resolve this file from free text. */
  aliases: string[];
  /** Illustrative body; import lines are generated from `imports`. */
  body: string;
}

export interface Dependency {
  id: string;
  source: string;
  target: string;
  kind: DependencyKind;
  symbols: string[];
}

export type ImpactMode = "direct" | "downstream" | "upstream";

export interface ImpactResult {
  origin: string;
  mode: ImpactMode;
  /** Affected file id -> hop distance from origin. Excludes the origin itself. */
  depths: Map<string, number>;
  /** Edge ids traversed while discovering affected files. */
  edges: Set<string>;
  /** Files in discovery order (BFS). */
  order: string[];
  maxDepth: number;
  /** One representative longest chain, origin first. */
  longestChain: string[];
}
