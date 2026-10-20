import type { ReactNode } from "react";
import { Reveal } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";

export function FeatureCard({
  icon,
  kicker,
  title,
  description,
  children,
  className,
  delay = 0,
}: {
  icon: ReactNode;
  kicker: string;
  title: string;
  description: string;
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  return (
    <Reveal
      delay={delay}
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-2xl border border-line bg-panel/80 transition-colors hover:border-line-strong",
        className,
      )}
    >
      <div className="hairline-top absolute inset-x-0 top-0 h-px opacity-60" />
      <div className="p-6 pb-0 sm:p-7 sm:pb-0">
        <p className="flex items-center gap-2 font-mono text-[10.5px] uppercase tracking-[0.18em] text-subtle">
          <span className="text-violet-soft">{icon}</span>
          {kicker}
        </p>
        <h3 className="mt-3 text-[19px] font-semibold tracking-tight text-fg">{title}</h3>
        <p className="mt-2 max-w-md text-[14px] leading-relaxed text-muted">{description}</p>
      </div>
      <div className="relative mt-6 flex flex-1 flex-col">{children}</div>
    </Reveal>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
  className,
}: {
  options: { id: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  label: string;
  className?: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className={cn("flex flex-wrap gap-1", className)}>
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          role="radio"
          aria-checked={value === o.id}
          onClick={() => onChange(o.id)}
          className={cn(
            "rounded-md border px-2 py-1 font-mono text-[11px] transition active:scale-95",
            value === o.id
              ? "border-violet/50 bg-violet/[0.12] text-fg"
              : "border-line text-subtle hover:border-line-strong hover:text-muted",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
