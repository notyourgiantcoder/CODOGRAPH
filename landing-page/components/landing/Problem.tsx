"use client";

import { motion, useInView } from "motion/react";
import { usePrefersReducedMotion } from "@/lib/useMediaQuery";
import { EyeOff, Map as MapIcon, Zap } from "lucide-react";
import { useRef, type ReactNode } from "react";
import { Reveal, SectionHeading } from "@/components/ui/primitives";

const ease = [0.2, 0.8, 0.2, 1] as const;

export function Problem() {
  return (
    <section className="relative py-24 sm:py-28" aria-labelledby="problem-title">
      <div className="mx-auto max-w-[1180px] px-4 sm:px-6">
        <SectionHeading
          eyebrow="The problem"
          title={<span id="problem-title">Your codebase has a map. You just can&apos;t see it yet.</span>}
          description="Every repository already encodes how its parts depend on each other. It's just scattered across thousands of import statements, network calls and shared types."
        />

        <div className="mt-16 grid grid-cols-[minmax(0,1fr)] gap-4 md:grid-cols-3">
          <ProblemCard
            index={0}
            icon={<EyeOff className="size-4" />}
            title="Hidden dependencies"
            body="Imports, network calls and shared types form a web that no single file reveals. A one-line fix can reach modules you never opened."
            art={<HiddenDependenciesArt />}
          />
          <ProblemCard
            index={1}
            icon={<MapIcon className="size-4" />}
            title="Unfamiliar architecture"
            body="New to a repository? You rebuild its layers by reading files one at a time, and the mental model fades by next week."
            art={<ArchitectureArt />}
          />
          <ProblemCard
            index={2}
            icon={<Zap className="size-4" />}
            title="Unclear change impact"
            body="Before merging, you guess what might break. Review catches some of it. Production catches the rest."
            art={<ImpactArt />}
          />
        </div>
      </div>
    </section>
  );
}

function ProblemCard({
  index,
  icon,
  title,
  body,
  art,
}: {
  index: number;
  icon: ReactNode;
  title: string;
  body: string;
  art: ReactNode;
}) {
  return (
    <Reveal delay={index * 0.08} className="group relative overflow-hidden rounded-2xl border border-line bg-panel/70">
      <div className="hairline-top absolute inset-x-0 top-0 h-px" />
      <div className="relative h-52 overflow-hidden border-b border-line bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.025),transparent_70%)]">
        {art}
      </div>
      <div className="p-6">
        <div className="flex items-center gap-2.5">
          <span className="flex size-7 items-center justify-center rounded-lg border border-line-strong bg-white/[0.03] text-muted">{icon}</span>
          <h3 className="text-[16px] font-semibold tracking-tight text-fg">{title}</h3>
        </div>
        <p className="mt-3 text-[14px] leading-relaxed text-muted">{body}</p>
      </div>
    </Reveal>
  );
}

function useArtInView() {
  const ref = useRef<SVGSVGElement>(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });
  return { ref, inView };
}

/** A file in the centre; dashed links discover the modules it secretly touches. */
function HiddenDependenciesArt() {
  const { ref, inView } = useArtInView();
  const hidden = [
    { x: 52, y: 44, label: "cart.ts" },
    { x: 262, y: 38, label: "config.ts" },
    { x: 40, y: 150, label: "types.ts" },
    { x: 270, y: 158, label: "/api/cart" },
    { x: 160, y: 182, label: "db.ts" },
  ];
  const c = { x: 160, y: 100 };
  return (
    <svg ref={ref} viewBox="0 0 320 208" className="h-full w-full" role="img" aria-label="One file with hidden links to five other modules">
      {hidden.map((h, i) => (
        <motion.path
          key={h.label}
          d={`M ${c.x} ${c.y} Q ${(c.x + h.x) / 2} ${(c.y + h.y) / 2 - 18} ${h.x} ${h.y}`}
          fill="none"
          stroke="#a78bfa"
          strokeWidth="1.2"
          strokeDasharray="3 4"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={inView ? { pathLength: 1, opacity: 0.7 } : {}}
          transition={{ duration: 0.9, delay: 0.3 + i * 0.18, ease }}
        />
      ))}
      {hidden.map((h, i) => (
        <motion.g
          key={h.label}
          initial={{ opacity: 0, scale: 0.6 }}
          animate={inView ? { opacity: 1, scale: 1 } : {}}
          transition={{ duration: 0.5, delay: 0.9 + i * 0.18, ease }}
          style={{ transformOrigin: `${h.x}px ${h.y}px` }}
        >
          <rect x={h.x - 34} y={h.y - 11} width="68" height="22" rx="6" fill="#171a21" stroke="rgba(167,139,250,0.45)" />
          <text x={h.x} y={h.y + 3.5} textAnchor="middle" fontSize="9.5" fill="#c4b5fd" fontFamily="var(--font-geist-mono)">
            {h.label}
          </text>
        </motion.g>
      ))}
      <g>
        <rect x={c.x - 44} y={c.y - 15} width="88" height="30" rx="8" fill="#1d2029" stroke="rgba(255,255,255,0.22)" />
        <text x={c.x} y={c.y + 4} textAnchor="middle" fontSize="11" fill="#f4f5f7" fontFamily="var(--font-geist-mono)">
          checkout.tsx
        </text>
      </g>
    </svg>
  );
}

/** Scattered modules settle into clear architectural layers. */
function ArchitectureArt() {
  const { ref, inView } = useArtInView();
  const reduce = usePrefersReducedMotion();
  const layers = [
    { label: "Routes", color: "#3987e5" },
    { label: "Logic", color: "#199e70" },
    { label: "Data", color: "#d55181" },
  ];
  const scattered = [
    [40, 150], [250, 40], [150, 170], [70, 60], [240, 150], [180, 80], [110, 110], [270, 100], [30, 100],
  ];
  return (
    <svg ref={ref} viewBox="0 0 320 208" className="h-full w-full" role="img" aria-label="Scattered modules organising into three layers">
      {layers.map((l, row) => (
        <motion.text
          key={l.label}
          x="18"
          y={52 + row * 56}
          fontSize="9.5"
          fill="#7d8496"
          fontFamily="var(--font-geist-mono)"
          initial={{ opacity: 0 }}
          animate={inView ? { opacity: 1 } : {}}
          transition={{ delay: 1.3 + row * 0.1 }}
        >
          {l.label}
        </motion.text>
      ))}
      {layers.map((_, row) => (
        <motion.line
          key={row}
          x1="70"
          x2="302"
          y1={48 + row * 56}
          y2={48 + row * 56}
          stroke="rgba(255,255,255,0.06)"
          initial={{ pathLength: 0 }}
          animate={inView ? { pathLength: 1 } : {}}
          transition={{ duration: 0.8, delay: 1.1 + row * 0.1 }}
        />
      ))}
      {scattered.map(([sx, sy], i) => {
        const row = Math.floor(i / 3);
        const col = i % 3;
        const tx = 98 + col * 74;
        const ty = 48 + row * 56;
        return (
          <motion.rect
            key={i}
            width="56"
            height="20"
            rx="5"
            fill="#171a21"
            stroke={layers[row].color}
            strokeOpacity="0.7"
            initial={{ x: (reduce ? tx : sx) - 28, y: (reduce ? ty : sy) - 10, rotate: reduce ? 0 : (i % 2 ? 8 : -6) }}
            animate={inView ? { x: tx - 28, y: ty - 10, rotate: 0 } : {}}
            transition={{ type: "spring", stiffness: 90, damping: 14, delay: 0.3 + i * 0.07 }}
          />
        );
      })}
      {[0, 1, 2].map((col) =>
        [0, 1].map((row) => (
          <motion.line
            key={`${col}-${row}`}
            x1={98 + col * 74}
            x2={98 + col * 74}
            y1={58 + row * 56}
            y2={94 + row * 56}
            stroke="rgba(148,155,170,0.4)"
            strokeWidth="1"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={inView ? { pathLength: 1, opacity: 1 } : {}}
            transition={{ duration: 0.5, delay: 1.5 + col * 0.08 + row * 0.12 }}
          />
        )),
      )}
    </svg>
  );
}

/** A change ripples outward; nothing says how far it travels. */
function ImpactArt() {
  const { ref, inView } = useArtInView();
  const reduce = usePrefersReducedMotion();
  const c = { x: 160, y: 104 };
  const nodes = [
    { x: 96, y: 62, d: 1 }, { x: 226, y: 70, d: 1 }, { x: 110, y: 154, d: 1 },
    { x: 48, y: 104, d: 2 }, { x: 274, y: 128, d: 2 }, { x: 200, y: 176, d: 2 }, { x: 160, y: 26, d: 2 },
  ];
  return (
    <svg ref={ref} viewBox="0 0 320 208" className="h-full w-full" role="img" aria-label="A change rippling outward to an unknown number of modules">
      {[0, 1, 2].map((i) => (
        <motion.circle
          key={i}
          cx={c.x}
          cy={c.y}
          r="20"
          fill="none"
          stroke="#67d5ff"
          strokeWidth="1"
          initial={{ scale: 1, opacity: 0 }}
          animate={inView && !reduce ? { scale: [1, 6], opacity: [0.55, 0] } : {}}
          transition={{ duration: 3.6, delay: i * 1.2, repeat: Infinity, ease: "easeOut" }}
          style={{ transformOrigin: `${c.x}px ${c.y}px` }}
        />
      ))}
      {nodes.map((n, i) => (
        <motion.g
          key={i}
          initial={{ opacity: 0.25 }}
          animate={inView ? { opacity: [0.25, 1, 0.55] } : {}}
          transition={{ duration: 2.4, delay: 0.4 + n.d * 0.7 + i * 0.05, repeat: reduce ? 0 : Infinity, repeatDelay: 1.2 }}
        >
          <circle cx={n.x} cy={n.y} r="9" fill="#171a21" stroke="rgba(103,213,255,0.6)" />
          <text x={n.x} y={n.y + 3.5} textAnchor="middle" fontSize="9.5" fill="#67d5ff" fontFamily="var(--font-geist-mono)">
            ?
          </text>
        </motion.g>
      ))}
      <circle cx={c.x} cy={c.y} r="16" fill="#0f2029" stroke="#67d5ff" strokeWidth="1.5" />
      <text x={c.x} y={c.y + 3.5} textAnchor="middle" fontSize="10" fill="#e0f7ff" fontFamily="var(--font-geist-mono)">
        Δ
      </text>
    </svg>
  );
}
