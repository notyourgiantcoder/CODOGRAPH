import { auth } from "@clerk/nextjs/server";
import { connection } from "next/server";
import { AnalysisRow, type RowData } from "@/components/progress/analysis-row";
import { StateMark } from "@/components/state-mark";
import { SubmitForm } from "@/components/submit-form";
import { isStale, type Status } from "@/lib/pipeline/stages";
import { createServerSupabase } from "@/lib/supabase/server";
import { ago } from "@/lib/time";

export const metadata = { title: "Analyses" };

const LIST_LIMIT = 100;
type Tally = Status | "stale";
const TALLY_ORDER: Tally[] = ["running", "queued", "stale", "complete", "failed"];

export default async function DashboardPage() {
  const { sessionClaims } = await auth();

  // Read off the token, never fetched from Clerk. If the claim is missing the
  // session token hasn't been customised yet, and that should be obvious.
  const orgName = sessionClaims?.org_name;
  if (!orgName) {
    throw new Error(
      'Session token has no org_name claim. Add "org_name": "{{org.name}}" in Clerk → Sessions → Customize session token.',
    );
  }

  const rows = await loadRows();

  const counts = new Map<Tally, number>();
  for (const r of rows) {
    const tally: Tally = r.staleAtRender ? "stale" : r.progress.status;
    counts.set(tally, (counts.get(tally) ?? 0) + 1);
  }

  return (
    <div className="relative flex-1 overflow-y-auto">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[420px] overflow-hidden" aria-hidden>
        <div className="grid-backdrop noise-fade absolute inset-0" />
        <div className="absolute left-1/2 top-[-120px] h-[420px] w-[820px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(139,92,246,0.22),transparent)]" />
      </div>

      <div className="relative mx-auto max-w-[1180px] px-4 pb-20 pt-14 sm:px-6 sm:pt-20">
        <div className="mx-auto max-w-2xl text-center">
          <p className="inline-flex items-center gap-2 rounded-full border border-line-strong bg-ink/[0.03] px-3 py-1 font-mono text-[11px] uppercase tracking-[0.2em] text-muted">
            <span className="size-1.5 rounded-full bg-cyan shadow-[0_0_8px_var(--cyan)]" />
            {orgName}
          </p>
          <h1 className="mt-5 text-balance text-4xl font-semibold tracking-[-0.04em] text-gradient sm:text-5xl">
            Map a repository. <span className="text-accent-gradient">Before you change it.</span>
          </h1>
          <p className="mx-auto mt-4 max-w-lg text-pretty text-base text-muted">
            Paste a public TypeScript or JavaScript repository. Codograph parses every file and draws what really depends on what.
          </p>
          <SubmitForm />
        </div>

        <section className="mt-14">
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <h2 className="text-[15px] font-semibold tracking-tight text-fg">Analyses</h2>
            <span className="font-mono text-[11px] text-subtle tabular-nums">
              {rows.length === LIST_LIMIT ? `latest ${LIST_LIMIT}` : `${rows.length} ${rows.length === 1 ? "analysis" : "analyses"}`}
            </span>
            {rows.length > 0 && (
              <ul className="ml-auto flex flex-wrap items-center gap-1.5 text-[12px] text-muted tabular-nums">
                {TALLY_ORDER.filter((s) => counts.has(s)).map((s) => (
                  <li key={s} className="inline-flex items-center gap-1.5 rounded-full border border-line px-2.5 py-1">
                    <StateMark status={s === "stale" ? "running" : s} stale={s === "stale"} />
                    {counts.get(s)} {s}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {rows.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-line-strong bg-ink/[0.015] px-6 py-14 text-center">
              <p className="text-sm font-medium text-fg">No analyses yet.</p>
              <p className="mt-1 text-[13px] text-subtle">Paste a public GitHub repository above to map it.</p>
            </div>
          ) : (
            <div className="panel-shadow overflow-hidden rounded-2xl border border-line-strong bg-panel">
              <table className="w-full table-fixed border-collapse text-[13px]">
                <colgroup>
                  <col />
                  <col className="w-36" />
                  <col className="hidden w-24 sm:table-column" />
                  <col className="w-24" />
                  <col className="hidden w-24 sm:table-column" />
                </colgroup>
                <thead className="bg-toolbar text-left text-[11px] font-medium uppercase tracking-wider text-subtle">
                  <tr className="h-10 border-b border-line">
                    <th className="px-4 font-medium">Repository</th>
                    <th className="px-4 font-medium">State</th>
                    <th className="hidden px-4 font-medium sm:table-cell">Commit</th>
                    <th className="px-4 text-right font-medium">Started</th>
                    <th className="hidden px-4 text-right font-medium sm:table-cell">Finished</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <AnalysisRow key={row.id} row={row} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

// Loaded before rendering, and the clock read here: stale and "3m ago" are
// facts about the moment of the request, worked out once. Nothing ticks in
// the browser.
async function loadRows(): Promise<RowData[]> {
  // No organization filter: the row policy scopes this to the organization on
  // the token. Switching organization changes the token, not this query.
  const supabase = await createServerSupabase();
  const { data: analyses, error } = await supabase
    .from("analyses")
    .select("id, status, stage, stage_message, commit_sha, error, created_at, started_at, finished_at, projects(repo_owner, repo_name)")
    .order("created_at", { ascending: false })
    .limit(LIST_LIMIT);
  if (error) throw new Error(`Couldn't load analyses: ${error.message}`);

  await connection();
  const now = Date.now();
  return analyses.map((a) => ({
    id: a.id,
    repository: a.projects ? { owner: a.projects.repo_owner, name: a.projects.repo_name } : null,
    commitSha: a.commit_sha,
    progress: { status: a.status, stage: a.stage, message: a.status === "failed" ? a.error : a.stage_message },
    staleAtRender: isStale(a, now),
    created: { iso: a.created_at, ago: ago(a.created_at, now) },
    finished: a.finished_at ? { iso: a.finished_at, ago: ago(a.finished_at, now) } : null,
  }));
}
