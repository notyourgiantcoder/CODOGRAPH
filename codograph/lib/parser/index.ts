import { statSync } from "node:fs";
import path from "node:path";
import type { RawFetch, RawImport } from "./extract.ts";
import { createFetchMatcher } from "./fetches.ts";
import { dedupeEdges, fanCounts } from "./graph.ts";
import { createPool, threadsFor, type Pool } from "./pool.ts";
import {
  SCHEMA_VERSION,
  type ConfigReport,
  type Coverage,
  type Edge,
  type ImportStatus,
  type ParseResult,
  type ParsedFile,
  type Route,
  type SkippedFile,
  type StatusCounts,
} from "./types.ts";
import type { Role } from "../roles.ts";
import type { AdapterFile } from "./adapters/types.ts";
import { walkRepository, withinProject, type CandidateFile, type WalkResult } from "./walk.ts";
import { newProject, type Job, type JobResult, type ResolveQuery } from "./work.ts";

export type Selection = { root: string; walk: WalkResult };

export function parseRepository(directory: string): Promise<ParseResult> {
  return parseSelection(selectFiles(directory));
}

// Selecting and parsing are separate calls so a caller can report which one
// it's in; together they are exactly parseRepository.
export function selectFiles(directory: string): Selection {
  const root = path.resolve(directory);
  if (!statSync(root, { throwIfNoEntry: false })?.isDirectory()) {
    throw new Error(`Not a directory: ${root}`);
  }
  return { root, walk: walkRepository(root) };
}

/**
 * Files are parsed this many at a time and then let go. A whole large
 * repository's syntax trees don't fit in memory; a batch's do, and the
 * program a batch needs for its diagnostics stays small.
 */
const BATCH = 400;

/** Imports go to the resolving threads this many at a time. */
const RESOLVE_CHUNK = 5000;

/** Everything later steps need from one parsed file. */
type Extracted = {
  candidate: CandidateFile;
  imports: RawImport[];
  exports: string[];
  complexity: number;
  fetches: RawFetch[];
  role: Role | null;
};

/** A file an adapter's route code may read, kept as text to be parsed again once every batch is done. */
type RouteSource = { candidate: CandidateFile; text: string };

// Reading each file and resolving each import are spread over worker threads
// (see pool.ts); everything that needs every file at once stays here. Every
// answer is put back in the order one thread would have produced it, so the
// result is the same however many threads ran.
export async function parseSelection(selection: Selection): Promise<ParseResult> {
  const pool = createPool(threadsFor(selection.walk.candidates.length, BATCH));
  try {
    return await parseWith(pool, selection);
  } finally {
    await pool.close();
  }
}

// A thread's answer has to be the kind that was asked for.
function mismatch(result: JobResult, asked: Job["type"]): Error {
  return new Error(`A parsing thread answered ${result.type} when asked to ${asked}`);
}
function outcomesOf(result: JobResult) {
  if (result.type !== "extract") throw mismatch(result, "extract");
  return result.outcomes;
}
function statusesOf(result: JobResult) {
  if (result.type !== "resolve") throw mismatch(result, "resolve");
  return result.statuses;
}
function reportsOf(result: JobResult) {
  if (result.type !== "configs") throw mismatch(result, "configs");
  return result.reports;
}

async function parseWith(pool: Pool, { root, walk }: Selection): Promise<ParseResult> {
  const skipped: SkippedFile[] = [...walk.skipped];
  const parsed: Extracted[] = [];
  const routeSources: RouteSource[] = [];

  const adapters = Object.fromEntries([...walk.adapters].map(([project, adapter]) => [project, adapter.name]));
  const batches: CandidateFile[][] = [];
  for (let start = 0; start < walk.candidates.length; start += BATCH) batches.push(walk.candidates.slice(start, start + BATCH));
  const extracted = await pool.map(batches.map((candidates): Job => ({ type: "extract", candidates, adapters })));

  batches.forEach((candidates, b) => {
    outcomesOf(extracted[b]).forEach((outcome, i) => {
      const candidate = candidates[i];
      if ("skipped" in outcome) {
        skipped.push(outcome.skipped);
        return;
      }
      const { imports, exports, complexity, fetches, role, routeText } = outcome;
      parsed.push({ candidate, imports, exports, complexity, fetches, role });
      if (routeText !== null) routeSources.push({ candidate, text: routeText });
    });
  });
  skipped.sort((a, b) => a.path.localeCompare(b.path));

  await pool.broadcast({
    type: "index",
    index: {
      root,
      nodes: parsed.map((entry) => entry.candidate.path),
      skipped,
      excludedDirectories: walk.excludedDirectories,
      workspacePackages: [...walk.workspacePackages],
    },
  });
  const queries: ResolveQuery[] = [];
  for (const { candidate, imports } of parsed) {
    for (const found of imports) if (found.literal) queries.push([candidate.absolutePath, found.specifier, found.kind]);
  }
  const resolveJobs: Job[] = [];
  for (let start = 0; start < queries.length; start += RESOLVE_CHUNK) {
    resolveJobs.push({ type: "resolve", queries: queries.slice(start, start + RESOLVE_CHUNK) });
  }
  const statuses = (await pool.map(resolveJobs)).flatMap((result) => statusesOf(result));
  if (statuses.length !== queries.length) throw new Error(`Resolved ${statuses.length} of ${queries.length} imports`);

  // Each thread read the configs its own files needed; together that's every one a single thread would have.
  const configs = new Map<string, ConfigReport>();
  for (const result of await pool.broadcast({ type: "configs" })) {
    for (const report of reportsOf(result)) configs.set(report.path, report);
  }

  const coverage: Coverage["imports"] = {
    total: emptyCounts(),
    byKind: { import: emptyCounts(), "re-export": emptyCounts(), "dynamic-import": emptyCounts(), require: emptyCounts() },
    external: { package: 0, builtin: 0, "outside-root": 0 },
    excluded: {},
    unresolvedByReason: {},
    unresolved: [],
  };
  const rawEdges: Edge[] = [];
  const fetchCalls: { from: string; call: RawFetch }[] = [];

  let answered = 0;
  for (const { candidate, imports, fetches } of parsed) {
    for (const call of fetches) fetchCalls.push({ from: candidate.path, call });
    for (const found of imports) {
      const specifier = found.literal ? found.specifier : found.expression;
      const outcome: ImportStatus = found.literal
        ? statuses[answered++]
        : {
            status: "unresolved",
            reason: found.kind === "require" ? "non-literal-require" : "non-literal-dynamic-import",
            detail: "the path is computed at runtime",
          };

      coverage.total.seen++;
      coverage.byKind[found.kind].seen++;
      coverage.total[outcome.status]++;
      coverage.byKind[found.kind][outcome.status]++;

      switch (outcome.status) {
        case "internal":
          rawEdges.push({
            source: candidate.path,
            target: outcome.target,
            kind: found.kind,
            typeOnly: found.typeOnly,
            specifier,
            line: found.line,
          });
          break;
        case "external":
          coverage.external[outcome.external]++;
          break;
        case "excluded":
          coverage.excluded[outcome.reason] = (coverage.excluded[outcome.reason] ?? 0) + 1;
          break;
        case "unresolved":
          coverage.unresolvedByReason[outcome.reason] = (coverage.unresolvedByReason[outcome.reason] ?? 0) + 1;
          coverage.unresolved.push({
            from: candidate.path,
            specifier,
            kind: found.kind,
            line: found.line,
            reason: outcome.reason,
            detail: outcome.detail,
          });
          break;
      }
    }
  }

  const importEdges = dedupeEdges(rawEdges);
  const paths = parsed.map((entry) => entry.candidate.path);
  // Fan-in and fan-out count imports only; a network call isn't loading the other file's code.
  const fan = fanCounts(paths, importEdges);
  const conventions = projectRoutes(walk, routeSources, skipped);

  // fetch() calls can only be matched once every route is known.
  const matchFetch = createFetchMatcher(conventions.routes);
  const fetches: Coverage["fetches"] = { seen: 0, matched: 0, external: 0, unresolvedByReason: {}, unresolved: [] };
  const fetchEdges: Edge[] = [];
  for (const { from, call } of fetchCalls) {
    fetches.seen++;
    const outcome = matchFetch(call);
    if (outcome.status === "external") {
      fetches.external++;
    } else if (outcome.status === "unresolved") {
      fetches.unresolvedByReason[outcome.reason] = (fetches.unresolvedByReason[outcome.reason] ?? 0) + 1;
      fetches.unresolved.push({ from, url: call.text, line: call.line, reason: outcome.reason, detail: outcome.detail });
    } else {
      fetches.matched++;
      fetchEdges.push({ source: from, target: outcome.target, kind: "fetch", typeOnly: false, specifier: call.text, line: call.line });
    }
  }
  const edges = dedupeEdges([...importEdges, ...fetchEdges]);
  const files: ParsedFile[] = parsed
    .map(({ candidate, exports, complexity, role }) => ({
      path: candidate.path,
      module: candidate.module,
      lines: candidate.lines,
      bytes: candidate.bytes,
      hash: candidate.hash,
      fanIn: fan.get(candidate.path)?.fanIn ?? 0,
      fanOut: fan.get(candidate.path)?.fanOut ?? 0,
      reachedBy: candidate.reachedBy,
      role,
      exports,
      complexity,
    }))
    .sort((a, b) => a.path.localeCompare(b.path));

  if (files.length + skipped.length !== walk.found) {
    throw new Error(`Coverage doesn't add up: found ${walk.found}, parsed ${files.length}, skipped ${skipped.length}`);
  }

  return {
    schemaVersion: SCHEMA_VERSION,
    root,
    projects: walk.projects,
    files,
    edges,
    routes: conventions.routes,
    coverage: {
      files: {
        found: walk.found,
        parsed: files.length,
        skipped: skipped.length,
        skippedFiles: skipped,
        excludedDirectories: walk.excludedDirectories,
      },
      imports: coverage,
      fetches,
      routes: { omitted: conventions.omitted, withheld: conventions.withheld },
    },
    configs: [...configs.values()].sort((a, b) => a.path.localeCompare(b.path)),
  };
}

// Each project's adapter gets the files its routeSource() kept, parsed again
// together now that every batch is done, and what it answers is mapped back to
// repository paths.
function projectRoutes(walk: WalkResult, routeSources: readonly RouteSource[], skipped: readonly SkippedFile[]) {
  const project = newProject();
  const routes: Route[] = [];
  const omitted: Coverage["routes"]["omitted"] = [];
  const withheld: Coverage["routes"]["withheld"] = [];

  for (const [name, adapter] of walk.adapters) {
    const toRepo = (p: string) => (name === "." ? p : `${name}/${p}`);
    const files: AdapterFile[] = routeSources
      .filter(({ candidate }) => candidate.project === name)
      .map(({ candidate, text }) => ({
        path: withinProject(name, candidate.path),
        source: project.createSourceFile(candidate.absolutePath, text, { overwrite: true }),
      }));
    // A declaration file has no runtime code, so it can't hold anything an adapter reads.
    const unparsed = skipped
      .filter((f) => f.reason !== "declaration-file" && walk.projectOf.get(f.path) === name)
      .map((f) => withinProject(name, f.path));

    const report = adapter.routes({ files, unparsed });
    if (report.withheld !== null) {
      withheld.push({ project: name, reason: report.withheld });
      continue;
    }
    for (const r of report.routes) routes.push({ file: toRepo(r.path), method: r.method, pattern: r.pattern, line: r.line });
    for (const o of report.omitted) omitted.push({ file: toRepo(o.path), line: o.line, reason: o.reason });
  }

  // An array of paths on a decorator can name the same one twice.
  const unique = new Map(routes.map((r) => [`${r.method} ${r.pattern} ${r.file}`, r]));
  return {
    routes: [...unique.values()].sort(
      (a, b) => a.pattern.localeCompare(b.pattern) || a.method.localeCompare(b.method) || a.file.localeCompare(b.file),
    ),
    omitted: omitted.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line),
    withheld,
  };
}

function emptyCounts(): StatusCounts {
  return { seen: 0, internal: 0, external: 0, excluded: 0, unresolved: 0 };
}

export type * from "./types.ts";
