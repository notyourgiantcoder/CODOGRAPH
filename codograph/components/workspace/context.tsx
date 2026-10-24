"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import {
  explainFileAction,
  explainFolderAction,
  fileAtHeadAction,
  repositoryHeadAction,
  type HeadResult,
} from "@/app/(workspace)/analyses/[id]/actions";
import { targetKey, type ExplainTarget, type ExplanationState, type Freshness } from "@/components/explanation-panel";
import type { Camera } from "@/components/map/dependency-map";
import type { Selection } from "@/lib/graph/highlight";
import { FULL_MAP_FILES, landing, scopeFolding, type Scoped } from "@/lib/graph/scope";
import { groupId, MAX_ROWS, rankGroupFiles } from "@/lib/graph/view";
import { displayNames } from "@/lib/graph/workspace";
import type { Coverage, Edge, MapFile, Project, Route } from "@/lib/parser/types";
import { railCategories, UNCLASSIFIED, type ModelRole, type RailKey } from "@/lib/roles";

export type InspectorTab = "overview" | "dependencies" | "dependents" | "code";

/** What the middle of the workspace shows: the map, one file's neighbourhood, or the route table. */
export type Centre = "map" | "focus" | "routes";

/** What the summary says about the repository that isn't in the file and edge lists. */
export type RepositoryFacts = {
  owner: string;
  name: string;
  /** The root first, then every package.json folder, each with the adapter that detected it. */
  projects: Project[];
  skipped: number;
  unresolved: number;
  fetches: Coverage["fetches"];
};

type Data = {
  analysisId: string;
  commitSha: string;
  repository: RepositoryFacts;
  files: MapFile[];
  byPath: ReadonlyMap<string, MapFile>;
  /** Every edge, whatever the type-only toggle says. */
  edges: Edge[];
  routes: Route[];
  routeCoverage: Coverage["routes"];
  /** Each file's rail category: convention's role, else the model's, else unclassified. */
  roles: ReadonlyMap<string, RailKey>;
  /** The rail's categories for this repository, each with its count. */
  categories: { key: RailKey; count: number }[];
  names: ReadonlyMap<string, string>;
  modelRoles: ReadonlyMap<string, ModelRole>;
};

type State = {
  /** The folder the map shows. "." for the repository root. */
  scope: string;
  /** Every file not filtered off. */
  visibleFiles: MapFile[];
  /** Few enough files to draw every one; otherwise the map shows one folder at a time. */
  whole: boolean;
  /** The folder in view as groups: its subfolders, its own files, and the outside folders imports cross into. */
  folding: Scoped;
  /** Edges the map draws: shown edges with both ends on the map. */
  mapEdges: Edge[];
  /** The folder's own panel and how far it's scrolled; nothing else opens in place. */
  open: ReadonlyMap<string, number>;
  /** Draw every line rather than the strongest. */
  allLines: boolean;
  centre: Centre;
  selection: Selection;
  hover: Selection;
  camera: Camera;
  /** Categories switched off in the filter bar. */
  hiddenCategories: ReadonlySet<RailKey>;
  /** Files those categories cover. */
  hidden: ReadonlySet<string>;
  showTypeEdges: boolean;
  /** Edges the map draws: every edge, less type-only ones when they're switched off. */
  shownEdges: Edge[];
  tab: InspectorTab;
  explanations: ReadonlyMap<string, ExplanationState>;
  freshness: ReadonlyMap<string, Freshness>;
};

type Actions = {
  /** Select a file and bring it into view: the map goes to its folder, its row scrolls into the window, the camera moves to it. */
  reveal: (path: string) => void;
  toggleFile: (path: string) => void;
  /** Show this folder on the map, passing through any level with nothing but one subfolder. */
  goTo: (dir: string) => void;
  selectGroup: (dir: string) => void;
  scroll: (id: string, offset: number) => void;
  setHover: (hover: Selection) => void;
  deselect: () => void;
  toggleCategory: (key: RailKey) => void;
  showAllCategories: () => void;
  toggleTypeEdges: () => void;
  toggleAllLines: () => void;
  setCentre: (centre: Centre) => void;
  setTab: (tab: InspectorTab) => void;
  fit: () => void;
  reset: () => void;
  explain: (target: ExplainTarget) => void;
};

type Workspace = Data & State & Actions;

const WorkspaceContext = createContext<Workspace | null>(null);

export function useWorkspace(): Workspace {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspace must be used inside <WorkspaceProvider>");
  return ctx;
}

let cameraNonce = 0;

// Owns everything the toolbar, explorer, map and inspector share. Everything
// shown is derived from the parse output already in the browser, so nothing
// here makes a request except Explain and the Code tab.
export function WorkspaceProvider(props: {
  analysisId: string;
  commitSha: string;
  repository: RepositoryFacts;
  files: MapFile[];
  edges: Edge[];
  routes: Route[];
  routeCoverage: Coverage["routes"];
  /** Roles the model gave files no convention identified, by path. */
  modelRoles: Record<string, ModelRole>;
  children: ReactNode;
}) {
  const { files, edges, analysisId } = props;
  const byPath = useMemo(() => new Map(files.map((f) => [f.path, f])), [files]);
  const names = useMemo(() => displayNames(files.map((f) => f.path)), [files]);
  const [modelRoles, setModelRoles] = useState<ReadonlyMap<string, ModelRole>>(() => new Map(Object.entries(props.modelRoles)));
  const roles = useMemo(
    () => new Map<string, RailKey>(files.map((f) => [f.path, f.role ?? modelRoles.get(f.path) ?? UNCLASSIFIED])),
    [files, modelRoles],
  );
  const categories = useMemo(
    () => railCategories(props.repository.projects.map((p) => p.adapter), files.map((f) => f.role ?? modelRoles.get(f.path) ?? null)),
    [props.repository.projects, files, modelRoles],
  );

  // Tests start hidden: in a large repository they can be close to half the
  // files, and they're rarely where reading starts. The Tests chip shows them.
  const defaultHidden = useMemo<ReadonlySet<RailKey>>(() => new Set(files.some((f) => f.role === "test") ? ["test"] : []), [files]);
  const [hiddenCategories, setHiddenCategories] = useState<ReadonlySet<RailKey>>(defaultHidden);
  const [scope, setScope] = useState(() =>
    landing(
      files.filter((f) => !defaultHidden.has(f.role ?? UNCLASSIFIED)),
      ".",
    ),
  );
  const [offsets, setOffsets] = useState<ReadonlyMap<string, number>>(() => new Map());
  const [allLines, setAllLines] = useState(false);
  const [centre, setCentre] = useState<Centre>("map");
  const [selection, setSelection] = useState<Selection>(null);
  const [hover, setHover] = useState<Selection>(null);
  const [camera, setCamera] = useState<Camera>(null);
  const [showTypeEdges, setShowTypeEdges] = useState(true);
  const [tab, setTab] = useState<InspectorTab>("overview");
  // Explanations fetched on this page, by file or folder, so moving the
  // selection away and back finds the answer still there without asking again.
  const [explanations, setExplanations] = useState<ReadonlyMap<string, ExplanationState>>(() => new Map());
  const [freshness, setFreshness] = useState<ReadonlyMap<string, Freshness>>(() => new Map());
  // The repository's latest commit, asked for once per page load: GitHub's
  // unauthenticated API allows few requests, and one answer serves every file.
  const head = useRef<Promise<HeadResult> | null>(null);

  const hidden = useMemo(() => {
    if (hiddenCategories.size === 0) return new Set<string>();
    return new Set(files.filter((f) => hiddenCategories.has(roles.get(f.path) ?? UNCLASSIFIED)).map((f) => f.path));
  }, [files, roles, hiddenCategories]);
  const visibleFiles = useMemo(() => files.filter((f) => !hidden.has(f.path)), [files, hidden]);
  const whole = visibleFiles.length <= FULL_MAP_FILES;
  const shownEdges = useMemo(() => (showTypeEdges ? edges : edges.filter((e) => !e.typeOnly)), [edges, showTypeEdges]);
  const folding = useMemo(() => scopeFolding(visibleFiles, shownEdges, scope), [visibleFiles, shownEdges, scope]);
  const mapEdges = useMemo(
    () => shownEdges.filter((e) => folding.groupOf.has(e.source) && folding.groupOf.has(e.target)),
    [shownEdges, folding],
  );
  // Only the folder's own files open in place, as rows; every other box is a
  // way further in or out.
  const open = useMemo(() => {
    const id = groupId(scope);
    return folding.groups.some((g) => g.dir === scope) ? new Map([[id, offsets.get(id) ?? 0]]) : new Map<string, number>();
  }, [folding, scope, offsets]);

  const explain = useCallback(
    (target: ExplainTarget) => {
      const key = targetKey(target);
      setExplanations((prev) => new Map(prev).set(key, { status: "loading" }));
      setFreshness((prev) => new Map(prev).set(key, { status: "checking" }));

      void (async () => {
        const result = await (target.kind === "file" ? explainFileAction(analysisId, target.path) : explainFolderAction(analysisId, target.dir));
        setExplanations((prev) => new Map(prev).set(key, result.ok ? { status: "done", result } : { status: "error", error: result.error }));
        if (result.ok && target.kind === "file" && result.labelled?.role) {
          const role = result.labelled.role;
          setModelRoles((prev) => new Map(prev).set(target.path, role));
        }
      })();

      // Alongside the explanation, not in front of it: a cached answer shows
      // at once, and whether it's current arrives when GitHub answers.
      void (async () => {
        const latest = await (head.current ??= repositoryHeadAction(analysisId));
        if (!latest.ok) head.current = null;
        let state: Freshness;
        if (!latest.ok) state = { status: "unknown", error: latest.error };
        else if (latest.head === latest.analysed) state = { status: "current" };
        else if (target.kind === "group") state = { status: "moved", head: latest.head, file: null };
        else {
          const file = await fileAtHeadAction(analysisId, target.path, latest.head);
          state = file.ok ? { status: "moved", head: latest.head, file: file.state } : { status: "unknown", error: file.error };
        }
        setFreshness((prev) => new Map(prev).set(key, state));
      })();
    },
    [analysisId],
  );

  const goTo = useCallback(
    (dir: string) => {
      const target = landing(visibleFiles, dir);
      setScope(target);
      setOffsets(new Map());
      setCentre("map");
      // The inspector shows the folder that was just entered.
      setSelection({ kind: "group", id: groupId(target) });
      setHover(null);
      setCamera({ kind: "fit", nonce: ++cameraNonce });
    },
    [visibleFiles],
  );

  const toggleFile = useCallback((path: string) => {
    setSelection((prev) => (prev?.kind === "file" && prev.path === path ? null : { kind: "file", path }));
  }, []);

  const selectGroup = useCallback((dir: string) => {
    setSelection({ kind: "group", id: groupId(dir) });
  }, []);

  const scroll = useCallback((id: string, offset: number) => {
    setOffsets((prev) => new Map(prev).set(id, Math.max(0, offset)));
  }, []);

  const reveal = useCallback(
    (path: string) => {
      const file = byPath.get(path);
      if (!file) return;
      const role = roles.get(path) ?? UNCLASSIFIED;
      // A file picked while its category is filtered off brings the category back.
      const nowHidden = hiddenCategories.has(role) ? new Set([...hiddenCategories].filter((c) => c !== role)) : hiddenCategories;
      if (nowHidden !== hiddenCategories) setHiddenCategories(nowHidden);
      const visible = files.filter((f) => !nowHidden.has(roles.get(f.path) ?? UNCLASSIFIED));

      // The map goes to the file's own folder, where it's one of the rows.
      const target = file.module;
      const scoped = scopeFolding(visible, shownEdges, target);
      const group = scoped.groups.find((g) => g.dir === scoped.groupOf.get(path));
      const index = group ? rankGroupFiles(group, byPath).indexOf(path) : 0;
      setScope(target);
      setOffsets(new Map([[groupId(target), Math.max(0, index - Math.floor(MAX_ROWS / 2))]]));
      setSelection({ kind: "file", path });
      setCamera({ kind: "focus", path, nonce: ++cameraNonce });
      // The row under the pointer is about to be replaced, and a removed
      // element never reports the pointer leaving it.
      setHover(null);
    },
    [files, byPath, roles, hiddenCategories, shownEdges],
  );

  const deselect = useCallback(() => setSelection(null), []);

  const toggleCategory = useCallback((key: RailKey) => {
    setHiddenCategories((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);
  const showAllCategories = useCallback(() => setHiddenCategories(new Set()), []);
  const toggleTypeEdges = useCallback(() => setShowTypeEdges((v) => !v), []);
  const toggleAllLines = useCallback(() => setAllLines((v) => !v), []);
  const fit = useCallback(() => setCamera({ kind: "fit", nonce: ++cameraNonce }), []);
  const reset = useCallback(() => {
    setSelection(null);
    setHover(null);
    setHiddenCategories(defaultHidden);
    setScope(landing(files.filter((f) => !defaultHidden.has(f.role ?? UNCLASSIFIED)), "."));
    setOffsets(new Map());
    setShowTypeEdges(true);
    setAllLines(false);
    setCentre("map");
    setTab("overview");
    setCamera({ kind: "fit", nonce: ++cameraNonce });
  }, [defaultHidden, files]);

  const value = useMemo<Workspace>(
    () => ({
      analysisId,
      commitSha: props.commitSha,
      repository: props.repository,
      files,
      byPath,
      edges,
      routes: props.routes,
      routeCoverage: props.routeCoverage,
      roles,
      categories,
      names,
      modelRoles,
      scope,
      visibleFiles,
      whole,
      folding,
      mapEdges,
      open,
      allLines,
      centre,
      selection,
      hover,
      camera,
      hiddenCategories,
      hidden,
      showTypeEdges,
      shownEdges,
      tab,
      explanations,
      freshness,
      reveal,
      toggleFile,
      goTo,
      selectGroup,
      scroll,
      setHover,
      deselect,
      toggleCategory,
      showAllCategories,
      toggleTypeEdges,
      toggleAllLines,
      setCentre,
      setTab,
      fit,
      reset,
      explain,
    }),
    [
      analysisId,
      props.commitSha,
      props.repository,
      files,
      byPath,
      edges,
      props.routes,
      props.routeCoverage,
      roles,
      categories,
      names,
      modelRoles,
      scope,
      visibleFiles,
      whole,
      folding,
      mapEdges,
      open,
      allLines,
      centre,
      selection,
      hover,
      camera,
      hiddenCategories,
      hidden,
      showTypeEdges,
      shownEdges,
      tab,
      explanations,
      freshness,
      reveal,
      toggleFile,
      goTo,
      selectGroup,
      scroll,
      deselect,
      toggleCategory,
      showAllCategories,
      toggleTypeEdges,
      toggleAllLines,
      fit,
      reset,
      explain,
    ],
  );

  return <WorkspaceContext.Provider value={value}>{props.children}</WorkspaceContext.Provider>;
}
