"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  type ReactNode,
} from "react";
import { FILES } from "@/data/repository";
import { ALL_CATEGORIES } from "@/lib/categories";
import { analyzeImpact } from "@/lib/graph";
import { usePrefersReducedMotion } from "@/lib/useMediaQuery";
import type { ImpactMode, ImpactResult, ModuleCategory } from "@/types/graph";

export type InspectorTab = "overview" | "dependencies" | "dependents" | "code" | "impact";

interface ImpactState {
  result: ImpactResult;
  /** How many affected files (in BFS order) have been revealed so far. */
  revealed: number;
}

interface DemoState {
  selectedId: string | null;
  categories: ModuleCategory[];
  showTypeEdges: boolean;
  impactMode: ImpactMode;
  impact: ImpactState | null;
  tab: InspectorTab;
  /** Bumped to ask the graph to move its camera. */
  camera: { kind: "focus" | "fit" | "impact"; nonce: number } | null;
}

type Action =
  | { type: "select"; id: string | null; focus?: boolean }
  | { type: "toggleCategory"; category: ModuleCategory }
  | { type: "setCategories"; categories: ModuleCategory[] }
  | { type: "toggleTypeEdges" }
  | { type: "setImpactMode"; mode: ImpactMode }
  | { type: "runImpact"; id: string; mode: ImpactMode; instant: boolean }
  | { type: "revealMore" }
  | { type: "clearImpact" }
  | { type: "setTab"; tab: InspectorTab }
  | { type: "fit" }
  | { type: "reset"; initial: DemoState };

let nonce = 0;
const camera = (kind: "focus" | "fit" | "impact") => ({ kind, nonce: ++nonce });

function reducer(state: DemoState, action: Action): DemoState {
  switch (action.type) {
    case "select":
      return {
        ...state,
        selectedId: action.id,
        camera: action.focus && action.id ? camera("focus") : state.camera,
      };
    case "toggleCategory": {
      const has = state.categories.includes(action.category);
      const categories = has
        ? state.categories.filter((c) => c !== action.category)
        : ALL_CATEGORIES.filter((c) => c === action.category || state.categories.includes(c));
      return { ...state, categories };
    }
    case "setCategories":
      return { ...state, categories: action.categories };
    case "toggleTypeEdges":
      return { ...state, showTypeEdges: !state.showTypeEdges };
    case "setImpactMode":
      return { ...state, impactMode: action.mode };
    case "runImpact": {
      const result = analyzeImpact(action.id, action.mode);
      return {
        ...state,
        selectedId: action.id,
        impactMode: action.mode,
        impact: { result, revealed: action.instant ? result.order.length : 0 },
        camera: camera("impact"),
      };
    }
    case "revealMore":
      if (!state.impact) return state;
      return {
        ...state,
        impact: {
          ...state.impact,
          revealed: Math.min(state.impact.revealed + 1, state.impact.result.order.length),
        },
      };
    case "clearImpact":
      return { ...state, impact: null };
    case "setTab":
      return { ...state, tab: action.tab };
    case "fit":
      return { ...state, camera: camera("fit") };
    case "reset":
      return { ...action.initial, camera: camera("fit") };
  }
}

export interface DemoContextValue extends DemoState {
  visibleIds: string[];
  isRevealing: boolean;
  select: (id: string | null, options?: { focus?: boolean }) => void;
  toggleCategory: (category: ModuleCategory) => void;
  setCategories: (categories: ModuleCategory[]) => void;
  toggleTypeEdges: () => void;
  setImpactMode: (mode: ImpactMode) => void;
  runImpact: (id: string, mode?: ImpactMode) => void;
  clearImpact: () => void;
  setTab: (tab: InspectorTab) => void;
  fitView: () => void;
  reset: () => void;
}

const DemoContext = createContext<DemoContextValue | null>(null);

export function DemoProvider({
  children,
  initialSelected = null,
  initialTab = "overview",
}: {
  children: ReactNode;
  initialSelected?: string | null;
  initialTab?: InspectorTab;
}) {
  const reduceMotion = usePrefersReducedMotion();
  const initial = useMemo<DemoState>(
    () => ({
      selectedId: initialSelected,
      categories: ALL_CATEGORIES,
      showTypeEdges: true,
      impactMode: "downstream",
      impact: null,
      tab: initialTab,
      camera: null,
    }),
    [initialSelected, initialTab],
  );
  const [state, dispatch] = useReducer(reducer, initial);

  // Reveal affected files one by one so the traversal reads as a discovery.
  const total = state.impact?.result.order.length ?? 0;
  const revealed = state.impact?.revealed ?? 0;
  useEffect(() => {
    if (!state.impact || revealed >= total) return;
    const step = Math.max(28, Math.min(110, 1400 / total));
    const id = window.setTimeout(() => dispatch({ type: "revealMore" }), revealed === 0 ? 260 : step);
    return () => window.clearTimeout(id);
  }, [state.impact, revealed, total]);

  const select = useCallback(
    (id: string | null, options?: { focus?: boolean }) => dispatch({ type: "select", id, focus: options?.focus }),
    [],
  );
  const toggleCategory = useCallback((category: ModuleCategory) => dispatch({ type: "toggleCategory", category }), []);
  const setCategories = useCallback(
    (categories: ModuleCategory[]) => dispatch({ type: "setCategories", categories }),
    [],
  );
  const toggleTypeEdges = useCallback(() => dispatch({ type: "toggleTypeEdges" }), []);
  const setImpactMode = useCallback((mode: ImpactMode) => dispatch({ type: "setImpactMode", mode }), []);
  const runImpact = useCallback(
    (id: string, mode?: ImpactMode) =>
      dispatch({ type: "runImpact", id, mode: mode ?? state.impactMode, instant: !!reduceMotion }),
    [state.impactMode, reduceMotion],
  );
  const clearImpact = useCallback(() => dispatch({ type: "clearImpact" }), []);
  const setTab = useCallback((tab: InspectorTab) => dispatch({ type: "setTab", tab }), []);
  const fitView = useCallback(() => dispatch({ type: "fit" }), []);
  const reset = useCallback(() => dispatch({ type: "reset", initial }), [initial]);

  const visibleIds = useMemo(
    () => FILES.filter((f) => state.categories.includes(f.category)).map((f) => f.id),
    [state.categories],
  );

  const value = useMemo<DemoContextValue>(
    () => ({
      ...state,
      visibleIds,
      isRevealing: !!state.impact && revealed < total,
      select,
      toggleCategory,
      setCategories,
      toggleTypeEdges,
      setImpactMode,
      runImpact,
      clearImpact,
      setTab,
      fitView,
      reset,
    }),
    [
      state,
      visibleIds,
      revealed,
      total,
      select,
      toggleCategory,
      setCategories,
      toggleTypeEdges,
      setImpactMode,
      runImpact,
      clearImpact,
      setTab,
      fitView,
      reset,
    ],
  );

  return <DemoContext.Provider value={value}>{children}</DemoContext.Provider>;
}

export function useDemo() {
  const ctx = useContext(DemoContext);
  if (!ctx) throw new Error("useDemo must be used inside <DemoProvider>");
  return ctx;
}

/** Revealed affected files -> hop depth, respecting the staged reveal animation. */
export function useRevealedImpact() {
  const { impact } = useDemo();
  return useMemo(() => {
    if (!impact) return null;
    const ids = impact.result.order.slice(0, impact.revealed);
    const depths = new Map(ids.map((id) => [id, impact.result.depths.get(id)!]));
    return { ...impact.result, revealedIds: new Set(ids), revealedDepths: depths, revealed: impact.revealed };
  }, [impact]);
}
