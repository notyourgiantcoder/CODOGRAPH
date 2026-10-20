"use client";

import { motion } from "motion/react";
import { Check, ChevronRight, CircleHelp, X } from "lucide-react";
import { useState } from "react";
import { Reveal, SectionHeading } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";
import { DEPENDENCY_MAP, displayName, evidenceFor, getFile } from "@/lib/graph";

const POS: Record<string, { x: number; y: number }> = {
  "components-checkout-form": { x: 90, y: 34 },
  "hooks-use-checkout": { x: 250, y: 34 },
  "lib-validation": { x: 90, y: 120 },
  "api-checkout": { x: 250, y: 120 },
  "lib-orders": { x: 250, y: 200 },
  "lib-payments": { x: 90, y: 200 },
};

const GROUNDED = [
  "components-checkout-form->hooks-use-checkout",
  "components-checkout-form->lib-validation",
  "hooks-use-checkout->api-checkout",
  "api-checkout->lib-validation",
  "api-checkout->lib-orders",
].map((id) => DEPENDENCY_MAP.get(id)!);

const SPECULATIVE: { from: string; to: string; label: string; wrong: boolean }[] = [
  { from: "components-checkout-form", to: "hooks-use-checkout", label: "uses", wrong: false },
  { from: "components-checkout-form", to: "lib-orders", label: "probably calls", wrong: true },
  { from: "hooks-use-checkout", to: "api-checkout", label: "likely fetches", wrong: false },
  { from: "api-checkout", to: "lib-payments", label: "may charge via", wrong: true },
  { from: "api-checkout", to: "lib-orders", label: "creates order?", wrong: false },
];

const label = (id: string) => (id === "lib-payments" ? "payments.ts" : displayName(id));
const halfWidth = (id: string) => (label(id).length * 6.4 + 22) / 2;

function Node({ id, ghost }: { id: string; ghost?: boolean }) {
  const p = POS[id];
  const text = label(id);
  const w = halfWidth(id) * 2;
  return (
    <g>
      <rect
        x={p.x - w / 2}
        y={p.y - 13}
        width={w}
        height="26"
        rx="7"
        fill={ghost ? "rgba(245,158,11,0.06)" : "#171a21"}
        stroke={ghost ? "rgba(245,158,11,0.6)" : "rgba(255,255,255,0.16)"}
        strokeDasharray={ghost ? "3 3" : undefined}
      />
      <text x={p.x} y={p.y + 4} textAnchor="middle" fontSize="10.5" fill={ghost ? "#fcd34d" : "#e6e8ee"} fontFamily="var(--font-geist-mono)">
        {text}
      </text>
    </g>
  );
}

function edgePath(from: string, to: string) {
  const a = POS[from];
  const b = POS[to];
  const dy = b.y - a.y;
  const sy = a.y + (dy > 0 ? 13 : dy < 0 ? -13 : 0);
  const ty = b.y + (dy > 0 ? -13 : dy < 0 ? 13 : 0);
  const dir = Math.sign(b.x - a.x) || 1;
  const sx = dy === 0 ? a.x + dir * halfWidth(from) : a.x;
  const tx = dy === 0 ? b.x - dir * (halfWidth(to) + 4) : b.x;
  return `M ${sx} ${sy} C ${sx} ${(sy + ty) / 2}, ${tx} ${(sy + ty) / 2}, ${tx} ${ty}`;
}

function SpeculativeGraph() {
  return (
    <svg viewBox="0 0 340 226" className="h-auto w-full" role="img" aria-label="A speculative graph with invented relationships">
      {SPECULATIVE.map((e, i) => (
        <motion.path
          key={i}
          d={edgePath(e.from, e.to)}
          fill="none"
          stroke={e.wrong ? "rgba(245,158,11,0.75)" : "rgba(148,155,170,0.5)"}
          strokeDasharray="4 4"
          initial={{ pathLength: 0 }}
          whileInView={{ pathLength: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: i * 0.1 }}
        />
      ))}
      {Object.keys(POS).map((id) => (
        <Node key={id} id={id} ghost={id === "lib-payments"} />
      ))}
      <g>
        <rect x="20" y="152" width="44" height="16" rx="4" fill="rgba(245,158,11,0.12)" />
        <text x="42" y="163" textAnchor="middle" fontSize="8.5" fill="#fcd34d" fontFamily="var(--font-geist-mono)">
          62% sure
        </text>
      </g>
    </svg>
  );
}

function GroundedGraph({ active, onActive }: { active: string | null; onActive: (id: string | null) => void }) {
  return (
    <svg viewBox="0 0 340 226" className="h-auto w-full" role="img" aria-label="A graph built from parsed import statements">
      {GROUNDED.map((d, i) => (
        <g key={d.id} onMouseEnter={() => onActive(d.id)} onMouseLeave={() => onActive(null)} className="cursor-pointer">
          <path d={edgePath(d.source, d.target)} fill="none" stroke="transparent" strokeWidth="14" />
          <motion.path
            d={edgePath(d.source, d.target)}
            fill="none"
            stroke={active === d.id ? "#67d5ff" : d.kind === "fetch" ? "rgba(103,213,255,0.6)" : "rgba(167,139,250,0.7)"}
            strokeWidth={active === d.id ? 2 : 1.3}
            strokeDasharray={d.kind === "fetch" ? "7 5" : undefined}
            initial={{ pathLength: 0 }}
            whileInView={{ pathLength: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, delay: i * 0.1 }}
          />
        </g>
      ))}
      {Object.keys(POS)
        .filter((id) => id !== "lib-payments")
        .map((id) => (
          <Node key={id} id={id} />
        ))}
    </svg>
  );
}

export function Philosophy() {
  const [view, setView] = useState<"speculative" | "grounded">("grounded");
  const [active, setActive] = useState<string | null>(null);
  const shown = active ? DEPENDENCY_MAP.get(active)! : GROUNDED[0];
  const ev = evidenceFor(shown);

  return (
    <section className="relative py-24 sm:py-28" aria-labelledby="philosophy-title">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_60%_50%_at_50%_40%,rgba(139,92,246,0.07),transparent)]" aria-hidden />
      <div className="mx-auto max-w-[1180px] px-4 sm:px-6">
        <SectionHeading
          eyebrow="Technical philosophy"
          title={<span id="philosophy-title">AI should explain your code, not invent it.</span>}
          description="Codograph's concept separates two jobs. A deterministic parser decides what is connected. A language model only explains relationships that the graph can prove."
        />

        <div className="mx-auto mt-10 flex w-fit rounded-xl border border-line bg-panel p-1 md:hidden" role="tablist" aria-label="Comparison view">
          {(["speculative", "grounded"] as const).map((v) => (
            <button
              key={v}
              type="button"
              role="tab"
              aria-selected={view === v}
              onClick={() => setView(v)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-[13px] font-medium capitalize transition",
                view === v ? "bg-white/[0.08] text-fg" : "text-subtle",
              )}
            >
              {v}
            </button>
          ))}
        </div>

        <div className="mt-6 grid grid-cols-[minmax(0,1fr)] gap-4 md:mt-16 md:grid-cols-2">
          <Reveal className={cn("rounded-2xl border border-amber-400/15 bg-panel/70 p-5 sm:p-6", view !== "speculative" && "hidden md:block")}>
            <div className="flex items-center gap-2">
              <CircleHelp className="size-4 text-amber-300" aria-hidden />
              <h3 className="text-[15px] font-semibold text-fg">Speculative relationships</h3>
            </div>
            <p className="mt-1.5 text-[13px] text-muted">A model asked to “map the checkout flow” from file names alone.</p>
            <div className="mt-4 rounded-xl border border-line bg-black/20 p-2">
              <SpeculativeGraph />
            </div>
            <ul className="mt-4 space-y-2 text-[12.5px]">
              {[
                ["Invents ", "payments.ts", ", a module that does not exist"],
                ["Claims ", "CheckoutForm → orders.ts", " with no import to back it"],
                ["Misses ", "api/checkout → validation.ts", " entirely"],
              ].map(([a, b, c]) => (
                <li key={b} className="flex gap-2 text-muted">
                  <X className="mt-0.5 size-3.5 shrink-0 text-amber-300" aria-hidden />
                  <span>
                    {a}
                    <code className="font-mono text-amber-100/90">{b}</code>
                    {c}
                  </span>
                </li>
              ))}
            </ul>
          </Reveal>

          <Reveal delay={0.08} className={cn("rounded-2xl border border-cyan/20 bg-panel/70 p-5 sm:p-6", view !== "grounded" && "hidden md:block")}>
            <div className="flex items-center gap-2">
              <Check className="size-4 text-cyan" aria-hidden />
              <h3 className="text-[15px] font-semibold text-fg">Grounded in code analysis</h3>
            </div>
            <p className="mt-1.5 text-[13px] text-muted">The same flow, built from parsed statements. Hover an edge for its evidence.</p>
            <div className="mt-4 rounded-xl border border-line bg-black/20 p-2">
              <GroundedGraph active={active} onActive={setActive} />
            </div>
            <div className="mt-4 rounded-lg border border-line bg-black/30 px-3 py-2 font-mono text-[11px]" aria-live="polite">
              <p className="text-subtle">
                {getFile(shown.source).path}:{ev.line}
              </p>
              <p className="mt-0.5 truncate text-fg/90">{ev.text}</p>
            </div>
            <p className="mt-3 flex gap-2 text-[12.5px] text-muted">
              <Check className="mt-0.5 size-3.5 shrink-0 text-cyan" aria-hidden />
              Every edge traces back to a line of source. Nothing is inferred from names.
            </p>
          </Reveal>
        </div>

        <Reveal className="mt-4 overflow-hidden rounded-2xl border border-line bg-panel/70 p-5 sm:p-6">
          <div className="grid grid-cols-[minmax(0,1fr)] items-stretch gap-3 lg:grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr_auto_1fr]">
            {[
              { t: "Source files", d: "Read-only input", zone: "det" },
              { t: "Parser", d: "Extracts imports, types, calls", zone: "det" },
              { t: "Dependency graph", d: "Verifiable edges", zone: "det" },
              { t: "AI explanation layer", d: "Reads the graph only", zone: "gen" },
              { t: "Answer + citations", d: "Links back to lines", zone: "gen" },
            ].map((s, i, arr) => (
              <PipelineStep key={s.t} step={s} last={i === arr.length - 1} />
            ))}
          </div>
          <div className="mt-4 grid grid-cols-[minmax(0,1fr)] gap-3 text-[11.5px] lg:grid-cols-[3fr_2fr]">
            <p className="rounded-lg border border-violet/25 bg-violet/[0.05] px-3 py-2 text-muted">
              <span className="font-medium text-violet-soft">Deterministic.</span> Same input, same graph. Counts and paths are computed, never generated.
            </p>
            <p className="rounded-lg border border-cyan/20 bg-cyan/[0.04] px-3 py-2 text-muted">
              <span className="font-medium text-cyan">Generative.</span> Language only where language helps: summaries and plain-English explanations.
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function PipelineStep({ step, last }: { step: { t: string; d: string; zone: string }; last: boolean }) {
  return (
    <>
      <div
        className={cn(
          "rounded-xl border px-3 py-3",
          step.zone === "det" ? "border-violet/25 bg-violet/[0.04]" : "border-cyan/20 bg-cyan/[0.035]",
        )}
      >
        <p className="text-[13px] font-medium text-fg">{step.t}</p>
        <p className="mt-0.5 text-[11.5px] text-subtle">{step.d}</p>
      </div>
      {!last && (
        <div className="flex items-center justify-center text-subtle" aria-hidden>
          <ChevronRight className="size-4 rotate-90 lg:rotate-0" />
        </div>
      )}
    </>
  );
}
