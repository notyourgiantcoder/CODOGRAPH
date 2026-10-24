"use client";

import { Fragment, useEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/cn";

// The landing page's highlighter: a few token classes by regex, no grammar.
// Enough to make real source readable at a glance; it never decides anything.

const KEYWORDS = new Set([
  "import", "from", "export", "default", "function", "const", "let", "var", "return", "if", "else", "for", "while",
  "switch", "case", "break", "continue", "async", "await", "type", "interface", "new", "as", "satisfies", "typeof",
  "extends", "implements", "class", "undefined", "null", "true", "false", "throw", "try", "catch", "finally", "require",
]);

const TOKEN = /(\/\/.*$)|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)|(\b\d[\d_]*\b)|(\b[A-Za-z_$][\w$]*\b)/g;

function highlight(line: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  for (const m of line.matchAll(TOKEN)) {
    const i = m.index;
    if (i > last) out.push(line.slice(last, i));
    const [text, comment, str, num, word] = m;
    let cls: string | undefined;
    if (comment) cls = "tok-com";
    else if (str) cls = "tok-str";
    else if (num) cls = "tok-num";
    else if (word && KEYWORDS.has(word)) cls = "tok-kw";
    else if (word && /^[A-Z]/.test(word)) cls = "tok-type";
    else if (word && line[i + word.length] === "(") cls = "tok-fn";
    out.push(cls ? <span key={i} className={cls}>{text}</span> : text);
    last = i + text.length;
  }
  if (last < line.length) out.push(line.slice(last));
  return out;
}

export function CodeBlock({
  code,
  highlightLines,
  className,
  scrollToFirst = false,
}: {
  code: string;
  highlightLines: ReadonlySet<number>;
  className?: string;
  /** Open scrolled to the first highlighted line rather than the top. */
  scrollToFirst?: boolean;
}) {
  const lines = code.split("\n");
  const box = useRef<HTMLPreElement>(null);
  useEffect(() => {
    if (!scrollToFirst || highlightLines.size === 0 || !box.current) return;
    const first = Math.min(...highlightLines);
    const row = box.current.querySelector<HTMLElement>(`[data-line="${first}"]`);
    // Inside the block only, a few lines above the first import, so the page itself doesn't jump.
    if (row) box.current.scrollTop = Math.max(0, row.offsetTop - 3 * row.offsetHeight);
  }, [scrollToFirst, highlightLines, code]);
  return (
    <pre ref={box} className={cn("scrollbar-thin relative overflow-auto rounded-lg border border-line bg-code py-3 font-mono text-[11.5px] leading-[1.7]", className)}>
      <code className="grid min-w-max">
        {lines.map((line, i) => {
          const n = i + 1;
          return (
            <Fragment key={i}>
              <span data-line={n} className={cn("flex pr-4", highlightLines.has(n) && "bg-violet/[0.12] shadow-[inset_2px_0_0_var(--violet)]")}>
                <span className="w-10 shrink-0 select-none pr-3 text-right text-code-dim">{n}</span>
                <span className="text-code-fg">{highlight(line)}</span>
              </span>
            </Fragment>
          );
        })}
      </code>
    </pre>
  );
}
