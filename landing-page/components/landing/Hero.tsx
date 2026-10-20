"use client";

import { motion } from "motion/react";
import { ArrowRight, ChevronDown } from "lucide-react";
import { GithubIcon } from "@/components/landing/Brand";
import { HeroMockup } from "@/components/landing/HeroMockup";
import { Button, buttonClass } from "@/components/ui/primitives";
import { scrollToId } from "@/lib/cn";
import { siteConfig } from "@/lib/site";

const ease = [0.2, 0.8, 0.2, 1] as const;

export function Hero() {
  return (
    <section id="product" className="relative isolate overflow-hidden pt-28 sm:pt-32">
      {/* Ambient backdrop */}
      <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden>
        <div className="grid-backdrop noise-fade absolute inset-0 animate-grid" />
        <div className="absolute left-1/2 top-[-12%] h-[620px] w-[1100px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(139,92,246,0.22),transparent)] blur-2xl" />
        <div className="absolute left-[62%] top-[30%] h-[420px] w-[620px] -translate-x-1/2 animate-float rounded-full bg-[radial-gradient(closest-side,rgba(103,213,255,0.10),transparent)] blur-2xl" />
      </div>

      <div className="mx-auto max-w-[1240px] px-4 sm:px-6">
        <div className="mx-auto max-w-5xl text-center">
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease }}
            className="inline-flex items-center gap-2 rounded-full border border-line-strong bg-white/[0.03] px-3 py-1 font-mono text-[10.5px] font-medium uppercase tracking-[0.22em] text-muted"
          >
            <span className="size-1.5 rounded-full bg-cyan shadow-[0_0_10px_#67d5ff]" />
            Codebase intelligence, reimagined
          </motion.p>

          <h1 className="mt-6 text-balance text-[2.6rem] font-semibold leading-[1.02] tracking-[-0.045em] sm:text-6xl md:text-7xl">
            {["Understand your codebase.", "Before you change it."].map((line, i) => (
              <motion.span
                key={line}
                className={i === 0 ? "block text-gradient" : "block text-accent-gradient pb-1"}
                initial={{ opacity: 0, y: 24, filter: "blur(8px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                transition={{ duration: 0.8, delay: 0.1 + i * 0.12, ease }}
              >
                {line}
              </motion.span>
            ))}
          </h1>

          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.34, ease }}
            className="mx-auto mt-6 max-w-[640px] text-pretty text-base leading-relaxed text-muted sm:text-lg"
          >
            Explore dependency networks, visualize the impact of code changes, and understand unfamiliar architecture with
            AI grounded in real source-code relationships.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.44, ease }}
            className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row"
          >
            <Button size="lg" onClick={() => scrollToId("demo")}>
              Explore the demo
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
            </Button>
            {siteConfig.githubUrl && (
              <a href={siteConfig.githubUrl} target="_blank" rel="noreferrer" className={buttonClass("secondary", "lg")}>
                <GithubIcon className="size-4" />
                Run it on GitHub
              </a>
            )}
            <Button size="lg" variant="secondary" onClick={() => scrollToId("features")}>
              Discover features
              <ChevronDown className="size-4 transition-transform group-hover:translate-y-0.5" aria-hidden />
            </Button>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 40, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 1, delay: 0.5, ease }}
          className="relative mt-12 sm:mt-14"
        >
          <div className="pointer-events-none absolute -inset-x-10 -top-10 bottom-1/2 -z-10 rounded-[40px] bg-[radial-gradient(ellipse_at_top,rgba(139,92,246,0.18),transparent_65%)]" aria-hidden />
          <HeroMockup />
          <p className="mt-4 text-center text-[12px] text-subtle">
            Live, interactive mockup — click nodes, search, or ask the assistant. All data is synthetic.
          </p>
        </motion.div>
      </div>
    </section>
  );
}
