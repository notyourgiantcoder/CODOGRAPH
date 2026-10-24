import { ROLE_IDS, type Role } from "../roles.ts";
import { EDGE_KINDS, type Edge, type MapFile, type ParsedFile } from "../parser/types.ts";

// The map as it crosses from the server to the browser. As objects, a large
// repository's files and edges are tens of megabytes, mostly the same keys and
// paths written out again on every edge; as rows with edges pointing at files
// by position, the same facts are a fraction of that. Pure: both sides use it.

export type PackedMap = {
  /** Every parsed file, in the order the rows below follow. */
  paths: string[];
  /** Per path: lines, fan-in, fan-out, complexity, role, reached by, exports. */
  files: [number, number, number, number, Role | null, string | null, string[]][];
  /** Source and target positions in paths, kind as its position in EDGE_KINDS, type-only as 1 or 0, line, specifier. */
  edges: [number, number, number, number, number, string][];
};

export function packMap(files: readonly ParsedFile[], edges: readonly Edge[]): PackedMap {
  const at = new Map(files.map((f, i) => [f.path, i]));
  const position = (path: string) => {
    const i = at.get(path);
    if (i === undefined) throw new Error(`Edge end ${path} isn't a file on the map`);
    return i;
  };
  return {
    paths: files.map((f) => f.path),
    files: files.map((f) => [f.lines, f.fanIn, f.fanOut, f.complexity, f.role, f.reachedBy, f.exports]),
    edges: edges.map((e) => [position(e.source), position(e.target), EDGE_KINDS.indexOf(e.kind), e.typeOnly ? 1 : 0, e.line, e.specifier]),
  };
}

export function unpackMap(packed: PackedMap): { files: MapFile[]; edges: Edge[] } {
  const { paths } = packed;
  const pathAt = (i: number) => {
    const path = paths[i];
    if (path === undefined) throw new Error(`Packed edge points at file ${i}, past the ${paths.length} on the map`);
    return path;
  };
  return {
    files: packed.files.map(([lines, fanIn, fanOut, complexity, role, reachedBy, exports], i) => {
      const path = pathAt(i);
      return {
        path,
        // The folder a file sits in, as the walk names it: "." at the root.
        module: path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : ".",
        lines,
        fanIn,
        fanOut,
        complexity,
        role: role === null ? null : roleOf(role),
        reachedBy,
        exports,
      };
    }),
    edges: packed.edges.map(([source, target, kind, typeOnly, line, specifier]) => {
      const edgeKind = EDGE_KINDS[kind];
      if (edgeKind === undefined) throw new Error(`Packed edge has kind ${kind}, which isn't one the parser produces`);
      return { source: pathAt(source), target: pathAt(target), kind: edgeKind, typeOnly: typeOnly === 1, line, specifier };
    }),
  };
}

function roleOf(value: string): Role {
  const role = ROLE_IDS.find((r) => r === value);
  if (role === undefined) throw new Error(`Packed role "${value}" isn't one the taxonomy has`);
  return role;
}
