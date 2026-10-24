"use client";

import { RefreshCw, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { Problem } from "@/components/ui/problem";
import { buttonClass } from "@/components/ui/button-class";

// Anything that fails while loading a page lands here, saying what failed,
// with a way to try again and a way back.
export default function WorkspaceError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <Problem
      icon={<TriangleAlert className="size-5 text-amber-500" aria-hidden />}
      title="Something didn't load"
      actions={
        <>
          <button type="button" onClick={reset} className={buttonClass("primary", "sm")}>
            <RefreshCw className="size-3.5" aria-hidden />
            Try again
          </button>
          <Link href="/" className={buttonClass("secondary", "sm")}>
            Back to analyses
          </Link>
        </>
      }
    >
      <p className="break-words">{error.message || "An unexpected error happened."}</p>
      {error.digest && <p className="mt-2 font-mono text-[11px] text-subtle">ref {error.digest}</p>}
    </Problem>
  );
}
