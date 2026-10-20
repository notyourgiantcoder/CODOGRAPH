"use client";

import { AnimatePresence, motion } from "motion/react";
import { useMemo, useState } from "react";
import { Segmented } from "@/components/landing/features/FeatureCard";
import { CATEGORY_META, EDGE_KIND_META } from "@/lib/categories";
import { displayName, evidenceFor, getFile, getIncoming, getOutgoing } from "@/lib/graph";
import type { Dependency } from "@/types/graph";

const FOCI = ["components-product-card", "hooks-use-cart", "lib-products", "api-checkout"] as const;
type Focus = (typeof FOCI)[number];

const W = 560;
const H = 300;
const C = { x: W / 2, y: H / 2 };

/** Radial neighbourhood: dependents on the left arc, dependencies on the right. */
function layout(focus: string) {
  const ins = getIncoming(focus);
  const outs = getOutgoing(focus);
  const place = (deps: Dependency[], side: -1 | 1) =>
    deps.map((d, i) => {
      const n = deps.length;
      const spread = Math.min(Math.PI * 0.78, 0.42 * Math.max(1, n - 1));
      const angle = n === 1 ? 0 : -spread / 2 + (spread * i) / (n - 1);
      const r = 200;
      return {
        dep: d,
        id: side === 1 ? d.target : d.source,
        side,
        x: C.x + side * Math.cos(angle) * r,
        y: C.y + Math.sin(angle) * (H * 0.44),
      };
    });
  return [...place(ins, -1), ...place(outs, 1)];
}

export function MappingShowcase() {
  const [focus, setFocus] = useState<Focus>("components-product-card");
  const [hover, setHover] = useState<string | null>(null);
  const nodes = useMemo(() => layout(focus), [focus]);
  const hovered = nodes.find((n) => n.dep.id === hover);
  const ev = hovered ? evidenceFor(hovered.dep) : null;

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex flex-wrap items-center justify-between gap-3 px-6 sm:px-7">
        <Segmented
          label="Focus module"
          value={focus}
          onChange={(v) => {
            setFocus(v);
            setHover(null);
          }}
          options={FOCI.map((id) => ({ id, label: displayName(id) }))}
        />
        <div className="flex items-center gap-3 text-[11px] text-subtle">
          <span className="flex items-center gap-1.5">
            <span className="h-px w-4 bg-violet-soft" /> imported by
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-px w-4 bg-cyan" /> imports
          </span>
        </div>
      </div>

      <div className="relative mt-2 flex-1">
        <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={`Dependency neighbourhood of ${displayName(focus)}`}>
          <AnimatePresence mode="popLayout">
            {nodes.map((n, i) => {
              const active = hover === n.dep.id;
              const color = n.side === 1 ? "#67d5ff" : "#a78bfa";
              const midX = (C.x + n.x) / 2;
              return (
                <motion.path
                  key={`${focus}-e-${n.dep.id}`}
                  d={`M ${C.x} ${C.y} C ${midX} ${C.y}, ${midX} ${n.y}, ${n.x} ${n.y}`}
                  fill="none"
                  stroke={color}
                  strokeWidth={active ? 2 : 1.2}
                  strokeDasharray={n.dep.kind === "type" ? "2 4" : n.dep.kind === "fetch" ? "7 5" : undefined}
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: hover && !active ? 0.15 : 0.75 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.6, delay: i * 0.04 }}
                />
              );
            })}
          </AnimatePresence>

          {nodes.map((n, i) => {
            const file = getFile(n.id);
            const color = CATEGORY_META[file.category].color;
            const active = hover === n.dep.id;
            const label = displayName(n.id);
            const w = Math.max(76, label.length * 6.3 + 22);
            return (
              <motion.g
                key={`${focus}-n-${n.dep.id}`}
                initial={{ opacity: 0, x: C.x - n.x, y: C.y - n.y, scale: 0.6 }}
                animate={{ opacity: hover && !active ? 0.35 : 1, x: 0, y: 0, scale: 1 }}
                transition={{ type: "spring", stiffness: 160, damping: 20, delay: 0.05 + i * 0.04 }}
                onMouseEnter={() => setHover(n.dep.id)}
                onMouseLeave={() => setHover(null)}
                onFocus={() => setHover(n.dep.id)}
                onBlur={() => setHover(null)}
                tabIndex={0}
                role="button"
                aria-label={`${label}: ${n.side === 1 ? EDGE_KIND_META[n.dep.kind].verb : "imported by"}`}
                className="cursor-pointer outline-none"
              >
                <rect
                  x={n.x - w / 2}
                  y={n.y - 12}
                  width={w}
                  height="24"
                  rx="7"
                  fill={active ? "#1d2029" : "#14161c"}
                  stroke={active ? color : "rgba(255,255,255,0.12)"}
                />
                <circle cx={n.x - w / 2 + 10} cy={n.y} r="3" fill={color} />
                <text x={n.x - w / 2 + 18} y={n.y + 3.6} fontSize="10.5" fill="#e6e8ee" fontFamily="var(--font-geist-mono)">
                  {label}
                </text>
              </motion.g>
            );
          })}

          <motion.g key={focus} initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} style={{ transformOrigin: `${C.x}px ${C.y}px` }}>
            <rect x={C.x - 68} y={C.y - 17} width="136" height="34" rx="9" fill="#1a1530" stroke="#8b5cf6" strokeWidth="1.5" />
            <text x={C.x} y={C.y + 4} textAnchor="middle" fontSize="12" fontWeight="600" fill="#f4f5f7" fontFamily="var(--font-geist-mono)">
              {displayName(focus)}
            </text>
          </motion.g>
        </svg>
      </div>

      <div className="mx-6 mb-6 mt-2 h-[52px] rounded-lg border border-line bg-black/25 px-3 py-2 font-mono text-[11px] sm:mx-7 sm:mb-7">
        <AnimatePresence mode="wait">
          {ev && hovered ? (
            <motion.div key={hovered.dep.id} initial={{ opacity: 0, y: 3 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <p className="text-subtle">
                {getFile(hovered.dep.source).path}:{ev.line} · <span className="text-muted">{EDGE_KIND_META[hovered.dep.kind].label}</span>
              </p>
              <p className="mt-0.5 truncate text-fg/90">{ev.text}</p>
            </motion.div>
          ) : (
            <motion.p key="hint" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="pt-2 text-subtle">
              Hover a module to see the statement that creates the edge.
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
