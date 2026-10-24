import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type pg from "pg";
import type { Coverage, ParseResult } from "../parser/index.ts";
import { chunks, inParallel } from "../parallel.ts";
import type { Database, Json } from "../supabase/database.types.ts";
import { directPostgres } from "../supabase/postgres.ts";

type Db = SupabaseClient<Database>;

// Each PostgREST request stays well inside its statement timeout.
const FILE_CHUNK = 1000;
const EDGE_CHUNK = 1000;
const ROLE_CHUNK = 2000;
const ROUTE_CHUNK = 2000;

// Postgres cancels a statement that outlasts the timeout, and a cancelled
// statement changed nothing, so it's safe to send again. A busy database
// cancels one now and then; any other error fails the run at once.
const STATEMENT_TIMEOUT = "57014";
const ATTEMPTS = 3;

async function retried<T extends { error: { code: string } | null }>(send: () => PromiseLike<T>): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    const result = await send();
    if (result.error?.code !== STATEMENT_TIMEOUT || attempt === ATTEMPTS) return result;
    await new Promise((resume) => setTimeout(resume, 1000 * 2 ** (attempt - 1)));
  }
}
// Chunks in flight at once. A large repository is hundreds of chunks, and one
// at a time spends most of the store stage waiting on round trips; a few at a
// time stays well inside what the database takes without queueing.
const CONCURRENCY = 4;

// The skipped-file list lives in the files table; storing it twice would let
// the two disagree.
export type StoredCoverage = Omit<Coverage, "files"> & { files: Omit<Coverage["files"], "skippedFiles"> };

type Insert<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Insert"];
type Rows = { files: Insert<"files">[]; edges: Insert<"edges">[]; roles: Insert<"file_roles">[]; routes: Insert<"routes">[] };

export async function storeResult(db: Db, analysis: { id: string; organizationId: string }, result: ParseResult): Promise<void> {
  const direct = directPostgres();
  if (direct) await writeDirect(direct, analysis, result);
  else await writeThroughApi(db, analysis.id, buildRows(analysis, result));
}

// Every row the run stores. Each file's id is made here rather than by the
// database, so edges, roles and routes can name their files without first
// reading the inserted files back.
function buildRows(analysis: { id: string; organizationId: string }, result: ParseResult): Rows {
  const owner = { organization_id: analysis.organizationId, analysis_id: analysis.id };
  const idOf = new Map<string, string>();
  const files: Insert<"files">[] = [
    ...result.files.map((f) => {
      const id = randomUUID();
      idOf.set(f.path, id);
      return {
        id,
        ...owner,
        path: f.path,
        module: f.module,
        lines: f.lines,
        bytes: f.bytes,
        hash: f.hash,
        fan_in: f.fanIn,
        fan_out: f.fanOut,
        reached_by: f.reachedBy,
        exports: f.exports,
        complexity: f.complexity,
      };
    }),
    ...result.coverage.files.skippedFiles.map((f) => ({ id: randomUUID(), ...owner, path: f.path, skip_reason: f.reason, skip_detail: f.detail })),
  ];

  // An end that isn't a parsed file is a bug upstream, so it fails the run
  // rather than being dropped.
  const id = (path: string, what: string): string => {
    const found = idOf.get(path);
    if (found === undefined) throw new Error(`Storing ${what} failed: ${path} isn't a stored parsed file`);
    return found;
  };
  return {
    files,
    edges: result.edges.map((e) => ({
      ...owner,
      source_file_id: id(e.source, "edges"),
      target_file_id: id(e.target, "edges"),
      kind: e.kind,
      specifier: e.specifier,
      type_only: e.typeOnly,
      line: e.line,
    })),
    roles: result.files.flatMap((f) =>
      f.role === null ? [] : [{ organization_id: analysis.organizationId, file_id: id(f.path, "roles"), role: f.role, source: "convention" }],
    ),
    routes: result.routes.map((r) => ({ ...owner, file_id: id(r.file, "routes"), method: r.method, path: r.pattern, line: r.line })),
  };
}

/** Each distinct value once, and every value as its 1-based position in that list, as Postgres arrays count. */
function dictionary(values: readonly string[]): { entries: string[]; index: number[] } {
  const positions = new Map<string, number>();
  const entries: string[] = [];
  const index = values.map((value) => {
    let at = positions.get(value);
    if (at === undefined) {
      entries.push(value);
      at = entries.length;
      positions.set(value, at);
    }
    return at;
  });
  return { entries, index };
}

/** Edges per statement on the direct connection. */
const DIRECT_EDGE_CHUNK = 50_000;

// One transaction: the last run's rows go and this run's arrive together, so
// a failure part-way leaves the last run's rows exactly as they were.
//
// The upload is what takes the time, so as little as possible is sent: each
// column as one array rather than a row object per row, the analysis and
// organization once, folders and specifiers once each, and a file named by
// its position in the list rather than by a 36-character id. The database
// makes the ids and keeps position-to-id for this transaction only. Every
// insert's row count is checked, so a position that matched nothing fails
// the run instead of losing a row.
async function writeDirect(pool: pg.Pool, analysis: { id: string; organizationId: string }, result: ParseResult): Promise<void> {
  const client = await pool.connect();
  const exactly = async (what: string, expected: number, text: string, values: unknown[]) => {
    const { rowCount } = await client.query(text, values);
    if (rowCount !== expected) throw new Error(`stored ${rowCount ?? 0} of ${expected} ${what}`);
  };
  try {
    await client.query("begin");
    // The delete and inserts of a large repository can take a while; the
    // pooler's default timeout is for interactive queries.
    await client.query("set local statement_timeout = '10min'");
    // Edges first: a file's delete would otherwise cascade to them, all in the one statement.
    await client.query("delete from public.edges where analysis_id = $1", [analysis.id]);
    await client.query("delete from public.files where analysis_id = $1", [analysis.id]);
    await client.query("create temporary table file_position (n integer primary key, id uuid not null) on commit drop");

    const files = result.files;
    const position = new Map(files.map((f, i) => [f.path, i + 1]));
    const at = (path: string, what: string): number => {
      const found = position.get(path);
      // An end that isn't a parsed file is a bug upstream, so it fails the run rather than being dropped.
      if (found === undefined) throw new Error(`${what}: ${path} isn't a stored parsed file`);
      return found;
    };
    const modules = dictionary(files.map((f) => f.module));
    await exactly(
      "files",
      files.length,
      `with u as (
         select * from unnest($3::text[], $4::int[], $5::int[], $6::int[], $7::text[], $8::int[], $9::int[], $10::text[], $11::text[], $12::int[])
           with ordinality as u(path, module_at, lines, bytes, hash, fan_in, fan_out, reached_by, exports, complexity, n)
       ), stored as (
         insert into public.files (id, organization_id, analysis_id, path, module, lines, bytes, hash, fan_in, fan_out, reached_by, exports, complexity)
         select gen_random_uuid(), $1, $2, path, ($13::text[])[module_at], lines, bytes, hash, fan_in, fan_out, reached_by,
           array(select e from jsonb_array_elements_text(exports::jsonb) with ordinality as x(e, i) order by i), complexity
         from u
         returning id, path
       )
       insert into file_position select u.n, stored.id from stored join u using (path)`,
      [
        analysis.organizationId,
        analysis.id,
        files.map((f) => f.path),
        modules.index,
        files.map((f) => f.lines),
        files.map((f) => f.bytes),
        files.map((f) => f.hash),
        files.map((f) => f.fanIn),
        files.map((f) => f.fanOut),
        files.map((f) => f.reachedBy),
        files.map((f) => JSON.stringify(f.exports)),
        files.map((f) => f.complexity),
        modules.entries,
      ],
    );

    const skipped = result.coverage.files.skippedFiles;
    await exactly(
      "skipped files",
      skipped.length,
      `insert into public.files (organization_id, analysis_id, path, skip_reason, skip_detail)
       select $1, $2, path, reason, detail from unnest($3::text[], $4::text[], $5::text[]) as u(path, reason, detail)`,
      [analysis.organizationId, analysis.id, skipped.map((f) => f.path), skipped.map((f) => f.reason), skipped.map((f) => f.detail)],
    );

    for (const edges of chunks(result.edges, DIRECT_EDGE_CHUNK)) {
      const kinds = dictionary(edges.map((e) => e.kind));
      const specifiers = dictionary(edges.map((e) => e.specifier));
      await exactly(
        "edges",
        edges.length,
        `insert into public.edges (organization_id, analysis_id, source_file_id, target_file_id, kind, specifier, type_only, line)
         select $1, $2, s.id, t.id, ($9::text[])[e.kind_at], ($10::text[])[e.specifier_at], e.type_only, e.line
         from unnest($3::int[], $4::int[], $5::int[], $6::int[], $7::bool[], $8::int[]) as e(source, target, kind_at, specifier_at, type_only, line)
         join file_position s on s.n = e.source
         join file_position t on t.n = e.target`,
        [
          analysis.organizationId,
          analysis.id,
          edges.map((e) => at(e.source, "an edge's source")),
          edges.map((e) => at(e.target, "an edge's target")),
          kinds.index,
          specifiers.index,
          edges.map((e) => e.typeOnly),
          edges.map((e) => e.line),
          kinds.entries,
          specifiers.entries,
        ],
      );
    }

    const roled = files.flatMap((f, i) => (f.role === null ? [] : [{ n: i + 1, role: f.role }]));
    await exactly(
      "roles",
      roled.length,
      `insert into public.file_roles (organization_id, file_id, role, source)
       select $1, f.id, r.role, 'convention' from unnest($2::int[], $3::text[]) as r(n, role) join file_position f using (n)`,
      [analysis.organizationId, roled.map((r) => r.n), roled.map((r) => r.role)],
    );

    const routes = result.routes;
    await exactly(
      "routes",
      routes.length,
      `insert into public.routes (organization_id, analysis_id, file_id, method, path, line)
       select $1, $2, f.id, r.method, r.pattern, r.line
       from unnest($3::int[], $4::text[], $5::text[], $6::int[]) as r(n, method, pattern, line) join file_position f using (n)`,
      [analysis.organizationId, analysis.id, routes.map((r) => at(r.file, "a route's file")), routes.map((r) => r.method), routes.map((r) => r.pattern), routes.map((r) => r.line)],
    );
    await client.query("commit");
  } catch (error) {
    await client.query("rollback").catch(() => {});
    throw new Error(`Storing the map failed: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
  } finally {
    client.release();
  }
}

// Through PostgREST, in requests that each stay inside its statement timeout.
// They aren't one transaction, but nothing reads as complete until the final
// update, and a failure part-way marks the run failed.
async function writeThroughApi(db: Db, analysisId: string, rows: Rows): Promise<void> {
  // A re-run replaces what the last run stored. Edges first: a file's delete
  // would otherwise cascade to them, all in the one statement.
  await clear(db, "edges", analysisId);
  await clear(db, "files", analysisId);

  await inParallel(
    chunks(rows.files, FILE_CHUNK).map((chunk) => async () => {
      const { error } = await retried(() => db.from("files").insert(chunk));
      if (error) throw new Error(`Storing files failed: ${error.message}`);
    }),
    CONCURRENCY,
  );
  // None of the three depends on another, so they share the queue.
  await inParallel(
    [
      ...chunks(rows.edges, EDGE_CHUNK).map((chunk) => async () => {
        const { error } = await retried(() => db.from("edges").insert(chunk));
        if (error) throw new Error(`Storing edges failed: ${error.message}`);
      }),
      ...chunks(rows.roles, ROLE_CHUNK).map((chunk) => async () => {
        const { error } = await retried(() => db.from("file_roles").insert(chunk));
        if (error) throw new Error(`Storing roles failed: ${error.message}`);
      }),
      ...chunks(rows.routes, ROUTE_CHUNK).map((chunk) => async () => {
        const { error } = await retried(() => db.from("routes").insert(chunk));
        if (error) throw new Error(`Storing routes failed: ${error.message}`);
      }),
    ],
    CONCURRENCY,
  );
}

/** Rows one statement deletes comfortably inside the statement timeout. */
const DELETE_SLICE_ROWS = 10_000;

// A large run's rows can't go in one statement, so they go in slices of the
// id space: uuids are spread evenly, so each prefix range holds an even share.
// A small run stays one statement.
async function clear(db: Db, table: "edges" | "files", analysisId: string): Promise<void> {
  const { count, error } = await db.from(table).select("id", { count: "exact", head: true }).eq("analysis_id", analysisId);
  if (error) throw new Error(`Clearing the previous run's ${table} failed: ${error.message}`);
  if (!count) return;
  const slices = count <= DELETE_SLICE_ROWS ? 1 : count <= DELETE_SLICE_ROWS * 16 ? 16 : 256;
  const digits = slices === 256 ? 2 : 1;
  const bound = (i: number) => `${i.toString(16).padStart(digits, "0")}${"0".repeat(8 - digits)}-0000-0000-0000-000000000000`;
  await inParallel(
    Array.from({ length: slices }, (_, i) => async () => {
      let query = db.from(table).delete().eq("analysis_id", analysisId);
      if (slices > 1) {
        query = query.gte("id", bound(i));
        if (i < slices - 1) query = query.lt("id", bound(i + 1));
      }
      const { error: failed } = await retried(() => query);
      if (failed) throw new Error(`Clearing the previous run's ${table} failed: ${failed.message}`);
    }),
    CONCURRENCY,
  );
}

export function storedCoverage(coverage: Coverage): Json {
  const { found, parsed, skipped, excludedDirectories } = coverage.files;
  const stored: StoredCoverage = { ...coverage, files: { found, parsed, skipped, excludedDirectories } };
  return stored;
}
