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
import { foldDirectories, type Folding } from "@/lib/graph/fold";
import type { Selection } from "@/lib/graph/highlight";
import { clampOffset, groupId, MAX_ROWS, rankGroupFiles } from "@/lib/graph/view";
import { displayNames } from "@/lib/graph/workspace";
import type { Coverage, Edge, ParsedFile, Project, Route } from "@/lib/parser/types";
import { railCategories, UNCLASSIFIED, type ModelRole, type RailKey } from "@/lib/roles";

export type InspectorTab = "overview" | "dependencies" | "dependents" | "code";

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
  files: ParsedFile[];
  byPath: ReadonlyMap<string, ParsedFile>;
  /** Every edge, whatever the type-only toggle says. */
  edges: Edge[];
  routes: Route[];
  routeCoverage: Coverage["routes"];
  folding: Folding;
  /** Each file's rail category: convention's role, else the model's, else unclassified. */
  roles: ReadonlyMap<string, RailKey>;
  /** The rail's categories for this repository, each with its count. */
  categories: { key: RailKey; count: number }[];
  names: ReadonlyMap<string, string>;
  modelRoles: ReadonlyMap<string, ModelRole>;
};

type State = {
  selection: Selection;
  hover: Selection;
  open: ReadonlyMap<string, number>;
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
  /** Select a file and bring it into view: its folder opens, its row scrolls into the window, the camera moves to it. */
  reveal: (path: string) => void;
  toggleFile: (path: string) => void;
  openGroup: (id: string) => void;
  closeGroup: (id: string) => void;
  selectGroup: (dir: string) => void;
  scroll: (id: string, offset: number) => void;
  setHover: (hover: Selection) => void;
  deselect: () => void;
  toggleCategory: (key: RailKey) => void;
  showAllCategories: () => void;
  toggleTypeEdges: () => void;
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
  files: ParsedFile[];
  edges: Edge[];
  routes: Route[];
  routeCoverage: Coverage["routes"];
  /** Roles the model gave files no convention identified, by path. */
  modelRoles: Record<string, ModelRole>;
  children: ReactNode;
}) {
  const { files, edges, analysisId } = props;
  const folding = useMemo(() => foldDirectories(files), [files]);
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

  const [selection, setSelection] = useState<Selection>(null);
  const [hover, setHover] = useState<Selection>(null);
  const [open, setOpen] = useState<ReadonlyMap<string, number>>(() => new Map());
  const [camera, setCamera] = useState<Camera>(null);
  const [hiddenCategories, setHiddenCategories] = useState<ReadonlySet<RailKey>>(() => new Set());
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
  const shownEdges = useMemo(() => (showTypeEdges ? edges : edges.filter((e) => !e.typeOnly)), [edges, showTypeEdges]);

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

  // Clicking a folded node is the one click it has, so opening it also selects
  // the panel it becomes.
  const openGroup = useCallback((id: string) => {
    setOpen((prev) => new Map(prev).set(id, 0));
    setSelection({ kind: "group", id });
    setCamera({ kind: "group", id, nonce: ++cameraNonce });
  }, []);

  const closeGroup = useCallback(
    (id: string) => {
      setOpen((prev) => {
        const next = new Map(prev);
        next.delete(id);
        return next;
      });
      // A selection inside a folded-away panel has nothing left to point at.
      setSelection((prev) => {
        if (prev?.kind === "group") return prev.id === id ? null : prev;
        if (prev?.kind === "file") {
          const dir = folding.groupOf.get(prev.path);
          return dir !== undefined && groupId(dir) === id ? null : prev;
        }
        return prev;
      });
    },
    [folding],
  );

  const toggleFile = useCallback((path: string) => {
    setSelection((prev) => (prev?.kind === "file" && prev.path === path ? null : { kind: "file", path }));
  }, []);

  const selectGroup = useCallback((dir: string) => {
    setSelection({ kind: "group", id: groupId(dir) });
    setCamera(null);
  }, []);

  const scroll = useCallback((id: string, offset: number) => {
    setOpen((prev) => (prev.has(id) ? new Map(prev).set(id, Math.max(0, offset)) : prev));
  }, []);

  const reveal = useCallback(
    (path: string) => {
      const role = roles.get(path) ?? UNCLASSIFIED;
      // A file picked while its category is filtered off brings the category back.
      const nowHidden = hiddenCategories.has(role) ? new Set([...hiddenCategories].filter((c) => c !== role)) : hiddenCategories;
      if (nowHidden !== hiddenCategories) setHiddenCategories(nowHidden);
      const isHidden = (p: string) => nowHidden.has(roles.get(p) ?? UNCLASSIFIED);

      const dir = folding.groupOf.get(path);
      const group = folding.groups.find((g) => g.dir === dir);
      if (dir === undefined || !group) return;
      const id = groupId(dir);
      const ranked = rankGroupFiles({ files: group.files.filter((f) => !isHidden(f)) }, byPath);
      const index = ranked.indexOf(path);
      const current = open.get(id);
      const first = current === undefined ? null : clampOffset(current, ranked.length);
      if (first === null || index < first || index >= first + MAX_ROWS) {
        setOpen(new Map(open).set(id, index - Math.floor(MAX_ROWS / 2)));
      }
      setSelection({ kind: "file", path });
      setCamera({ kind: "focus", path, nonce: ++cameraNonce });
      // The row under the pointer is about to be replaced, and a removed
      // element never reports the pointer leaving it.
      setHover(null);
    },
    [folding, byPath, open, roles, hiddenCategories],
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
  const fit = useCallback(() => setCamera({ kind: "fit", nonce: ++cameraNonce }), []);
  const reset = useCallback(() => {
    setSelection(null);
    setHover(null);
    setOpen(new Map());
    setHiddenCategories(new Set());
    setShowTypeEdges(true);
    setTab("overview");
    setCamera({ kind: "fit", nonce: ++cameraNonce });
  }, []);

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
      folding,
      roles,
      categories,
      names,
      modelRoles,
      selection,
      hover,
      open,
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
      openGroup,
      closeGroup,
      selectGroup,
      scroll,
      setHover,
      deselect,
      toggleCategory,
      showAllCategories,
      toggleTypeEdges,
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
      folding,
      roles,
      categories,
      names,
      modelRoles,
      selection,
      hover,
      open,
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
      openGroup,
      closeGroup,
      selectGroup,
      scroll,
      deselect,
      toggleCategory,
      showAllCategories,
      toggleTypeEdges,
      fit,
      reset,
      explain,
    ],
  );

  return <WorkspaceContext.Provider value={value}>{props.children}</WorkspaceContext.Provider>;
}
