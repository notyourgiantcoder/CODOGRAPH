import { Fragment, type ReactNode } from "react";
import { cn } from "@/lib/cn";

const KEYWORDS = new Set([
  "import",
  "from",
  "export",
  "default",
  "function",
  "const",
  "let",
  "return",
  "if",
  "else",
  "async",
  "await",
  "type",
  "interface",
  "new",
  "as",
  "satisfies",
  "typeof",
  "extends",
  "undefined",
  "null",
  "true",
  "false",
]);

const TOKEN = /(\/\/.*$)|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)|(\b\d[\d_]*\b)|(\b[A-Za-z_$][\w$]*\b)/g;

/** A tiny, dependency-free highlighter good enough for illustrative TS/TSX snippets. */
function highlight(line: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  for (const m of line.matchAll(TOKEN)) {
    const i = m.index!;
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
  highlightLines = [],
  className,
  startLine = 1,
}: {
  code: string;
  highlightLines?: number[];
  className?: string;
  startLine?: number;
}) {
  const lines = code.split("\n");
  return (
    <pre
      className={cn(
        "scrollbar-thin overflow-auto rounded-lg border border-line bg-[#0c0e12] py-3 font-mono text-[11.5px] leading-[1.7]",
        className,
      )}
    >
      <code className="grid min-w-max">
        {lines.map((line, i) => {
          const n = i + startLine;
          const hl = highlightLines.includes(n);
          return (
            <Fragment key={i}>
              <span
                className={cn(
                  "flex pr-4",
                  hl && "bg-violet/[0.12] shadow-[inset_2px_0_0_var(--color-violet)]",
                )}
              >
                <span className="w-10 shrink-0 select-none pr-3 text-right text-[#4b5060]">{n}</span>
                <span className="text-[#d7dae2]">{highlight(line)}</span>
              </span>
            </Fragment>
          );
        })}
      </code>
    </pre>
  );
}
