import { readFileSync } from "node:fs";
import { Project, ts, type SourceFile } from "ts-morph";
import { adapterNamed } from "./adapters/index.ts";
import type { FrameworkAdapter } from "./adapters/types.ts";
import { complexity } from "./complexity.ts";
import {
  exportsOnlyTypes,
  extractExports,
  extractFetches,
  extractImports,
  scanFile,
  type RawFetch,
  type RawImport,
  type Scan,
} from "./extract.ts";
import { createResolver, type Resolver } from "./resolve.ts";
import type { ConfigReport, EdgeKind, ExcludedDirectory, ImportStatus, SkippedFile } from "./types.ts";
import { withinProject, type CandidateFile } from "./walk.ts";
import { folderNameRole, type Role } from "../roles.ts";

// The two parts of parsing that look at one file at a time: reading a file's
// syntax, and resolving one import. Neither depends on any other file's
// answer, so they can run on several threads at once. Everything here takes
// and returns plain data, so a worker thread and the parser's own thread run
// exactly the same code.

/** What one file gave. Plain data: no syntax tree survives its batch. */
export type FileOutcome =
  | { skipped: SkippedFile }
  | {
      imports: RawImport[];
      exports: string[];
      complexity: number;
      fetches: RawFetch[];
      role: Role | null;
      /** The file's text when an adapter's route code may read it, to be parsed again once every batch is done. */
      routeText: string | null;
    };

/** One literal import to resolve: from which file, what it names, how. */
export type ResolveQuery = [fromAbsolute: string, specifier: string, kind: EdgeKind];

/** The repository as resolution sees it, in a form that can cross to another thread. */
export type IndexData = {
  root: string;
  nodes: string[];
  skipped: SkippedFile[];
  excludedDirectories: ExcludedDirectory[];
  workspacePackages: string[];
};

export type Job =
  | { type: "extract"; candidates: CandidateFile[]; adapters: Record<string, string> }
  | { type: "index"; index: IndexData }
  | { type: "resolve"; queries: ResolveQuery[] }
  | { type: "configs" };

// Tagged, so the parser can check it got back the kind of answer it asked for.
export type JobResult =
  | { type: "extract"; outcomes: FileOutcome[] }
  | { type: "index" }
  | { type: "resolve"; statuses: ImportStatus[] }
  | { type: "configs"; reports: ConfigReport[] };

// Parsing only: no lib, no type resolution. Imports are resolved separately
// so every outcome can be classified rather than left to the compiler. The
// text is handed over already read, so ts-morph is given a file system of its
// own: on the real one it checks every folder a file sits in, which was half
// the time spent parsing.
export function newProject(): Project {
  return new Project({
    useInMemoryFileSystem: true,
    skipAddingFilesFromTsConfig: true,
    skipFileDependencyResolution: true,
    compilerOptions: { allowJs: true, noLib: true, noResolve: true, types: [] },
  });
}

// The framework's conventions decide first. A file none of them names gets
// Types when everything it exports is a type, then whatever its folder's name
// says. All three read facts off the file; none of them guesses at intent.
function roleOf(adapter: FrameworkAdapter, path: string, source: SourceFile, scan: Scan): Role | null {
  return adapter.roleOf({ path, source }) ?? (exportsOnlyTypes(source, scan) ? "types" : folderNameRole(path));
}

// The walk read the file once to measure it and let the text go. If it isn't
// the same size now, something changed it mid-parse, and what was walked
// can't be trusted to describe it.
function readSource(candidate: CandidateFile): string {
  const buffer = readFileSync(candidate.absolutePath);
  if (buffer.byteLength !== candidate.bytes) {
    throw new Error(`${candidate.path} changed while it was being parsed (${candidate.bytes} bytes walked, ${buffer.byteLength} now)`);
  }
  return buffer.toString("utf8");
}

// The batch's syntax errors, from a program over the trees already parsed.
// A JavaScript file's errors include TypeScript-only syntax used in it, which
// only a program reports, so a program is still what's asked. noResolve still
// resolves every import while the program is built, which cost more than
// parsing the files; syntax doesn't depend on where an import points, so here
// nothing resolves. (Imports are resolved properly in resolve.ts.)
function syntaxProgram(files: readonly ts.SourceFile[]): ts.Program {
  const byName = new Map(files.map((file) => [file.fileName, file]));
  const host: ts.CompilerHost = {
    getSourceFile: (name) => byName.get(name),
    fileExists: (name) => byName.has(name),
    readFile: () => undefined,
    writeFile: () => {},
    getDefaultLibFileName: () => "lib.d.ts",
    getCurrentDirectory: () => "/",
    getCanonicalFileName: (name) => name,
    useCaseSensitiveFileNames: () => true,
    getNewLine: () => "\n",
    resolveModuleNameLiterals: (literals) => literals.map(() => ({ resolvedModule: undefined })),
    resolveTypeReferenceDirectiveReferences: (references) => references.map(() => ({ resolvedTypeReferenceDirective: undefined })),
  };
  return ts.createProgram({ rootNames: [...byName.keys()], options: { allowJs: true, noLib: true, noResolve: true, types: [] }, host });
}

// Counted the way ts-morph numbered a diagnostic's line, by "\n" alone, so a
// skipped file's reported line is unchanged.
function lineAt(text: string, position: number): number {
  let line = 1;
  for (let at = text.indexOf("\n"); at !== -1 && at < position; at = text.indexOf("\n", at + 1)) line++;
  return line;
}

/** One batch of files, in the order given. `adapters` names each project's adapter. */
export function extractBatch(candidates: readonly CandidateFile[], adapters: Record<string, string>): FileOutcome[] {
  const project = newProject();
  const batch = candidates.map((candidate) => {
    const text = readSource(candidate);
    return { candidate, text, sourceFile: project.createSourceFile(candidate.absolutePath, text, { overwrite: true }) };
  });
  const program = syntaxProgram(batch.map(({ sourceFile }) => sourceFile.compilerNode));

  return batch.map(({ candidate, text, sourceFile }): FileOutcome => {
    const [first, ...rest] = program.getSyntacticDiagnostics(sourceFile.compilerNode);
    if (first) {
      // A file that doesn't parse cleanly would give a partial import list. Absent beats approximate.
      const message = ts.flattenDiagnosticMessageText(first.messageText, " ");
      return {
        skipped: {
          path: candidate.path,
          reason: "syntax-error",
          detail: `line ${first.start === undefined ? "?" : lineAt(text, first.start)}: ${message}${rest.length ? ` (+${rest.length} more)` : ""}`,
        },
      };
    }
    const name = adapters[candidate.project];
    if (name === undefined) throw new Error(`No adapter for project ${candidate.project}`);
    const adapter = adapterNamed(name);
    // Asked by project-relative path, as every adapter question is.
    const local = withinProject(candidate.project, candidate.path);
    const scan = scanFile(sourceFile);
    return {
      imports: extractImports(sourceFile, scan),
      exports: extractExports(sourceFile, scan),
      complexity: complexity(sourceFile),
      fetches: extractFetches(scan),
      role: roleOf(adapter, local, sourceFile, scan),
      routeText: adapter.routeSource(local, text) ? text : null,
    };
  });
}

/** Runs jobs in order against one thread's resolver. */
export function createHandler(): (job: Job) => JobResult {
  let resolver: Resolver | null = null;
  const ready = (): Resolver => {
    if (!resolver) throw new Error("Imports were sent to resolve before the repository index");
    return resolver;
  };
  return (job) => {
    switch (job.type) {
      case "extract":
        return { type: "extract", outcomes: extractBatch(job.candidates, job.adapters) };
      case "index":
        resolver = createResolver({
          root: job.index.root,
          nodes: new Set(job.index.nodes),
          skipped: new Map(job.index.skipped.map((file) => [file.path, file])),
          excludedDirectories: job.index.excludedDirectories,
          workspacePackages: new Set(job.index.workspacePackages),
        });
        return { type: "index" };
      case "resolve": {
        const r = ready();
        return { type: "resolve", statuses: job.queries.map(([from, specifier, kind]) => r.resolve(from, specifier, kind)) };
      }
      case "configs":
        return { type: "configs", reports: ready().configs() };
    }
  };
}
