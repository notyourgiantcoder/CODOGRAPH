import type { Edge } from "../parser/types.ts";
import { MAX_GROUPS, type Folding, type Group } from "./fold.ts";

// The map shows one folder at a time, the way a map shows one area: its
// subfolders as boxes, its own files as rows, and the rest of the repository
// only where an import crosses into it. Pure: paths and edges in, groups out.

type FileInDir = { path: string; module: string };

/** Files above which the whole-repository drawing stops being readable and the map shows one folder at a time. */
export const FULL_MAP_FILES = 200;

export type Scoped = Folding & {
  /** The folder in view. "." for the repository root. */
  scope: string;
};

export function isInside(path: string, scope: string): boolean {
  return scope === "." || path.startsWith(`${scope}/`);
}

/**
 * Where a file outside the folder in view is drawn: the folder that branches
 * off the line from the root down to the view, one level below where they
 * part. A file sitting directly in one of the view's ancestors is drawn as
 * that ancestor's own files.
 */
export function outsideDir(module: string, scope: string): string {
  const s = scope === "." ? [] : scope.split("/");
  const d = module === "." ? [] : module.split("/");
  let shared = 0;
  while (shared < s.length && shared < d.length && s[shared] === d[shared]) shared++;
  if (d.length > shared) return d.slice(0, shared + 1).join("/");
  return shared === 0 ? "." : d.slice(0, shared).join("/");
}

/** The folders from the root down to the view: ".", "src", "src/main". */
export function trail(scope: string): string[] {
  if (scope === ".") return ["."];
  const parts = scope.split("/");
  return [".", ...parts.map((_, i) => parts.slice(0, i + 1).join("/"))];
}

/**
 * Where going into a folder actually lands. A folder with no files of its own
 * and exactly one subfolder is passed through, so a click never lands on a
 * level with nothing to show but one box.
 */
export function landing(files: readonly FileInDir[], scope: string): string {
  for (let at = scope; ; ) {
    const children = new Set<string>();
    let ownFiles = 0;
    for (const f of files) {
      if (!isInside(f.path, at)) continue;
      const rest = relative(f.module, at);
      if (rest === ".") ownFiles++;
      else children.add(rest.split("/")[0] ?? rest);
      if (ownFiles > 0 || children.size > 1) return at;
    }
    const [only] = children;
    if (only === undefined) return at;
    at = absolute(only, at);
  }
}

/**
 * The folder in view as groups: one per subfolder (its whole subtree), one
 * for the folder's own files, and one per outside folder an import crosses
 * into. When there are more subfolders than a view holds, the biggest keep
 * their boxes and the smaller ones' files join the folder's own, so every box
 * is still a folder directly inside the one in view.
 */
export function scopeFolding(files: readonly FileInDir[], edges: readonly Edge[], scope: string): Scoped {
  const inside = files.filter((f) => isInside(f.path, scope));
  const byChild = new Map<string, string[]>();
  for (const f of inside) {
    const rest = relative(f.module, scope);
    const child = rest === "." ? scope : absolute(rest.split("/")[0] ?? rest, scope);
    const list = byChild.get(child) ?? [];
    list.push(f.path);
    byChild.set(child, list);
  }

  // The folder's own box takes one of the places.
  const own = byChild.get(scope) ?? [];
  const subfolders = [...byChild].filter(([dir]) => dir !== scope);
  const room = MAX_GROUPS - 1;
  const ranked = subfolders.sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]));
  const boxed = ranked.slice(0, room);
  const merged = ranked.slice(room);
  const ownFiles = [...own, ...merged.flatMap(([, list]) => list)];
  const insideGroups: Group[] = [
    ...boxed.map(([dir, list]) => ({ dir, files: list.sort() })),
    ...(ownFiles.length > 0 ? [{ dir: scope, files: ownFiles.sort() }] : []),
  ];

  // Only the outside files an import actually connects to the view, so an
  // outside box's count is how much of it this folder touches.
  const insidePaths = new Set(inside.map((f) => f.path));
  const moduleOf = new Map(files.map((f) => [f.path, f.module]));
  const outside = new Map<string, Set<string>>();
  for (const e of edges) {
    const sourceIn = insidePaths.has(e.source);
    if (sourceIn === insidePaths.has(e.target)) continue;
    const other = sourceIn ? e.target : e.source;
    const otherModule = moduleOf.get(other);
    if (otherModule === undefined) continue; // filtered off the map
    const dir = outsideDir(otherModule, scope);
    const set = outside.get(dir) ?? new Set<string>();
    set.add(other);
    outside.set(dir, set);
  }
  const outsideGroups = [...outside].map(([dir, set]) => ({ dir, files: [...set].sort() }));

  const groups = [...insideGroups, ...outsideGroups].sort((a, b) => a.dir.localeCompare(b.dir));
  const groupOf = new Map<string, string>();
  for (const g of groups) for (const f of g.files) groupOf.set(f, g.dir);

  const labels = new Map<string, string>();
  // With too many subfolders, the folder's own box also holds the smallest ones' files, and says so.
  const name = scope === "." ? "(root)" : (scope.split("/").pop() ?? scope);
  labels.set(scope, merged.length > 0 ? `${name} · own files + ${merged.length} small folders` : `${name} · own files`);
  for (const dir of outside.keys()) {
    labels.set(dir, isInside(scope, dir) || dir === "." ? `${dir === "." ? "(root)" : dir} · own files` : dir);
  }
  return { threshold: 0, groups, groupOf, scope, outside: new Set(outside.keys()), labels };
}

/** A module's path below the folder in view; "." for the folder itself. */
function relative(module: string, scope: string): string {
  if (scope === ".") return module;
  return module === scope ? "." : module.slice(scope.length + 1);
}

function absolute(dir: string, scope: string): string {
  if (scope === ".") return dir;
  return dir === "." ? scope : `${scope}/${dir}`;
}
