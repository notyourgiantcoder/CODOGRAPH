import { MODEL_ROLES } from "../roles.ts";
import type { EdgeKind } from "../parser/types.ts";

// What each task hands the model, and the words it's handed in. Everything a
// prompt mentions is in these inputs, and every path in them came from the
// parser's stored files and edges. The model is never asked to find a
// connection, only to explain the ones it's given.

// Bump when a prompt's wording changes: it's part of every cache key, so old
// answers stop matching rather than being served for a question no longer asked.
export const PROMPT_VERSION = 1;

export type NeighbourFacts = {
  path: string;
  /** Convention's role, or the model's label; null when neither has one. */
  role: string | null;
  exports: string[];
  kinds: EdgeKind[];
  typeOnly: boolean;
};

export type FileInput = {
  path: string;
  /** sha256 of the parsed contents: the source is keyed by this, not sent in the key. */
  hash: string;
  role: string | null;
  reachedBy: string | null;
  exports: string[];
  /** Every file it imports, sorted by path. */
  imports: NeighbourFacts[];
  /** Every file importing it, sorted by path. */
  importedBy: NeighbourFacts[];
};

export type FolderFile = { path: string; hash: string; role: string | null; exports: string[]; fanIn: number; fanOut: number };

export type FolderInput = {
  dir: string;
  /** Every file folded into the folder, sorted by path. */
  files: FolderFile[];
  /** Distinct outside → inside imports, sorted. */
  incoming: { from: string; to: string }[];
  /** Distinct inside → outside imports, sorted. */
  outgoing: { from: string; to: string }[];
};

export type ClassifyInput = {
  path: string;
  hash: string;
  exports: string[];
  imports: { path: string; role: string | null }[];
  importedBy: { path: string; role: string | null }[];
};

// The pane is narrow: headings would cut a few short paragraphs into labelled
// fragments. Forbidding formatting outright doesn't hold, so a small subset is
// permitted and the pane renders exactly that subset.
const FORMAT = `Formatting: plain paragraphs. You may use only three kinds of formatting: inline code in backticks, bullet lists with lines starting "- ", and bold with **double asterisks**. No headings, numbered lists, tables, links, italics or code blocks.`;

const HONESTY = `The lists of imports and importers were resolved by a parser and are complete: they are the only connections that exist. Never mention a file that isn't named in the input, and never suggest a connection the input doesn't list. Write every repository path in full, exactly as given, inside backticks. Describe what the code does; don't grade it, rate it, or suggest improvements.`;

export const EXPLAIN_FILE_SYSTEM = `You explain one file of a TypeScript or JavaScript repository to a developer reading the repository for the first time.

You're given the file's source, and every file it imports and every file that imports it, each with its role and the names it exports. Say what this file does and what part it plays between the files that depend on it and the files it depends on. Two or three short paragraphs; a short bullet list only if it genuinely helps. Refer to neighbours by path where it helps the reader, not as an exhaustive inventory.

${HONESTY}

${FORMAT}`;

export const EXPLAIN_FOLDER_SYSTEM = `You explain one folder of a TypeScript or JavaScript repository to a developer reading the repository for the first time.

The question is about the folder as a whole, not any single file in it: what kind of code lives here and what the files have in common, and why files outside point at it, meaning which of its files are imported from outside and what imports them. If little or nothing outside imports it, say so and say what it depends on instead. Two or three short paragraphs; a short bullet list only if it genuinely helps.

${HONESTY}

${FORMAT}`;

export const CLASSIFY_SYSTEM = `You label one file of a TypeScript or JavaScript repository that no framework convention identified. Choose the single role that best describes it from: ${MODEL_ROLES.join(", ")}. Answer "none" if none of them clearly fits. Use its path, the names it exports, its source, and the roles of the files around it. Answer only with the JSON the schema asks for.`;

export function explainFileMessage(input: FileInput, source: string): string {
  return [
    `File: ${input.path}`,
    `Role: ${input.role ?? "not identified"}`,
    input.reachedBy ? `Also reached by: ${input.reachedBy}` : null,
    `Exports: ${input.exports.length ? input.exports.join(", ") : "nothing named"}`,
    "",
    `It imports ${input.imports.length} ${input.imports.length === 1 ? "file" : "files"}:`,
    ...neighbourLines(input.imports),
    "",
    `It is imported by ${input.importedBy.length} ${input.importedBy.length === 1 ? "file" : "files"}:`,
    ...neighbourLines(input.importedBy),
    "",
    `Source of ${input.path}:`,
    "<<<",
    source,
    ">>>",
  ]
    .filter((line) => line !== null)
    .join("\n");
}

/** Past this many files a folder is summarised: listing them all would run past what a model reads. */
export const FOLDER_LISTED_FILES = 150;
const FOLDER_TOP_FILES = 60;
const FOLDER_TOP_PAIRS = 40;

export function explainFolderMessage(input: FolderInput): string {
  if (input.files.length > FOLDER_LISTED_FILES) return summarisedFolderMessage(input);
  const importers = new Map<string, number>();
  for (const e of input.incoming) importers.set(e.to, (importers.get(e.to) ?? 0) + 1);
  const outside = new Set(input.incoming.map((e) => e.from));
  return [
    `Folder: ${input.dir === "." ? "(repository root)" : `${input.dir}/`}`,
    `${input.files.length} ${input.files.length === 1 ? "file" : "files"}, ${outside.size} outside ${outside.size === 1 ? "file imports" : "files import"} into it.`,
    "",
    "Files in it (role; exports; imported by N files anywhere; imports N files):",
    ...input.files.map(
      (f) =>
        `- ${f.path} (${f.role ?? "no role"}; ${f.exports.length ? f.exports.join(", ") : "no named exports"}; imported by ${f.fanIn}; imports ${f.fanOut}${importers.has(f.path) ? `; ${importers.get(f.path)} of its importers are outside the folder` : ""})`,
    ),
    "",
    `Imports into it from outside (${input.incoming.length}):`,
    ...(input.incoming.length ? input.incoming.map((e) => `- ${e.from} → ${e.to}`) : ["- none"]),
    "",
    `Imports from it to outside (${input.outgoing.length}):`,
    ...(input.outgoing.length ? input.outgoing.map((e) => `- ${e.from} → ${e.to}`) : ["- none"]),
  ].join("\n");
}

// A big folder in counts: its subfolders, its most-imported files, and the
// imports across its edge totalled by the folder at the other end. It says
// outright that the lists are cut short, so they're never read as complete.
function summarisedFolderMessage(input: FolderInput): string {
  const below = (path: string) => (input.dir === "." ? path : path.slice(input.dir.length + 1));
  const subfolders = new Map<string, number>();
  for (const f of input.files) {
    const rest = below(f.path);
    const key = rest.includes("/") ? `${rest.slice(0, rest.indexOf("/"))}/` : "(directly in it)";
    subfolders.set(key, (subfolders.get(key) ?? 0) + 1);
  }
  const top = [...input.files].sort((a, b) => b.fanIn - a.fanIn || a.path.localeCompare(b.path)).slice(0, FOLDER_TOP_FILES);
  const folderOf = (path: string) => (path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "(repository root)");
  const totals = (pairs: { from: string; to: string }[], side: "from" | "to") => {
    const counts = new Map<string, number>();
    for (const e of pairs) counts.set(folderOf(e[side]), (counts.get(folderOf(e[side])) ?? 0) + 1);
    return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  };
  const into = totals(input.incoming, "from");
  const outOf = totals(input.outgoing, "to");
  const outside = new Set(input.incoming.map((e) => e.from));
  return [
    `Folder: ${input.dir === "." ? "(repository root)" : `${input.dir}/`}`,
    `${input.files.length} files, ${outside.size} outside ${outside.size === 1 ? "file imports" : "files import"} into it.`,
    `It's too big to list every file, so the lists below are cut short and say how much they leave out. Don't treat them as complete.`,
    "",
    "Where its files sit (subfolder: files):",
    ...[...subfolders].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([dir, n]) => `- ${dir} ${n}`),
    "",
    `Its ${top.length} most-imported files of ${input.files.length} (role; exports; imported by N files anywhere; imports N files):`,
    ...top.map(
      (f) =>
        `- ${f.path} (${f.role ?? "no role"}; ${f.exports.length ? f.exports.slice(0, 12).join(", ") + (f.exports.length > 12 ? `, and ${f.exports.length - 12} more` : "") : "no named exports"}; imported by ${f.fanIn}; imports ${f.fanOut})`,
    ),
    "",
    `Imports into it from outside: ${input.incoming.length}, by the folder they come from (the top ${Math.min(FOLDER_TOP_PAIRS, into.length)} of ${into.length}):`,
    ...(into.length ? into.slice(0, FOLDER_TOP_PAIRS).map(([dir, n]) => `- ${dir}: ${n}`) : ["- none"]),
    "",
    `Imports from it to outside: ${input.outgoing.length}, by the folder they go to (the top ${Math.min(FOLDER_TOP_PAIRS, outOf.length)} of ${outOf.length}):`,
    ...(outOf.length ? outOf.slice(0, FOLDER_TOP_PAIRS).map(([dir, n]) => `- ${dir}: ${n}`) : ["- none"]),
  ].join("\n");
}

export function classifyMessage(input: ClassifyInput, excerpt: string): string {
  const line = (n: { path: string; role: string | null }) => `- ${n.path}${n.role ? ` (${n.role})` : ""}`;
  return [
    `File: ${input.path}`,
    `Exports: ${input.exports.length ? input.exports.join(", ") : "nothing named"}`,
    `Imports:`,
    ...(input.imports.length ? input.imports.map(line) : ["- none"]),
    `Imported by:`,
    ...(input.importedBy.length ? input.importedBy.map(line) : ["- none"]),
    "",
    "Start of its source:",
    "<<<",
    excerpt,
    ">>>",
  ].join("\n");
}

function neighbourLines(list: NeighbourFacts[]): string[] {
  if (list.length === 0) return ["- none"];
  return list.map((n) => {
    const marks = [
      n.role ?? "no role",
      n.exports.length ? `exports ${n.exports.join(", ")}` : "no named exports",
      ...n.kinds.filter((k) => k !== "import"),
      ...(n.typeOnly ? ["types only"] : []),
    ];
    return `- ${n.path} (${marks.join("; ")})`;
  });
}
