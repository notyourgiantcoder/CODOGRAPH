// Folding the directory tree into a readable number of groups. Pure: paths in,
// groups out. The repository's own shape decides the depth; nothing about which
// folders matter is picked in advance.

export const MAX_GROUPS = 24;
/** "Fewer than a couple of files" is the starting rule. */
const START_THRESHOLD = 2;

export type Group = {
  /** The surviving directory, repository-relative. "." for the root. */
  dir: string;
  /** Every file folded into this group, sorted. */
  files: string[];
};

export type Folding = {
  /** The lowest threshold that landed at or under MAX_GROUPS. */
  threshold: number;
  groups: Group[];
  groupOf: ReadonlyMap<string, string>;
  /** Groups standing for folders outside the one in view (see scope.ts). */
  outside?: ReadonlySet<string>;
  /** Labels a group is drawn with instead of its shortest unique path. */
  labels?: ReadonlyMap<string, string>;
};

type FileInDir = { path: string; module: string };

export function foldDirectories(files: readonly FileInDir[]): Folding {
  // Every directory is a node, including ancestors that hold no files
  // directly, so an empty level can fold away like any other.
  const direct = new Map<string, string[]>();
  for (const f of files) {
    for (const dir of [f.module, ...ancestors(f.module)]) if (!direct.has(dir)) direct.set(dir, []);
    direct.get(f.module)?.push(f.path);
  }
  // Deepest level first, the order folds are decided in.
  const levels: string[][] = [];
  for (const dir of direct.keys()) (levels[depth(dir)] ??= []).push(dir);

  // Raise the threshold and keep the first that fits. At a high enough
  // threshold everything folds into the root, so this terminates. Each try
  // works on folder counts alone; file lists are built once, for the answer.
  for (let threshold = START_THRESHOLD; ; ) {
    const { merged, kept, smallestKept } = foldAt(direct, levels, threshold);
    if (kept.length <= MAX_GROUPS) return groupsFor(direct, merged, threshold);
    // Every threshold up to the smallest folder that stayed folds exactly as
    // this one did: each folder's count falls on the same side of all of them,
    // so the same folders merge and the counts come out the same. One past it
    // is the next threshold that can fold differently. Stepping one at a time
    // instead re-folds a large repository thousands of times for nothing.
    if (smallestKept === Infinity) throw new Error(`Folding at ${threshold} kept no folder yet left ${kept.length} groups`);
    threshold = smallestKept + 1;
  }
}

/**
 * One threshold, on counts: which folders fold into their parent, which keep
 * files of their own, and the fewest files any folder below the root had when
 * it was kept.
 */
function foldAt(
  direct: ReadonlyMap<string, readonly string[]>,
  levels: readonly (string[] | undefined)[],
  threshold: number,
): { merged: Set<string>; kept: string[]; smallestKept: number } {
  const count = new Map<string, number>();
  for (const [dir, list] of direct) count.set(dir, list.length);
  const merged = new Set<string>();
  let smallestKept = Infinity;
  for (let d = levels.length - 1; d >= 1; d--) {
    // A level's decisions only move counts up to the level above, so deciding
    // them one at a time is the same as deciding the whole level first.
    for (const dir of levels[d] ?? []) {
      const n = count.get(dir) ?? 0;
      if (n < threshold) {
        merged.add(dir);
        const parent = parentOf(dir);
        count.set(parent, (count.get(parent) ?? 0) + n);
      } else {
        smallestKept = Math.min(smallestKept, n);
      }
    }
  }
  const kept = [...direct.keys()].filter((dir) => !merged.has(dir) && (count.get(dir) ?? 0) > 0);
  return { merged, kept, smallestKept };
}

// Each file lands in its nearest folder that wasn't folded away.
function groupsFor(direct: ReadonlyMap<string, readonly string[]>, merged: ReadonlySet<string>, threshold: number): Folding {
  const members = new Map<string, string[]>();
  for (const [dir, list] of direct) {
    let home = dir;
    while (merged.has(home)) home = parentOf(home);
    const into = members.get(home) ?? [];
    into.push(...list);
    members.set(home, into);
  }
  const groups = [...members]
    .filter(([, list]) => list.length > 0)
    .map(([dir, list]) => ({ dir, files: list.sort() }))
    .sort((a, b) => a.dir.localeCompare(b.dir));
  const groupOf = new Map<string, string>();
  for (const g of groups) for (const f of g.files) groupOf.set(f, g.dir);
  return { threshold, groups, groupOf };
}

function depth(dir: string): number {
  return dir === "." ? 0 : dir.split("/").length;
}

function parentOf(dir: string): string {
  const i = dir.lastIndexOf("/");
  return i === -1 ? "." : dir.slice(0, i);
}

function ancestors(dir: string): string[] {
  const out: string[] = [];
  for (let d = dir; d !== "."; ) {
    d = parentOf(d);
    out.push(d);
  }
  return out;
}
