"use client";

import { useState, useTransition } from "react";
import { rerunAnalysis } from "@/app/(workspace)/actions";

export function RerunButton({ analysisId, onStarted, label = "Re-run" }: { analysisId: string; onStarted: () => void; label?: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <span className="flex items-center gap-2">
      {error && <span className="text-xs text-muted">{error}</span>}
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await rerunAnalysis(analysisId);
            setError(result.error);
            if (!result.error) onStarted();
          })
        }
        className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-line-strong bg-ink/[0.03] px-3 text-[12.5px] font-medium text-fg transition hover:bg-ink/[0.07] active:scale-[0.97] disabled:opacity-50"
      >
        {pending ? "Starting…" : label}
      </button>
    </span>
  );
}
