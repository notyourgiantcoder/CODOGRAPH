"use client";

import { animate, motion, useInView } from "motion/react";
import { Check, Copy, Link2 } from "lucide-react";
import { useEffect, useRef, useState, type ComponentProps, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { usePrefersReducedMotion } from "@/lib/use-media-query";
import { buttonClass } from "./button-class";
import { useToast } from "./toast";

export { buttonClass };

// The landing page's building blocks. Its white washes are ink washes here, so
// they read on the light theme too.

export function Tooltip({
  label,
  children,
  side = "top",
  className,
}: {
  label: string;
  children: ReactNode;
  side?: "top" | "bottom" | "left" | "right";
  className?: string;
}) {
  const pos = {
    top: "bottom-full left-1/2 mb-2 -translate-x-1/2",
    bottom: "top-full left-1/2 mt-2 -translate-x-1/2",
    left: "right-full top-1/2 mr-2 -translate-y-1/2",
    right: "left-full top-1/2 ml-2 -translate-y-1/2",
  }[side];
  return (
    <span className={cn("group/tt relative inline-flex", className)}>
      {children}
      <span
        role="tooltip"
        className={cn(
          "pointer-events-none absolute z-50 whitespace-nowrap rounded-md border border-line-strong bg-panel-3 px-2 py-1 text-[11px] font-medium text-fg opacity-0 shadow-lg shadow-black/20 transition duration-150 group-hover/tt:opacity-100 group-has-[:focus-visible]/tt:opacity-100",
          pos,
        )}
      >
        {label}
      </span>
    </span>
  );
}

export function IconButton({
  label,
  className,
  children,
  tooltipSide = "top",
  ...props
}: ComponentProps<"button"> & { label: string; tooltipSide?: "top" | "bottom" | "left" | "right" }) {
  return (
    <Tooltip label={label} side={tooltipSide}>
      <button
        type="button"
        aria-label={label}
        className={cn(
          "inline-flex size-8 items-center justify-center rounded-lg text-muted transition hover:bg-ink/[0.06] hover:text-fg active:scale-95 disabled:pointer-events-none disabled:opacity-40",
          className,
        )}
        {...props}
      >
        {children}
      </button>
    </Tooltip>
  );
}

export function Button({
  variant = "primary",
  size = "md",
  className,
  children,
  ...props
}: ComponentProps<"button"> & { variant?: "primary" | "secondary" | "ghost"; size?: "sm" | "md" | "lg" }) {
  return (
    <button type="button" className={buttonClass(variant, size, className)} {...props}>
      {children}
    </button>
  );
}

/** An icon button that goes somewhere else: a link, in a new tab. */
export function IconLink({
  label,
  href,
  className,
  children,
  tooltipSide = "top",
}: {
  label: string;
  href: string;
  className?: string;
  children: ReactNode;
  tooltipSide?: "top" | "bottom" | "left" | "right";
}) {
  return (
    <Tooltip label={label} side={tooltipSide}>
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        aria-label={label}
        className={cn(
          "inline-flex size-8 items-center justify-center rounded-lg text-muted transition hover:bg-ink/[0.06] hover:text-fg active:scale-95",
          className,
        )}
      >
        {children}
      </a>
    </Tooltip>
  );
}

/** Copies the page's address as it is now, so a link opens on what's selected. */
export function CopyLinkButton({ className }: { className?: string }) {
  const toast = useToast();
  const [copied, setCopied] = useState(false);
  return (
    <IconButton
      label={copied ? "Link copied" : "Copy a link to this"}
      className={className}
      onClick={async () => {
        await navigator.clipboard.writeText(window.location.href);
        setCopied(true);
        toast({ title: "Link copied", description: "It opens the map on this file." });
        window.setTimeout(() => setCopied(false), 1600);
      }}
    >
      {copied ? <Check className="size-3.5 text-emerald-500" /> : <Link2 className="size-3.5" />}
    </IconButton>
  );
}

export function Kbd({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <kbd
      className={cn(
        "inline-flex h-5 min-w-5 items-center justify-center rounded border border-line-strong bg-ink/[0.04] px-1 font-mono text-[10px] text-subtle",
        className,
      )}
    >
      {children}
    </kbd>
  );
}

export function CopyButton({
  text,
  label = "Copy",
  toastTitle = "Copied to clipboard",
  className,
}: {
  text: string;
  label?: string;
  toastTitle?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const toast = useToast();
  const copy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    toast({ title: toastTitle });
    window.setTimeout(() => setCopied(false), 1600);
  };
  return (
    <button
      type="button"
      onClick={copy}
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-md border border-line-strong bg-ink/[0.03] px-2 py-1 text-[11px] font-medium text-muted transition hover:bg-ink/[0.07] hover:text-fg active:scale-95",
        className,
      )}
      aria-label={copied ? "Copied" : label}
    >
      {copied ? <Check className="size-3.5 text-emerald-500" aria-hidden /> : <Copy className="size-3.5" aria-hidden />}
      {copied ? "Copied" : label}
    </button>
  );
}

function format(value: number, decimals: number): string {
  return decimals === 0 ? Math.round(value).toLocaleString("en") : value.toFixed(decimals);
}

/** Counts up or down smoothly whenever the value changes. */
export function AnimatedNumber({ value, decimals = 0, className }: { value: number; decimals?: number; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const previous = useRef(0);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  const reduce = usePrefersReducedMotion();

  useEffect(() => {
    const node = ref.current;
    if (!node || !inView) return;
    const from = previous.current;
    previous.current = value;
    if (reduce) {
      node.textContent = format(value, decimals);
      return;
    }
    const controls = animate(from, value, {
      duration: 0.9,
      ease: [0.2, 0.8, 0.2, 1],
      onUpdate: (v) => (node.textContent = format(v, decimals)),
    });
    return () => controls.stop();
  }, [value, decimals, inView, reduce]);

  return (
    <span ref={ref} className={className}>
      {format(value, decimals)}
    </span>
  );
}

/** Fades and lifts children into view once. */
export function Reveal({ children, delay = 0, className, y = 18 }: { children: ReactNode; delay?: number; className?: string; y?: number }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.6, delay, ease: [0.2, 0.8, 0.2, 1] }}
    >
      {children}
    </motion.div>
  );
}

export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn("font-mono text-[11px] font-medium uppercase tracking-[0.2em] text-violet-soft", className)}>{children}</p>;
}

/** The small uppercase heading every inspector section uses. */
export function SectionLabel({ children, className }: { children: ReactNode; className?: string }) {
  return <h4 className={cn("mb-2 text-[10.5px] font-medium uppercase tracking-wider text-subtle", className)}>{children}</h4>;
}
