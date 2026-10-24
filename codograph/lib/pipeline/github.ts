import { execFile } from "node:child_process";
import { lstat, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import type { Stats } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { x as extract, type ReadEntry } from "tar";
import { CODE_EXTENSIONS, isCodeFile } from "../parser/walk.ts";

export type Repository = { owner: string; name: string };

// Past this the archive isn't downloaded at all. There's no queue or worker to
// hand a huge repository to, so the limit is stated rather than engineered round.
// It's this high because only code and JSON reach the disk (see keepsContents).
export const MAX_ARCHIVE_BYTES = 500 * 1024 * 1024;

// A hung request would otherwise hold the run in its stage until it goes stale.
// The archive's limit covers streaming the whole body, so it's far longer.
const API_TIMEOUT_MS = 15_000;
const ARCHIVE_TIMEOUT_MS = 10 * 60_000;

// The message is written for the person who pasted the URL, and is what the
// failed row shows.
export class PipelineError extends Error {
  override name = "PipelineError";
}

const NAME = /^[A-Za-z0-9_.-]+$/;

// Accepts what people paste: a github.com URL (with or without scheme, .git,
// or a trailing /tree/...), or owner/name. Lowercased because GitHub names are
// case-insensitive, and one repository must be one row however it's typed.
export function parseRepositoryUrl(input: string): Repository {
  const trimmed = input.trim();
  const bare = trimmed.match(/^([^/\s]+)\/([^/\s]+)$/);
  let owner: string | undefined;
  let name: string | undefined;
  if (bare && !bare[1].includes(".")) {
    [, owner, name] = bare;
  } else {
    let url: URL;
    try {
      url = new URL(/^[a-z]+:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
    } catch {
      throw new PipelineError(`"${trimmed}" isn't a GitHub repository URL`);
    }
    if (url.hostname !== "github.com" && url.hostname !== "www.github.com") {
      throw new PipelineError(`Only github.com repositories can be analysed, not ${url.hostname}`);
    }
    [owner, name] = url.pathname.split("/").filter(Boolean);
  }
  name = name?.replace(/\.git$/, "");
  if (!owner || !name || !NAME.test(owner) || !NAME.test(name)) {
    throw new PipelineError(`"${trimmed}" doesn't name a repository; expected github.com/owner/name`);
  }
  return { owner: owner.toLowerCase(), name: name.toLowerCase() };
}

// The commit is resolved first and the archive fetched at exactly that commit,
// so the recorded sha is the code that was parsed, not whatever HEAD became
// while the download ran. Unauthenticated: no token is asked for or stored.
export async function resolveHeadCommit({ owner, name }: Repository): Promise<string> {
  const response = await withTimeout(`Asking GitHub for ${owner}/${name}'s latest commit`, API_TIMEOUT_MS, () =>
    fetch(`https://api.github.com/repos/${owner}/${name}/commits/HEAD`, {
      headers: { Accept: "application/vnd.github.sha", "User-Agent": "cartograph" },
      signal: AbortSignal.timeout(API_TIMEOUT_MS),
    }),
  );
  if (response.ok) {
    const sha = (await withTimeout(`Asking GitHub for ${owner}/${name}'s latest commit`, API_TIMEOUT_MS, () => response.text())).trim();
    if (!/^[0-9a-f]{40}$/.test(sha)) throw new PipelineError(`GitHub returned an unexpected commit for ${owner}/${name}`);
    return sha;
  }
  if (response.status === 404) {
    throw new PipelineError(`${owner}/${name} doesn't exist on GitHub, or it isn't public`);
  }
  if (response.status === 409 || response.status === 422) {
    throw new PipelineError(`${owner}/${name} has no commits to analyse`);
  }
  if ((response.status === 403 || response.status === 429) && response.headers.get("x-ratelimit-remaining") === "0") {
    const reset = Number(response.headers.get("x-ratelimit-reset"));
    const when = Number.isFinite(reset) ? ` until ${new Date(reset * 1000).toISOString()}` : "";
    throw new PipelineError(`GitHub's unauthenticated rate limit is used up${when}`);
  }
  throw new PipelineError(`GitHub answered ${response.status} when asked for ${owner}/${name}'s latest commit`);
}

// One file's bytes at one commit, or null when the file isn't there at that
// commit. raw.githubusercontent.com serves the committed bytes, so their
// sha256 is comparable with the hash the parser stored.
export async function fetchFileAt({ owner, name }: Repository, sha: string, filePath: string): Promise<Buffer | null> {
  const what = `Fetching ${filePath} from ${owner}/${name} at ${sha.slice(0, 7)}`;
  const encoded = filePath.split("/").map(encodeURIComponent).join("/");
  const response = await withTimeout(what, API_TIMEOUT_MS, () =>
    fetch(`https://raw.githubusercontent.com/${owner}/${name}/${sha}/${encoded}`, {
      headers: { "User-Agent": "cartograph" },
      signal: AbortSignal.timeout(API_TIMEOUT_MS),
    }),
  );
  if (response.status === 404) return null;
  if (!response.ok) throw new PipelineError(`${what} failed: GitHub answered ${response.status}`);
  return Buffer.from(await withTimeout(what, API_TIMEOUT_MS, () => response.arrayBuffer()));
}

// The parser reads code files, and JSON for package.json and tsconfig. Every
// other file is still written, empty, because an import of ./logo.png has to
// find a file there to be reported as a non-code target rather than as
// missing. Images, videos and fixtures are most of a big archive's bytes.
function keepsContents(entryPath: string): boolean {
  return isCodeFile(entryPath) || entryPath.endsWith(".json");
}

// Streams the archive straight into the directory, dropping GitHub's
// "<owner>-<name>-<sha>/" wrapper folder. tar refuses absolute paths and "..",
// so nothing lands outside it.
export async function downloadArchive({ owner, name }: Repository, sha: string, directory: string): Promise<number> {
  const what = `Downloading the archive for ${owner}/${name}`;
  // One signal for the request and the body, so the limit is on the whole download.
  const signal = AbortSignal.timeout(ARCHIVE_TIMEOUT_MS);
  const response = await withTimeout(what, ARCHIVE_TIMEOUT_MS, () =>
    fetch(`https://codeload.github.com/${owner}/${name}/tar.gz/${sha}`, { headers: { "User-Agent": "cartograph" }, signal }),
  );
  if (!response.ok || !response.body) {
    throw new PipelineError(`Downloading the archive for ${owner}/${name} failed: GitHub answered ${response.status}`);
  }
  const declared = Number(response.headers.get("content-length"));
  if (declared > MAX_ARCHIVE_BYTES) throw tooLarge(owner, name);

  // content-length isn't always sent, so the limit is enforced on the bytes too.
  let received = 0;
  const limit = new Transform({
    transform(chunk: Buffer, _encoding, done) {
      received += chunk.byteLength;
      done(received > MAX_ARCHIVE_BYTES ? tooLarge(owner, name) : null, chunk);
    },
  });
  const body = response.body;
  const emptied: string[] = [];
  const filter = (entryPath: string, entry: ReadEntry | Stats) => {
    if (!("type" in entry)) return true;
    if (entry.type !== "File" && entry.type !== "OldFile" && entry.type !== "ContiguousFile") return true;
    if (keepsContents(entryPath)) return true;
    // The same wrapper folder strip: 1 drops from what tar writes.
    const relative = entryPath.split("/").slice(1).join("/");
    if (relative) emptied.push(relative);
    return false;
  };
  await withTimeout(what, ARCHIVE_TIMEOUT_MS, () => pipeline(Readable.from(chunks(body)), limit, extract({ cwd: directory, strip: 1, filter })));
  await writeEmpty(directory, emptied);
  return received;
}

// tar's own path checks don't cover what's written outside it, so the same
// refusals are made here: no absolute path or "..", and no folder on the way
// that is a link, since a link in the repository could point anywhere.
async function writeInside(
  directory: string,
  relativePaths: readonly string[],
  write: (target: string) => Promise<void>,
): Promise<void> {
  const root = path.resolve(directory);
  const checked = new Set<string>();
  for (const relative of relativePaths) {
    const parts = relative.split("/");
    if (path.isAbsolute(relative) || parts.some((part) => part === "" || part === "." || part === "..")) continue;
    let at = root;
    let safe = true;
    for (const part of parts.slice(0, -1)) {
      at = path.join(at, part);
      if (checked.has(at)) continue;
      const stat = await lstat(at).catch(() => null);
      if (!stat) await mkdir(at);
      else if (!stat.isDirectory()) {
        safe = false;
        break;
      }
      checked.add(at);
    }
    if (safe) await write(path.join(at, parts[parts.length - 1]));
  }
}

// Whatever is already at that path wins over a placeholder.
const ignoreExisting = (error: NodeJS.ErrnoException) => {
  if (error.code !== "EEXIST") throw error;
};

function writeEmpty(directory: string, relativePaths: readonly string[]): Promise<void> {
  return writeInside(directory, relativePaths, (target) => writeFile(target, "", { flag: "wx" }).catch(ignoreExisting));
}

const git = promisify(execFile);

// Git with no settings but these: the person's own config (autocrlf, hooks,
// credentials) can't change what lands on disk, and it never stops to ask
// for a password.
const GIT_ENV = { ...process.env, GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_GLOBAL: "/dev/null", GIT_TERMINAL_PROMPT: "0" };

const CODE_PATTERNS = [...CODE_EXTENSIONS, ".json"].map((ext) => `*${ext}`);

// A sparse-checkout line naming exactly one path; every character
// gitignore treats specially is escaped.
function exactPattern(relative: string): string {
  return `/${relative.replace(/[\\*?[\]!# ]/g, (c) => `\\${c}`)}`;
}

/**
 * The repository at one commit, as downloadArchive leaves it, but fetched
 * with git: only the code and JSON files' contents cross the network, so
 * images and videos cost nothing. The git data is kept outside the directory
 * the parser walks. Throws when git isn't installed or can't fetch.
 */
export async function cloneCode({ owner, name }: Repository, sha: string, directory: string): Promise<void> {
  const gitDir = await mkdtemp(path.join(tmpdir(), "cartograph-git-"));
  const deadline = Date.now() + ARCHIVE_TIMEOUT_MS;
  const run = async (args: string[]) => {
    const timeout = deadline - Date.now();
    if (timeout <= 0) throw new PipelineError(`Fetching ${owner}/${name} with git took longer than ${ARCHIVE_TIMEOUT_MS / 1000} seconds`);
    const env = { ...GIT_ENV, GIT_DIR: gitDir, GIT_WORK_TREE: directory };
    return (await git("git", args, { env, timeout, maxBuffer: 512 * 1024 * 1024 })).stdout;
  };
  try {
    await run(["init", "-q"]);
    await run(["fetch", "-q", "--depth", "1", "--filter=blob:none", `https://github.com/${owner}/${name}.git`, sha]);

    const tree = (await run(["ls-tree", "-r", "-z", "--full-tree", "FETCH_HEAD"])).split("\0").filter(Boolean);
    const links: string[] = [];
    const submodules: string[] = [];
    const emptied: string[] = [];
    for (const line of tree) {
      const tab = line.indexOf("\t");
      const mode = line.slice(0, line.indexOf(" "));
      const entryPath = line.slice(tab + 1);
      if (mode === "120000") links.push(entryPath);
      else if (mode === "160000") submodules.push(entryPath);
      else if (!keepsContents(entryPath)) emptied.push(entryPath);
    }

    // Code by extension, and each link by its path, since tar recreates links whatever they're named.
    await run(["config", "core.sparseCheckout", "true"]);
    await run(["config", "core.sparseCheckoutCone", "false"]);
    await mkdir(path.join(gitDir, "info"), { recursive: true });
    await writeFile(path.join(gitDir, "info", "sparse-checkout"), [...CODE_PATTERNS, ...links.map(exactPattern)].join("\n") + "\n");
    await run(["checkout", "-q", "--force", "FETCH_HEAD"]);

    // An archive holds a submodule as an empty folder, and every other file as itself.
    await writeInside(directory, submodules, (target) => mkdir(target).catch(ignoreExisting));
    await writeEmpty(directory, emptied);
  } finally {
    await rm(gitDir, { recursive: true, force: true });
  }
}

/**
 * Puts the repository at one commit into the directory: with git when it's
 * there, since that skips every file the parser doesn't read, otherwise from
 * GitHub's archive. Either way the directory holds the same paths and bytes.
 */
export async function downloadRepository(repository: Repository, sha: string, directory: string): Promise<"git" | "archive"> {
  try {
    await cloneCode(repository, sha, directory);
    return "git";
  } catch (error) {
    // The archive starts from an empty directory, not a half-finished checkout.
    console.warn(`git couldn't fetch ${repository.owner}/${repository.name}, downloading the archive instead:`, error instanceof Error ? error.message : error);
    await rm(directory, { recursive: true, force: true });
    await mkdir(directory);
    await downloadArchive(repository, sha, directory);
    return "archive";
  }
}

// An aborted fetch throws a bare "TimeoutError"; the failed row should say what timed out.
async function withTimeout<T>(what: string, ms: number, run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") {
      throw new PipelineError(`${what} took longer than ${ms / 1000} seconds, so it was stopped`, { cause: error });
    }
    throw error;
  }
}

// Read through the reader rather than Readable.fromWeb: the app's DOM types
// and Node's stream types disagree about the body, and this needs no cast.
async function* chunks(body: ReadableStream<Uint8Array>): AsyncGenerator<Uint8Array> {
  const reader = body.getReader();
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) return;
      yield value;
    }
  } finally {
    reader.releaseLock();
  }
}

function tooLarge(owner: string, name: string): PipelineError {
  return new PipelineError(`${owner}/${name}'s archive is over ${MAX_ARCHIVE_BYTES / 1024 / 1024} MB, the most this can analyse`);
}
