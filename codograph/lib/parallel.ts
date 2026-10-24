// The one way the app runs many requests at once: all of them, at most
// `limit` in flight, failing with the first failure. Unbounded would queue a
// large repository's hundreds of requests on the database at once.

/** Runs every task, at most `limit` at a time. */
export async function inParallel(tasks: (() => Promise<void>)[], limit: number): Promise<void> {
  let next = 0;
  const worker = async () => {
    while (next < tasks.length) await tasks[next++]?.();
  };
  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, worker));
}

export function chunks<T>(items: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}
