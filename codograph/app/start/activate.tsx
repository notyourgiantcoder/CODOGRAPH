"use client";

import { useClerk } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { resolveOrganization } from "./actions";

export function Activate() {
  const { setActive } = useClerk();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  // Strict mode runs effects twice in dev; two calls could create two orgs.
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    resolveOrganization()
      .then((organization) => setActive({ organization }))
      .then(() => router.replace("/"))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
  }, [setActive, router]);

  return error ? (
    <p className="max-w-sm rounded-xl border border-line-strong bg-panel px-4 py-3 text-center text-[13px] text-fg">Couldn&apos;t set up an organization: {error}</p>
  ) : (
    <p className="flex items-center gap-2 text-[13px] text-muted">
      <span className="size-1.5 animate-pulse rounded-full bg-violet-soft shadow-[0_0_8px_var(--violet-soft)]" />
      Setting up your organization…
    </p>
  );
}
