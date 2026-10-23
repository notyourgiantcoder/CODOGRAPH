import { cn } from "@/lib/cn";

/** Codograph mark: three linked nodes inside a rounded tile, as on the landing page. */
export function Logo({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "relative flex size-8 items-center justify-center rounded-[10px] border border-white/15 bg-gradient-to-b from-[#1f2230] to-[#121419] shadow-[0_0_20px_-4px_rgba(139,92,246,0.6)]",
        className,
      )}
      aria-hidden
    >
      <svg viewBox="0 0 24 24" className="size-[18px]" fill="none">
        <defs>
          <linearGradient id="cg-logo" x1="3" y1="3" x2="21" y2="21" gradientUnits="userSpaceOnUse">
            <stop stopColor="#a78bfa" />
            <stop offset="1" stopColor="#67d5ff" />
          </linearGradient>
        </defs>
        <path d="M6.5 7.5 L12 16.5 L17.5 7.5" stroke="url(#cg-logo)" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M6.5 7.5 H17.5" stroke="url(#cg-logo)" strokeWidth="1.8" strokeLinecap="round" opacity="0.45" />
        <circle cx="6.5" cy="7.5" r="2.4" fill="#a78bfa" />
        <circle cx="17.5" cy="7.5" r="2.4" fill="#8bb8fb" />
        <circle cx="12" cy="16.5" r="2.4" fill="#67d5ff" />
      </svg>
    </span>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <Logo />
      <span className="text-[15px] font-semibold tracking-tight text-fg">Codograph</span>
    </span>
  );
}
