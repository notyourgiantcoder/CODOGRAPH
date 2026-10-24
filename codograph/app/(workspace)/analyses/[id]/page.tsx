import type { Metadata } from "next";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import type { ComponentProps } from "react";
import { AnalysisHeader } from "@/components/analysis-header";
import { AnalysisView } from "@/components/analysis-view";
import { AnalysisProgress } from "@/components/progress/analysis-progress";
import { loadStoredAnalysis } from "@/lib/analysis/load";
import { packMap } from "@/lib/analysis/packed";
import { SCHEMA_VERSION } from "@/lib/parser/types";
import { isStale } from "@/lib/pipeline/stages";
import { createServerSupabase } from "@/lib/supabase/server";
import { ago } from "@/lib/time";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// The tab says which repository it is. Read under the member's policies, like
// the page: another organization's analysis has no name to give.
export async function generateMetadata({ params }: PageProps<"/analyses/[id]">): Promise<Metadata> {
  const { id } = await params;
  if (!UUID.test(id)) return { title: "Analysis" };
  const supabase = await createServerSupabase();
  const { data } = await supabase.from("analyses").select("project:projects(repo_owner, repo_name)").eq("id", id).maybeSingle();
  return { title: data?.project ? `${data.project.repo_owner}/${data.project.repo_name}` : "Analysis" };
}

// One address per analysis: the map once it's complete, the run's progress
// until then. The progress view refreshes this page when the last stage
// lands, so a finished run turns into its map in place.
export default async function AnalysisPage({ params }: PageProps<"/analyses/[id]">) {
  const { id } = await params;
  const loaded = UUID.test(id) ? await loadAnalysis(id) : null;
  if (!loaded) notFound();

  if (loaded.kind === "map") {
    const { result, modelRoles, header } = loaded;
    // Only what the pane shows crosses to the browser, not the whole coverage report.
    return (
      <div className="flex h-full flex-col">
        <AnalysisView
          map={packMap(result.files, result.edges)}
          routes={result.routes}
          routeCoverage={result.coverage.routes}
          modelRoles={modelRoles}
          analysisId={header.analysisId}
          commitSha={header.commitSha}
          repository={{
            owner: header.repository.owner,
            name: header.repository.name,
            projects: result.projects,
            skipped: result.coverage.files.skipped,
            unresolved: result.coverage.imports.total.unresolved,
            fetches: result.coverage.fetches,
          }}
        />
      </div>
    );
  }

  if (loaded.kind === "outdated") {
    // Stored by an older parser. Showing it would present what that parser
    // never looked for (roles, routes, require() edges, export names) as
    // checked and found empty.
    return (
      <div className="flex h-full flex-col">
        <AnalysisHeader {...loaded.header} />
        <div className="mx-auto mt-14 max-w-lg rounded-2xl border border-line-strong bg-panel px-6 py-5 text-center">
          <p className="text-[14px] font-medium text-fg">This analysis was stored by an older version of the parser.</p>
          <p className="mt-1 text-[13px] text-muted">
            It didn&apos;t read everything the current one does, such as complexity and network calls. Re-analyse it to map it with the current one.
          </p>
        </div>
      </div>
    );
  }

  const { props } = loaded;
  // A fresh mount per server render, so "unchanged since render" restarts with it.
  return <AnalysisProgress key={`${props.initial.status}:${props.initial.stage}:${props.started?.iso}`} {...props} />;
}

type Loaded =
  | ({ kind: "map"; header: ComponentProps<typeof AnalysisHeader> } & Awaited<ReturnType<typeof loadStoredAnalysis>>)
  | { kind: "outdated"; header: ComponentProps<typeof AnalysisHeader> }
  | { kind: "progress"; props: ComponentProps<typeof AnalysisProgress> };

async function loadAnalysis(id: string): Promise<Loaded | null> {
  // No organization filter: another organization's analysis isn't hidden
  // here, it doesn't come back from the query.
  const supabase = await createServerSupabase();
  const { data: analysis, error } = await supabase
    .from("analyses")
    .select("id, status, stage, stage_message, error, commit_sha, schema_version, coverage, detected_projects, created_at, started_at, project:projects(repo_owner, repo_name)")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`Couldn't load analysis: ${error.message}`);
  if (!analysis?.project) return null;
  const repository = { owner: analysis.project.repo_owner, name: analysis.project.repo_name };

  if (analysis.status === "complete" && analysis.commit_sha) {
    const header = { analysisId: analysis.id, repository, commitSha: analysis.commit_sha };
    if (analysis.schema_version !== SCHEMA_VERSION) return { kind: "outdated", header };
    const stored = await loadStoredAnalysis(supabase, {
      id: analysis.id,
      label: `${repository.owner}/${repository.name}`,
      coverage: analysis.coverage,
      projects: analysis.detected_projects,
    });
    return { kind: "map", ...stored, header };
  }

  // Stale is a fact about the moment of the request, worked out once here.
  await connection();
  const now = Date.now();
  return {
    kind: "progress",
    props: {
      analysisId: analysis.id,
      repository,
      commitSha: analysis.commit_sha,
      initial: {
        status: analysis.status,
        stage: analysis.stage,
        message: analysis.status === "failed" ? analysis.error : analysis.stage_message,
      },
      staleAtRender: isStale(analysis, now),
      started: analysis.started_at ? { iso: analysis.started_at, ago: ago(analysis.started_at, now) } : null,
    },
  };
}
