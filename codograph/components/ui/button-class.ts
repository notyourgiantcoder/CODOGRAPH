import { cn } from "@/lib/cn";

// The landing page's button look, as classes. A plain module, not a client
// one, so server components (the header's links) can use it too.
export function buttonClass(
  variant: "primary" | "secondary" | "ghost" = "primary",
  size: "sm" | "md" | "lg" = "md",
  className?: string,
) {
  return cn(
    "group relative inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl font-medium transition duration-200 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50",
    size === "sm" && "h-8 px-3 text-[13px]",
    size === "md" && "h-10 px-4 text-sm",
    size === "lg" && "h-12 px-5 text-[15px]",
    variant === "primary" &&
      "bg-fg text-bg shadow-[0_0_0_1px_color-mix(in_srgb,var(--ink)_20%,transparent),0_8px_30px_-8px_rgba(139,92,246,0.6)] hover:bg-fg/90 hover:shadow-[0_0_0_1px_color-mix(in_srgb,var(--ink)_30%,transparent),0_10px_40px_-6px_rgba(139,92,246,0.8)]",
    variant === "secondary" && "border border-line-strong bg-ink/[0.03] text-fg hover:border-ink/20 hover:bg-ink/[0.07]",
    variant === "ghost" && "text-muted hover:bg-ink/[0.05] hover:text-fg",
    className,
  );
}
