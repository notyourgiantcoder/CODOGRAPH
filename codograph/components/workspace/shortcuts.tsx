"use client";

import { AnimatePresence, motion } from "motion/react";
import { Keyboard, X } from "lucide-react";
import { useEffect, useState } from "react";
import { IconButton, Kbd } from "@/components/ui/primitives";
import { trail } from "@/lib/graph/scope";
import { useWorkspace } from "./context";

const SHORTCUTS: { keys: string[]; does: string }[] = [
  { keys: ["/", "⌘K"], does: "Search for a file" },
  { keys: ["Esc"], does: "Clear the selection, or leave Focus" },
  { keys: ["⌫"], does: "Up one folder" },
  { keys: ["F"], does: "Focus on the selected file, or back to the map" },
  { keys: ["0"], does: "Fit the map to the view" },
  { keys: ["?"], does: "Show these shortcuts" },
];

// Keys that move around the workspace without the mouse. None of them fires
// while typing in a field, so search and the forms keep their keys.
export function WorkspaceShortcuts() {
  const ws = useWorkspace();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const typing = e.target instanceof HTMLElement && e.target.closest("input, textarea, select, [contenteditable]");
      if (typing) return;
      if (e.key === "?") {
        e.preventDefault();
        setOpen((o) => !o);
      } else if (e.key === "Escape") {
        if (open) setOpen(false);
        else if (ws.centre === "focus") ws.setCentre("map");
        else ws.deselect();
      } else if (e.key === "Backspace" && !ws.whole && ws.centre === "map") {
        const levels = trail(ws.scope);
        if (levels.length > 1) {
          e.preventDefault();
          ws.goTo(levels[levels.length - 2] ?? ".");
        }
      } else if (e.key.toLowerCase() === "f" && ws.selection?.kind === "file") {
        ws.setCentre(ws.centre === "focus" ? "map" : "focus");
      } else if (e.key === "0") {
        ws.fit();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [ws, open]);

  return (
    <>
      <IconButton label="Keyboard shortcuts (?)" onClick={() => setOpen(true)} className="size-9">
        <Keyboard className="size-4" />
      </IconButton>
      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setOpen(false)}
          >
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label="Keyboard shortcuts"
              initial={{ opacity: 0, y: 10, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 6, scale: 0.98 }}
              transition={{ type: "spring", stiffness: 420, damping: 34 }}
              onClick={(e) => e.stopPropagation()}
              className="panel-shadow w-full max-w-sm overflow-hidden rounded-2xl border border-line-strong bg-panel"
            >
              <div className="flex items-center gap-2 border-b border-line bg-toolbar px-4 py-3">
                <Keyboard className="size-4 text-violet-soft" aria-hidden />
                <h2 className="text-[14px] font-semibold text-fg">Keyboard shortcuts</h2>
                <span className="ml-auto">
                  <IconButton label="Close (Esc)" onClick={() => setOpen(false)} className="size-7">
                    <X className="size-3.5" />
                  </IconButton>
                </span>
              </div>
              <ul className="divide-y divide-line">
                {SHORTCUTS.map((s) => (
                  <li key={s.keys.join("+") + s.does} className="flex items-center justify-between gap-4 px-4 py-2.5 text-[13px] text-muted">
                    {s.does}
                    <span className="flex shrink-0 gap-1">
                      {s.keys.map((k) => (
                        <Kbd key={k} className="h-6 min-w-6 text-[11px]">
                          {k}
                        </Kbd>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
