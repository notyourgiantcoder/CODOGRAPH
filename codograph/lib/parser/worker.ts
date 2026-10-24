import { parentPort } from "node:worker_threads";
import { createHandler, type Job } from "./work.ts";
import type { Reply } from "./pool.ts";

// One parsing thread. It answers jobs in the order they arrive, so the
// repository index it's sent always lands before the imports that need it.
const port = parentPort;
if (!port) throw new Error("worker.ts runs as a worker thread, not on its own");
const handle = createHandler();

port.on("message", ({ id, job }: { id: number; job: Job }) => {
  let reply: Reply;
  try {
    reply = { id, result: handle(job) };
  } catch (error) {
    reply = { id, error: error instanceof Error ? (error.stack ?? error.message) : String(error) };
  }
  port.postMessage(reply);
});
