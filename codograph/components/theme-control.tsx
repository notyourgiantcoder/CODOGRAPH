"use client";

import { motion } from "motion/react";
import { Monitor, Moon, Sun } from "lucide-react";
import { useId, useState } from "react";
import { cn } from "@/lib/cn";
import { THEME_COOKIE, THEMES, type Theme } from "@/lib/theme";

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  document.cookie = `${THEME_COOKIE}=${theme}; path=/; max-age=31536000; samesite=lax`;
}

const ICONS = { system: Monitor, light: Sun, dark: Moon } as const;

export function ThemeControl({ initial }: { initial: Theme }) {
  const [theme, setTheme] = useState<Theme>(initial);
  const pill = useId();

  function choose(next: Theme) {
    setTheme(next);
    applyTheme(next);
  }

  return (
    <div role="radiogroup" aria-label="Theme" className="flex items-center rounded-lg border border-line bg-ink/[0.03] p-0.5">
      {THEMES.map((t) => {
        const Icon = ICONS[t];
        return (
          <button
            key={t}
            type="button"
            role="radio"
            aria-checked={theme === t}
            aria-label={`${t} theme`}
            title={`${t[0]?.toUpperCase()}${t.slice(1)} theme`}
            onClick={() => choose(t)}
            className={cn("relative flex size-7 items-center justify-center rounded-md transition", theme === t ? "text-fg" : "text-subtle hover:text-muted")}
          >
            {theme === t && (
              <motion.span layoutId={pill} className="absolute inset-0 rounded-md border border-line-strong bg-ink/[0.07]" transition={{ type: "spring", stiffness: 500, damping: 38 }} />
            )}
            <Icon className="relative size-3.5" aria-hidden />
          </button>
        );
      })}
    </div>
  );
}
