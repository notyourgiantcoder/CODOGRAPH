"use client";

import { motion, useInView } from "motion/react";
import { usePrefersReducedMotion } from "@/lib/useMediaQuery";
import { useMemo, useRef, useState } from "react";
import { Segmented } from "@/components/landing/features/FeatureCard";
import { AnimatedNumber } from "@/components/ui/primitives";
import { CATEGORY_META } from "@/lib/categories";
import { analyzeImpact, displayName, getFile } from "@/lib/graph";

const ORIGINS = ["lib-database", "lib-products", "hooks-use-cart", "components-price-tag"] as const;
type Origin = (typeof ORIGINS)[number];

const S = 300;
const C = S / 2;

const ringRadius = (depth: number, rings: number) => 30 + (depth / Math.max(rings, 1)) * (C - 42);

export function BlastRadiusShowcase() {
  const [origin, setOrigin] = useState<Origin>("lib-products");
  const [hover, setHover] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  const result = useMemo(() => analyzeImpact(origin, "downstream"), [origin]);

  const rings = result.maxDepth;
  const reduce = usePrefersReducedMotion();

  const dots = useMemo(() => {
    const byDepth = new Map<number, string[]>();
    for (const id of result.order) {
      const d = result.depths.get(id)!;
      byDepth.set(d, [...(byDepth.get(d) ?? []), id]);
    }
    return [...byDepth.entries()].flatMap(([d, ids]) =>
      ids.map((id, i) => {
        const a = (i / ids.length) * Math.PI * 2 + d * 0.7;
        const r = ringRadius(d, result.maxDepth);
        return { id, d, x: C + Math.cos(a) * r, y: C + Math.sin(a) * r };
      }),
    );
  }, [result]);

  const hovered = hover ? getFile(hover) : null;

  return (
    <div ref={ref} className="flex flex-1 flex-col px-6 pb-6 sm:px-7 sm:pb-7">
      <Segmented
        label="Changed module"
        value={origin}
        onChange={(v) => {
          setOrigin(v);
          setHover(null);
        }}
        options={ORIGINS.map((id) => ({ id, label: displayName(id) }))}
      />
      <div className="relative mx-auto mt-4 w-full max-w-[300px]">
        <svg viewBox={`0 0 ${S} ${S}`} className="h-auto w-full" role="img" aria-label={`Blast radius of ${displayName(origin)}`}>
          {Array.from({ length: rings }, (_, i) => (
            <motion.circle
              key={`${origin}-r${i}`}
              cx={C}
              cy={C}
              r={ringRadius(i + 1, rings)}
              fill="none"
              stroke="rgba(103,213,255,0.16)"
              strokeDasharray="2 5"
              initial={{ opacity: 0, scale: 0.6 }}
              animate={inView ? { opacity: 1, scale: 1 } : {}}
              transition={{ duration: 0.5, delay: i * 0.12 }}
              style={{ transformOrigin: `${C}px ${C}px` }}
            />
          ))}
          {dots.map((dot, i) => (
            <motion.circle
              key={`${origin}-${dot.id}`}
              cx={dot.x}
              cy={dot.y}
              r={hover === dot.id ? 7 : 5}
              fill={CATEGORY_META[getFile(dot.id).category].color}
              stroke="#111318"
              strokeWidth="2"
              initial={{ opacity: 0, cx: C, cy: C }}
              animate={inView ? { opacity: hover && hover !== dot.id ? 0.35 : 1, cx: dot.x, cy: dot.y } : {}}
              transition={{ duration: 0.7, delay: 0.2 + dot.d * 0.15 + i * 0.015, ease: [0.2, 0.8, 0.2, 1] }}
              onMouseEnter={() => setHover(dot.id)}
              onMouseLeave={() => setHover(null)}
              className="cursor-pointer"
            />
          ))}
          <circle cx={C} cy={C} r="22" fill="#0f2029" stroke="#67d5ff" strokeWidth="1.5" />
          {!reduce && (
            <motion.circle
              cx={C}
              cy={C}
              fill="none"
              stroke="#67d5ff"
              initial={{ r: 22, opacity: 0.6 }}
              animate={{ r: 40, opacity: 0 }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeOut" }}
            />
          )}
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <AnimatedNumber value={result.order.length} className="text-[17px] font-semibold text-cyan" />
        </div>
      </div>
      <div className="mt-3 flex h-10 items-center justify-center text-center text-[12.5px]">
        {hovered ? (
          <p className="text-muted">
            <span className="font-mono text-fg">{displayName(hovered.id)}</span> · hop {result.depths.get(hovered.id)}
          </p>
        ) : (
          <p className="text-muted">
            <span className="font-mono text-fg">{displayName(origin)}</span> reaches{" "}
            <span className="text-fg">{result.order.length} files</span> in {result.maxDepth} hops
          </p>
        )}
      </div>
    </div>
  );
}
