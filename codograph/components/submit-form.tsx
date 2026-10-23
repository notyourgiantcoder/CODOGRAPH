"use client";

import { ArrowRight, Loader2, TriangleAlert } from "lucide-react";
import { useActionState } from "react";
import { submitAnalysis, type FormState } from "@/app/(workspace)/actions";
import { buttonClass } from "@/components/ui/primitives";

const INITIAL: FormState = { error: null };

export function SubmitForm() {
  const [state, action, pending] = useActionState(submitAnalysis, INITIAL);
  return (
    <form action={action} className="mx-auto mt-8 max-w-xl text-left">
      <div className="flex items-center gap-2 rounded-2xl border border-line-strong bg-panel p-1.5 shadow-[0_20px_60px_-24px_rgba(139,92,246,0.45)] transition focus-within:border-violet/60 focus-within:shadow-[0_0_0_4px_rgba(139,92,246,0.15),0_20px_60px_-24px_rgba(139,92,246,0.6)]">
        <GithubMark />
        <input
          name="url"
          required
          autoComplete="off"
          spellCheck={false}
          placeholder="github.com/owner/repo"
          aria-label="Public GitHub repository URL"
          aria-invalid={state.error ? true : undefined}
          className="h-10 min-w-0 flex-1 bg-transparent font-mono text-[14px] text-fg outline-none placeholder:text-subtle"
        />
        <button type="submit" disabled={pending} className={buttonClass("primary", "md", "shrink-0")}>
          {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
          {pending ? "Starting…" : "Analyse"}
          {!pending && <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />}
        </button>
      </div>
      {state.error && (
        <p role="alert" className="mt-2.5 flex items-center gap-2 px-2 text-[13px] text-fg">
          <TriangleAlert className="size-3.5 shrink-0 text-amber-500" aria-hidden />
          {state.error}
        </p>
      )}
    </form>
  );
}

function GithubMark() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="ml-2.5 size-[18px] shrink-0 text-subtle" aria-hidden>
      <path d="M12 .5a11.5 11.5 0 0 0-3.64 22.41c.58.1.79-.25.79-.56v-2c-3.2.7-3.88-1.37-3.88-1.37-.52-1.33-1.28-1.69-1.28-1.69-1.05-.71.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.29 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11 11 0 0 1 5.79 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.8 1.19 1.83 1.19 3.09 0 4.42-2.7 5.39-5.26 5.68.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 12 .5Z" />
    </svg>
  );
}
