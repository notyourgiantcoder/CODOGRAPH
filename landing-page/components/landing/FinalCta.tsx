"use client";

import { ArrowRight } from "lucide-react";
import { Reveal, Button } from "@/components/ui/primitives";
import { scrollToId } from "@/lib/cn";
import { FILES } from "@/data/repository";
import { DEPENDENCIES } from "@/lib/graph";

export function FinalCta() {
  return (
    <section className="relative px-4 pb-24 sm:px-6 sm:pb-32">
      <Reveal className="relative mx-auto max-w-[1180px] overflow-hidden rounded-3xl border border-line-strong bg-panel px-6 py-20 text-center sm:py-28">
        <div className="pointer-events-none absolute inset-0" aria-hidden>
          <div className="grid-backdrop absolute inset-0 opacity-60 [mask-image:radial-gradient(ellipse_60%_70%_at_50%_50%,black,transparent)]" />
          <div className="absolute left-1/2 top-full h-[480px] w-[900px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(139,92,246,0.35),transparent)]" />
          <div className="absolute left-1/2 top-full h-[260px] w-[520px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(103,213,255,0.25),transparent)]" />
        </div>
        <div className="relative">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-violet-soft">
            {FILES.length} files · {DEPENDENCIES.length} relationships · zero setup
          </p>
          <h2 className="mx-auto mt-5 max-w-2xl text-balance text-4xl font-semibold tracking-[-0.04em] text-gradient sm:text-6xl">
            Make your codebase make sense.
          </h2>
          <p className="mx-auto mt-5 max-w-lg text-pretty text-base text-muted sm:text-lg">
            The playground runs entirely in your browser on a synthetic repository. Click around, break nothing.
          </p>
          <Button size="lg" className="mt-10" onClick={() => scrollToId("demo")}>
            Explore the demo
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
          </Button>
        </div>
      </Reveal>
    </section>
  );
}
