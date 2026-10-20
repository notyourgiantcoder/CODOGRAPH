"use client";

import { motion, useMotionValueEvent, useScroll, useTransform } from "motion/react";
import { Download, FileSearch, MessageSquareText, Share2 } from "lucide-react";
import { useRef, useState, type ReactNode } from "react";
import { Reveal, SectionHeading } from "@/components/ui/primitives";
import { DEPENDENCIES, generateSource } from "@/lib/graph";
import { FILES } from "@/data/repository";
import { cn } from "@/lib/cn";

const PARSE_SAMPLE = generateSource("components-product-card").code.split("\n").slice(2, 7);
const CART_DEPENDENTS = DEPENDENCIES.filter((d) => d.target === "hooks-use-cart").length;

const STEPS: { title: string; body: string; icon: ReactNode; art: ReactNode }[] = [
  {
    title: "Load a repository",
    body: "Point Codograph at a repository and branch. Only source files are read; nothing is executed.",
    icon: <Download className="size-4" />,
    art: (
      <div className="space-y-2">
        <div className="flex items-center gap-2 rounded-md border border-line-strong bg-black/30 px-2 py-1.5 font-mono text-[10.5px] text-muted">
          <span className="text-subtle">repo</span> acme/storefront
        </div>
        <div className="flex gap-1.5 font-mono text-[10px]">
          <span className="rounded border border-line px-1.5 py-0.5 text-subtle">main</span>
          <span className="rounded border border-line px-1.5 py-0.5 text-subtle">{FILES.length} files</span>
        </div>
      </div>
    ),
  },
  {
    title: "Parse source code",
    body: "A deterministic parser extracts imports, type references and network calls into typed edges.",
    icon: <FileSearch className="size-4" />,
    art: (
      <div className="relative overflow-hidden rounded-md border border-line bg-black/30 p-2 font-mono text-[9.5px] leading-[1.6]">
        {PARSE_SAMPLE.map((line, i) => (
          <p key={i} className={cn("truncate", line.startsWith("import") ? "text-violet-soft" : "text-subtle")}>
            {line || " "}
          </p>
        ))}
        <span className="absolute inset-x-0 top-0 h-5 animate-scan bg-gradient-to-b from-transparent via-cyan/15 to-transparent" />
      </div>
    ),
  },
  {
    title: "Explore dependencies",
    body: "Navigate the resulting graph: filter by module type, follow edges and inspect any file.",
    icon: <Share2 className="size-4" />,
    art: (
      <svg viewBox="0 0 160 64" className="h-16 w-full" aria-hidden>
        {[
          [30, 14, 80, 50],
          [80, 50, 130, 14],
          [30, 14, 130, 14],
          [80, 50, 130, 54],
        ].map(([x1, y1, x2, y2], i) => (
          <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="rgba(148,155,170,0.45)" strokeWidth="1" />
        ))}
        {[
          [30, 14, "#3987e5"],
          [80, 50, "#9085e9"],
          [130, 14, "#199e70"],
          [130, 54, "#d55181"],
        ].map(([x, y, c], i) => (
          <circle key={i} cx={x} cy={y} r="6" fill="#171a21" stroke={c as string} strokeWidth="1.6" />
        ))}
      </svg>
    ),
  },
  {
    title: "Ask questions and inspect impact",
    body: "Ask how modules relate or what a change could reach. Answers are built on the graph, with citations.",
    icon: <MessageSquareText className="size-4" />,
    art: (
      <div className="space-y-1.5 text-[10.5px]">
        <p className="ml-auto w-fit rounded-lg rounded-br-sm bg-violet/80 px-2 py-1 text-white">What uses useCart?</p>
        <p className="w-fit rounded-lg rounded-bl-sm border border-line bg-white/[0.03] px-2 py-1 text-muted">
          {CART_DEPENDENTS} files import it directly · <span className="text-cyan">{CART_DEPENDENTS} citations</span>
        </p>
      </div>
    ),
  },
];

export function HowItWorks() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 0.75", "end 0.55"] });
  const draw = useTransform(scrollYProgress, [0, 1], [0, 1]);
  const [active, setActive] = useState(-1);
  useMotionValueEvent(scrollYProgress, "change", (v) => setActive(v <= 0.02 ? -1 : Math.min(3, Math.floor(v * 4))));

  return (
    <section id="how-it-works" className="relative py-24 sm:py-28">
      <div className="mx-auto max-w-[1180px] px-4 sm:px-6">
        <SectionHeading
          eyebrow="How it works"
          title="From source files to answers in four steps"
          description="The intended Codograph workflow. This page demonstrates steps three and four on a synthetic repository; it does not ingest real code."
        />

        <div ref={ref} className="relative mt-16">
          {/* Connecting line: horizontal on desktop, vertical on mobile */}
          <svg className="pointer-events-none absolute left-[12.5%] right-[12.5%] top-[19px] hidden h-0.5 lg:block" preserveAspectRatio="none" viewBox="0 0 100 2" aria-hidden>
            <line x1="0" y1="1" x2="100" y2="1" stroke="rgba(255,255,255,0.08)" strokeWidth="2" />
            <motion.line x1="0" y1="1" x2="100" y2="1" stroke="url(#how-grad)" strokeWidth="2" style={{ pathLength: draw }} />
            <defs>
              <linearGradient id="how-grad" x1="0" x2="1">
                <stop stopColor="#8b5cf6" />
                <stop offset="1" stopColor="#67d5ff" />
              </linearGradient>
            </defs>
          </svg>
          <div className="absolute bottom-6 left-[19px] top-4 w-px bg-white/[0.08] lg:hidden" aria-hidden>
            <motion.div className="w-full origin-top bg-gradient-to-b from-violet to-cyan" style={{ scaleY: draw, height: "100%" }} />
          </div>

          <ol className="grid grid-cols-[minmax(0,1fr)] gap-10 lg:grid-cols-4 lg:gap-6">
            {STEPS.map((step, i) => (
              <Reveal as="li" key={step.title} delay={i * 0.08} className="relative min-w-0 pl-14 lg:pl-0">
                <div className="absolute left-0 top-0 lg:relative lg:mx-auto lg:w-fit">
                  <span
                    className={cn(
                      "relative z-10 flex size-10 items-center justify-center rounded-xl border bg-panel transition-all duration-500",
                      active >= i
                        ? "border-violet/60 text-fg shadow-[0_0_24px_-4px_rgba(139,92,246,0.7)]"
                        : "border-line-strong text-subtle",
                    )}
                  >
                    {step.icon}
                  </span>
                </div>
                <div className="lg:mt-6 lg:text-center">
                  <p className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-subtle">Step {i + 1}</p>
                  <h3 className="mt-1.5 text-[16px] font-semibold tracking-tight text-fg">{step.title}</h3>
                  <p className="mt-2 text-[13.5px] leading-relaxed text-muted">{step.body}</p>
                </div>
                <div
                  className={cn(
                    "mt-5 rounded-xl border bg-panel/70 p-3 transition-all duration-500",
                    active >= i ? "border-line-strong opacity-100" : "border-line opacity-60",
                  )}
                >
                  {step.art}
                </div>
              </Reveal>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
