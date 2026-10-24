import { existsSync } from "node:fs";
import { availableParallelism } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Worker } from "node:worker_threads";
import { createHandler, type Job, type JobResult } from "./work.ts";

export type Reply = { id: number; result: JobResult } | { id: number; error: string };

export type Pool = {
  /** Each job goes to whichever thread is free next. Results come back in the order the jobs were given. */
  map(jobs: readonly Job[]): Promise<JobResult[]>;
  /** Every thread runs the job once. */
  broadcast(job: Job): Promise<JobResult[]>;
  close(): Promise<void>;
};

// Measured on a 34,000-file repository: two threads halve the time of one,
// and a third adds memory without adding speed, since every thread's garbage
// collection competes for the same cores.
const MAX_THREADS = 2;

// Started from the source file rather than through the app's bundler: Node
// runs TypeScript itself, and the parser already runs from plain scripts.
// The path is joined rather than written as new URL("./worker.ts",
// import.meta.url): the bundler copies a file named that way out as a public
// asset, where it can't import its neighbours. Where the source isn't on
// disk, such as a bundled deployment, parsing stays on one thread.
const WORKER_FILE = import.meta.url.startsWith("file:") ? path.join(path.dirname(fileURLToPath(import.meta.url)), "worker.ts") : "";

/** Threads for a parse of this many files: one when a single batch would leave the others nothing to do. */
export function threadsFor(files: number, batch: number): number {
  if (files <= batch || !WORKER_FILE || !existsSync(WORKER_FILE)) return 1;
  return Math.max(1, Math.min(MAX_THREADS, availableParallelism() - 1, Math.ceil(files / batch)));
}

export function createPool(threads: number): Pool {
  return threads > 1 ? workerPool(threads) : localPool();
}

// The parser's own thread, handing control back between jobs so the app's
// server can answer other requests during a long parse.
function localPool(): Pool {
  const handle = createHandler();
  const run = async (job: Job) => {
    const result = handle(job);
    await new Promise((resume) => setImmediate(resume));
    return result;
  };
  return {
    map: async (jobs) => {
      const results: JobResult[] = [];
      for (const job of jobs) results.push(await run(job));
      return results;
    },
    broadcast: async (job) => [await run(job)],
    close: async () => {},
  };
}

type Pending = { resolve: (result: JobResult) => void; reject: (error: Error) => void };

function workerPool(size: number): Pool {
  let nextId = 0;
  const threads = Array.from({ length: size }, () => {
    const worker = new Worker(WORKER_FILE);
    const pending = new Map<number, Pending>();
    const failAll = (error: Error) => {
      for (const p of pending.values()) p.reject(error);
      pending.clear();
    };
    worker.on("message", (reply: Reply) => {
      const waiting = pending.get(reply.id);
      if (!waiting) return;
      pending.delete(reply.id);
      if ("error" in reply) waiting.reject(new Error(`A parsing thread failed: ${reply.error}`));
      else waiting.resolve(reply.result);
    });
    worker.on("error", (error) => failAll(new Error(`A parsing thread stopped: ${error.message}`, { cause: error })));
    worker.on("exit", (code) => failAll(new Error(`A parsing thread exited with code ${code}`)));
    return { worker, pending };
  });

  const send = (thread: (typeof threads)[number], job: Job) =>
    new Promise<JobResult>((resolve, reject) => {
      const id = nextId++;
      thread.pending.set(id, { resolve, reject });
      thread.worker.postMessage({ id, job });
    });

  return {
    map: async (jobs) => {
      const results: JobResult[] = new Array(jobs.length);
      let next = 0;
      await Promise.all(
        threads.map(async (thread) => {
          while (next < jobs.length) {
            const i = next++;
            results[i] = await send(thread, jobs[i]);
          }
        }),
      );
      return results;
    },
    broadcast: (job) => Promise.all(threads.map((thread) => send(thread, job))),
    close: async () => {
      await Promise.all(threads.map(({ worker }) => worker.terminate()));
    },
  };
}
