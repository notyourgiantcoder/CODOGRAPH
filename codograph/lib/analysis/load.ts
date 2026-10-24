import type { SupabaseClient } from "@supabase/supabase-js";
import { inParallel } from "../parallel.ts";
import { validateParseResult } from "../parser/contract.ts";
import { SCHEMA_VERSION, type ParseResult } from "../parser/types.ts";
import { isModelRole, type ModelRole } from "../roles.ts";
import type { Database } from "../supabase/database.types.ts";

type Db = SupabaseClient<Database>;

// PostgREST returns at most this many rows per request, so larger analyses
// are read in pages. Bounded by the analysis itself, never open-ended.
const PAGE = 1000;

// Rebuilds a complete analysis from its rows and puts it back through the
// parser's contract, so what the map draws is checked the same way a parser
// output file was: an edge to a file that isn't there, or counts that don't
// add up, fail by field instead of drawing. Reads with the caller's client,
// so the policies decide whether any of it comes back.
//
// A file's role in the parse result is convention's alone. Roles the model
// gave come back separately, so nothing downstream can mistake a label for a
// fact the parser established.
export async function loadStoredAnalysis(
  db: Db,
  analysis: { id: string; label: string; coverage: unknown; projects: unknown },
): Promise<{ result: ParseResult; modelRoles: Record<string, ModelRole> }> {
  const { files, edges, routes } = (await readAtOnce(db, analysis.id)) ?? (await readPaged(db, analysis.id));

  const parsed = files.filter((f) => f.skipReason === null);
  const skipped = files.filter((f) => f.skipReason !== null);
  const coverage = typeof analysis.coverage === "object" && analysis.coverage !== null ? analysis.coverage : {};
  const coverageFiles: unknown = Reflect.get(coverage, "files");

  const modelRoles: Record<string, ModelRole> = {};
  for (const f of parsed) {
    if (f.roleSource !== "model" || f.role === null) continue;
    if (!isModelRole(f.role)) throw new Error(`Stored model role "${f.role}" on ${f.path} isn't one a model may give`);
    modelRoles[f.path] = f.role;
  }

  // Everything below is checked by the contract, so the rows go in as stored.
  const result = validateParseResult({
    schemaVersion: SCHEMA_VERSION,
    root: analysis.label,
    projects: analysis.projects,
    files: parsed
      .map((f) => ({
        path: f.path,
        module: f.module,
        lines: f.lines,
        bytes: f.bytes,
        hash: f.hash,
        fanIn: f.fanIn,
        fanOut: f.fanOut,
        reachedBy: f.reachedBy,
        role: f.roleSource === "convention" ? f.role : null,
        exports: f.exports,
        complexity: f.complexity,
      }))
      .sort((a, b) => a.path.localeCompare(b.path)),
    // The parser's order, so a stored map lists edges the same way however it was read.
    edges: edges.sort(
      (a, b) =>
        (a.source ?? "").localeCompare(b.source ?? "") ||
        (a.target ?? "").localeCompare(b.target ?? "") ||
        String(a.kind).localeCompare(String(b.kind)),
    ),
    routes: routes.sort(
      (a, b) => a.pattern.localeCompare(b.pattern) || a.method.localeCompare(b.method) || (a.file ?? "").localeCompare(b.file ?? ""),
    ),
    coverage: {
      ...coverage,
      files: {
        ...(typeof coverageFiles === "object" && coverageFiles !== null ? coverageFiles : {}),
        skippedFiles: skipped
          .map((f) => ({ path: f.path, reason: f.skipReason, detail: f.skipDetail }))
          .sort((a, b) => a.path.localeCompare(b.path)),
      },
    },
    // Config problems aren't stored; nothing on the map reads them.
    configs: [],
  });
  return { result, modelRoles };
}

/**
 * A stored analysis as rows, before the contract checks them. Fields the
 * loader itself decides on are typed; the rest pass through to the contract
 * as they came back.
 */
type StoredRows = {
  files: {
    path: string;
    skipReason: string | null;
    role: string | null;
    roleSource: string | null;
    module: unknown;
    lines: unknown;
    bytes: unknown;
    hash: unknown;
    fanIn: unknown;
    fanOut: unknown;
    reachedBy: unknown;
    exports: unknown;
    complexity: unknown;
    skipDetail: unknown;
  }[];
  edges: { source: string | undefined; target: string | undefined; kind: unknown; typeOnly: unknown; specifier: unknown; line: unknown }[];
  routes: { file: string | undefined; method: string; pattern: string; line: unknown }[];
};

/** Edges per slice: few enough that each slice's statement finishes well inside the timeout. */
const EDGES_PER_SLICE = 20_000;

// A few requests instead of hundreds: the analysis_map_* functions build the
// files, the routes and slices of the edges in the database, fetched side by
// side. Null when they aren't installed yet, or when the database still runs
// out of time, so the map opens the slow way rather than not at all.
async function readAtOnce(db: Db, analysisId: string): Promise<StoredRows | null> {
  try {
    return await readInParts(db, analysisId);
  } catch (error) {
    if (error instanceof PartsUnavailable) return null;
    throw error;
  }
}

class PartsUnavailable extends Error {}

/** Errors that mean "read it another way", not "this analysis can't be read". */
function check(error: { code: string; message: string } | null): void {
  if (!error) return;
  // PGRST202: the function isn't there. 57014: the statement ran out of time.
  if (error.code === "PGRST202" || error.code === "57014") throw new PartsUnavailable(error.message);
  throw new Error(`Reading the stored analysis failed: ${error.message}`);
}

async function readInParts(db: Db, analysisId: string): Promise<StoredRows> {
  const filesCall = await db.rpc("analysis_map_files", { p_analysis_id: analysisId });
  check(filesCall.error);
  const counted = await db.from("edges").select("id", { count: "exact", head: true }).eq("analysis_id", analysisId);
  check(counted.error);
  const parts = Math.max(1, Math.ceil((counted.count ?? 0) / EDGES_PER_SLICE));

  let routesData: unknown = [];
  const slices: unknown[][][] = [];
  await inParallel(
    [
      async () => {
        const call = await db.rpc("analysis_map_routes", { p_analysis_id: analysisId });
        check(call.error);
        routesData = call.data;
      },
      ...Array.from({ length: parts }, (_, part) => async () => {
        const call = await db.rpc("analysis_map_edges", { p_analysis_id: analysisId, p_part: part, p_parts: parts });
        check(call.error);
        slices[part] = tuples(call.data, `edges slice ${part}`);
      }),
    ],
    PAGES_IN_FLIGHT,
  );
  const files = tuples(filesCall.data, "files");
  const pathAt = files.map((f, i) => text(f[0], `files[${i}].path`));
  return {
    files: files.map((f, i) => ({
      path: pathAt[i] ?? "",
      module: f[1],
      lines: f[2],
      bytes: f[3],
      hash: f[4],
      fanIn: f[5],
      fanOut: f[6],
      reachedBy: f[7],
      exports: f[8],
      complexity: f[9],
      skipReason: nullableText(f[10], `files[${i}].skip_reason`),
      skipDetail: f[11],
      role: nullableText(f[12], `files[${i}].role`),
      roleSource: nullableText(f[13], `files[${i}].role_source`),
    })),
    edges: slices.flat().map((e) => ({
      source: typeof e[0] === "number" ? pathAt[e[0]] : undefined,
      target: typeof e[1] === "number" ? pathAt[e[1]] : undefined,
      kind: e[2],
      typeOnly: e[3],
      specifier: e[4],
      line: e[5],
    })),
    routes: tuples(routesData, "routes").map((r, i) => ({
      file: typeof r[0] === "number" ? pathAt[r[0]] : undefined,
      method: text(r[1], `routes[${i}].method`),
      pattern: text(r[2], `routes[${i}].path`),
      line: r[3],
    })),
  };
}

// A page of rows at a time: the way before analysis_map, and the fallback without it.
async function readPaged(db: Db, analysisId: string): Promise<StoredRows> {
  // The three reads don't depend on each other, so they run together.
  const [files, edges, routes] = await Promise.all([
    readAll((from, to, count) =>
      db
        .from("files")
        .select(
          "id, path, module, lines, bytes, hash, fan_in, fan_out, reached_by, exports, complexity, skip_reason, skip_detail, file_roles(role, source)",
          exact(count),
        )
        .eq("analysis_id", analysisId)
        .order("id")
        .range(from, to),
    ),
    readAll((from, to, count) =>
      db
        .from("edges")
        .select("source_file_id, target_file_id, kind, type_only, specifier, line", exact(count))
        .eq("analysis_id", analysisId)
        .order("id")
        .range(from, to),
    ),
    readAll((from, to, count) =>
      db.from("routes").select("file_id, method, path, line", exact(count)).eq("analysis_id", analysisId).order("id").range(from, to),
    ),
  ]);
  const pathOf = new Map(files.map((f) => [f.id, f.path]));
  return {
    files: files.map((f) => ({
      path: f.path,
      module: f.module,
      lines: f.lines,
      bytes: f.bytes,
      hash: f.hash,
      fanIn: f.fan_in,
      fanOut: f.fan_out,
      reachedBy: f.reached_by,
      exports: f.exports,
      complexity: f.complexity,
      skipReason: f.skip_reason,
      skipDetail: f.skip_detail,
      // One row at most: file_id is unique in file_roles.
      role: f.file_roles[0]?.role ?? null,
      roleSource: f.file_roles[0]?.source ?? null,
    })),
    edges: edges.map((e) => ({
      source: pathOf.get(e.source_file_id),
      target: pathOf.get(e.target_file_id),
      kind: e.kind,
      typeOnly: e.type_only,
      specifier: e.specifier,
      line: e.line,
    })),
    routes: routes.map((r) => ({ file: pathOf.get(r.file_id), method: r.method, pattern: r.path, line: r.line })),
  };
}

function tuples(value: unknown, what: string): unknown[][] {
  if (!Array.isArray(value)) throw new Error(`Reading the stored analysis failed: ${what} isn't a list`);
  return value.map((row, i) => {
    if (!Array.isArray(row)) throw new Error(`Reading the stored analysis failed: ${what}[${i}] isn't a row`);
    return row;
  });
}

function text(value: unknown, at: string): string {
  if (typeof value !== "string") throw new Error(`Reading the stored analysis failed: ${at} isn't text`);
  return value;
}

function nullableText(value: unknown, at: string): string | null {
  return value === null ? null : text(value, at);
}

/** The select option readAll's first page passes to learn the total; later pages don't count again. */
export function exact(count: boolean): { count: "exact" | undefined } {
  return { count: count ? "exact" : undefined };
}

/** Pages in flight at once once the count is known. */
const PAGES_IN_FLIGHT = 6;

type Page<T> = { data: T[] | null; error: { message: string } | null; count: number | null };

/**
 * Every row a query returns, a page at a time. The first page asks for the
 * total (`count` is true only then, so later pages don't pay for counting
 * again); the rest are then fetched several at a time instead of one after
 * another, which on a large repository is the difference between a page that
 * opens and one that doesn't.
 */
export async function readAll<T>(page: (from: number, to: number, count: boolean) => PromiseLike<Page<T>>): Promise<T[]> {
  const first = await page(0, PAGE - 1, true);
  if (first.error) throw new Error(`Reading the stored analysis failed: ${first.error.message}`);
  if (first.count === null) throw new Error("Reading the stored analysis failed: the database didn't say how many rows there are");
  const total = first.count;
  const pages: T[][] = [first.data ?? []];
  const starts: number[] = [];
  for (let from = PAGE; from < total; from += PAGE) starts.push(from);
  await inParallel(
    starts.map((from, i) => async () => {
      const { data, error } = await page(from, from + PAGE - 1, false);
      if (error) throw new Error(`Reading the stored analysis failed: ${error.message}`);
      pages[i + 1] = data ?? [];
    }),
    PAGES_IN_FLIGHT,
  );
  const rows = pages.flat();
  // A re-run replacing the rows mid-read would leave pages from two runs.
  if (rows.length !== total) throw new Error(`Reading the stored analysis failed: expected ${total} rows, read ${rows.length}; was it re-run meanwhile?`);
  return rows;
}
