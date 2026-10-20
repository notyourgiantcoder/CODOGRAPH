import { cn } from "@/lib/cn";

/** Codograph mark: three linked nodes inside a rounded tile. */
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

/** Lucide dropped brand icons, so the GitHub mark is inlined. */
export function GithubIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M12 .5a11.5 11.5 0 0 0-3.64 22.41c.58.1.79-.25.79-.56v-2c-3.2.7-3.88-1.37-3.88-1.37-.52-1.33-1.28-1.69-1.28-1.69-1.05-.71.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.29 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11 11 0 0 1 5.79 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.8 1.19 1.83 1.19 3.09 0 4.42-2.7 5.39-5.26 5.68.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 12 .5Z" />
    </svg>
  );
}
