"use client";

import { AnimatePresence, motion } from "motion/react";
import { usePrefersReducedMotion } from "@/lib/useMediaQuery";
import { ArrowUp, Info, Radar, Sparkles, Trash2 } from "lucide-react";
import { Fragment, useEffect, useRef, useState } from "react";
import { useDemo } from "@/components/demo/DemoProvider";
import { CategoryIcon } from "@/components/graph/CategoryIcon";
import { IconButton } from "@/components/ui/primitives";
import { answer, SUGGESTED_PROMPTS, type AssistantReply, type Block, type EvidenceItem, type Inline } from "@/lib/assistant";
import { EDGE_KIND_META } from "@/lib/categories";
import { cn } from "@/lib/cn";
import { displayName, getFile } from "@/lib/graph";

interface Message {
  id: number;
  role: "user" | "assistant";
  text?: string;
  reply?: AssistantReply;
  /** Number of reply blocks revealed so far (for the streaming effect). */
  shown: number;
}

let messageId = 0;

function seed(question: string): Message[] {
  const reply = answer(question);
  return [
    { id: ++messageId, role: "user", text: question, shown: 0 },
    { id: ++messageId, role: "assistant", reply, shown: reply.blocks.length },
  ];
}

export function AssistantPanel({
  variant = "full",
  className,
  seedQuestion,
}: {
  variant?: "full" | "mini";
  className?: string;
  seedQuestion?: string;
}) {
  const reduceMotion = usePrefersReducedMotion();
  const [messages, setMessages] = useState<Message[]>(() => (seedQuestion ? seed(seedQuestion) : []));
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const timers = useRef<number[]>([]);
  const mini = variant === "mini";

  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);

  // Keep the newest content in view without scrolling the page itself.
  useEffect(() => {
    const box = scroller.current;
    if (box) box.scrollTo({ top: box.scrollHeight, behavior: reduceMotion ? "auto" : "smooth" });
  }, [messages, typing, reduceMotion]);

  const busy = typing || messages.some((m) => m.reply && m.shown < m.reply.blocks.length);

  const send = (raw: string) => {
    const text = raw.trim();
    if (!text || busy) return;
    setInput("");
    setMessages((m) => [...m, { id: ++messageId, role: "user", text, shown: 0 }]);
    setTyping(true);

    const reply = answer(text);
    const id = ++messageId;
    const later = (fn: () => void, ms: number) => timers.current.push(window.setTimeout(fn, ms));

    later(
      () => {
        setTyping(false);
        setMessages((m) => [...m, { id, role: "assistant", reply, shown: reduceMotion ? reply.blocks.length : 1 }]);
        if (reduceMotion) return;
        for (let i = 2; i <= reply.blocks.length; i++) {
          later(() => setMessages((m) => m.map((msg) => (msg.id === id ? { ...msg, shown: i } : msg))), (i - 1) * 170);
        }
      },
      reduceMotion ? 0 : 650 + Math.min(500, text.length * 6),
    );
  };

  const clear = () => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
    setTyping(false);
    setMessages([]);
  };

  const suggestions = mini ? SUGGESTED_PROMPTS.slice(0, 2) : SUGGESTED_PROMPTS;

  return (
    <div className={cn("flex min-h-0 flex-col", className)}>
      <div className={cn("flex shrink-0 items-center gap-2 border-b border-line", mini ? "px-3 py-2" : "px-4 py-3")}>
        <span className="flex size-6 items-center justify-center rounded-md bg-gradient-to-br from-violet to-cyan/80 shadow-[0_0_16px_-2px_rgba(139,92,246,0.7)]">
          <Sparkles className="size-3.5 text-white" aria-hidden />
        </span>
        <p className={cn("font-medium text-fg", mini ? "text-[12.5px]" : "text-[13.5px]")}>Assistant</p>
        <span className="rounded-full border border-amber-300/25 bg-amber-300/[0.07] px-1.5 py-px text-[9.5px] font-medium uppercase tracking-wider text-amber-200/80">
          Simulated demo
        </span>
        <IconButton label="Clear conversation" className="ml-auto size-7" onClick={clear} disabled={!messages.length && !typing}>
          <Trash2 className="size-3.5" />
        </IconButton>
      </div>

      <div
        ref={scroller}
        className={cn("scrollbar-thin min-h-0 flex-1 overflow-y-auto", mini ? "space-y-3 px-3 py-3" : "space-y-4 px-4 py-4")}
        aria-live="polite"
      >
        {messages.length === 0 && !typing && (
          <div className="flex h-full flex-col justify-center gap-2 py-4 text-center">
            <p className="text-[13px] font-medium text-fg">Ask about the demo repository</p>
            <p className="mx-auto max-w-[280px] text-[12px] leading-relaxed text-subtle">
              Answers are assembled from local graph queries over synthetic data. No language model is called.
            </p>
          </div>
        )}
        <AnimatePresence initial={false}>
          {messages.map((m) =>
            m.role === "user" ? (
              <motion.div
                key={m.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex justify-end"
              >
                <p
                  className={cn(
                    "max-w-[85%] rounded-2xl rounded-br-md bg-violet/90 px-3 py-2 text-white shadow-[0_6px_20px_-8px_rgba(139,92,246,0.8)]",
                    mini ? "text-[12px]" : "text-[13px]",
                  )}
                >
                  {m.text}
                </p>
              </motion.div>
            ) : (
              <motion.div key={m.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                <ReplyView reply={m.reply!} shown={m.shown} mini={mini} />
              </motion.div>
            ),
          )}
        </AnimatePresence>
        {typing && (
          <div className="flex items-center gap-2 text-[12px] text-subtle" aria-label="Assistant is typing">
            <span className="flex gap-1 rounded-2xl rounded-bl-md border border-line bg-white/[0.03] px-3 py-2.5">
              {[0, 1, 2].map((i) => (
                <span key={i} className="size-1.5 animate-dot rounded-full bg-muted" style={{ animationDelay: `${i * 0.15}s` }} />
              ))}
            </span>
            Querying the graph…
          </div>
        )}
      </div>

      <div className={cn("shrink-0 border-t border-line", mini ? "space-y-2 p-2.5" : "space-y-2.5 p-3")}>
        <div className={cn("scrollbar-thin flex gap-1.5", mini ? "overflow-x-auto" : "flex-wrap")}>
          {suggestions.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => send(s)}
              disabled={busy}
              className={cn(
                "shrink-0 rounded-full border border-line-strong bg-white/[0.02] px-2.5 py-1 text-left text-muted transition hover:border-violet/40 hover:bg-violet/[0.08] hover:text-fg active:scale-[0.97] disabled:opacity-50",
                mini ? "text-[11px]" : "text-[11.5px]",
              )}
            >
              {s}
            </button>
          ))}
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
          className="flex items-center gap-2 rounded-xl border border-line-strong bg-black/20 py-1 pl-3 pr-1 transition focus-within:border-violet/50 focus-within:shadow-[0_0_0_3px_rgba(139,92,246,0.12)]"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about a file, path or change…"
            aria-label="Ask the simulated assistant"
            className={cn("min-w-0 flex-1 bg-transparent text-fg outline-none placeholder:text-subtle", mini ? "text-[12px]" : "text-[13px]")}
          />
          <button
            type="submit"
            disabled={!input.trim() || busy}
            aria-label="Send question"
            className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-fg text-bg transition hover:bg-white active:scale-90 disabled:bg-white/10 disabled:text-subtle"
          >
            <ArrowUp className="size-4" />
          </button>
        </form>
      </div>
    </div>
  );
}

function ReplyView({ reply, shown, mini }: { reply: AssistantReply; shown: number; mini: boolean }) {
  const { runImpact } = useDemo();
  const done = shown >= reply.blocks.length;
  return (
    <div className={cn("space-y-2.5 leading-relaxed text-fg/90", mini ? "text-[12px]" : "text-[13px]")}>
      {reply.blocks.slice(0, shown).map((block, i) => (
        <motion.div key={i} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
          <BlockView block={block} />
        </motion.div>
      ))}
      {done && (reply.action || reply.sources.length > 0) && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-wrap items-center gap-2 pt-0.5">
          {reply.action && (
            <button
              type="button"
              onClick={() => runImpact(reply.action!.fileId, reply.action!.mode)}
              className="inline-flex items-center gap-1.5 rounded-md border border-cyan/30 bg-cyan/[0.07] px-2 py-1 text-[11px] font-medium text-cyan transition hover:bg-cyan/[0.14] active:scale-95"
            >
              <Radar className="size-3" aria-hidden />
              {reply.action.label}
            </button>
          )}
          {reply.sources.length > 0 && (
            <span className="text-[10.5px] text-subtle">
              Grounded in {new Set(reply.sources).size} {new Set(reply.sources).size === 1 ? "file" : "files"}
            </span>
          )}
        </motion.div>
      )}
    </div>
  );
}

function FileChip({ id }: { id: string }) {
  const { select } = useDemo();
  return (
    <button
      type="button"
      onClick={() => select(id, { focus: true })}
      className="mx-0.5 inline-flex translate-y-[1px] items-center gap-1 rounded-md border border-line-strong bg-white/[0.04] px-1 py-px align-baseline font-mono text-[0.88em] text-fg transition hover:border-violet/50 hover:bg-violet/[0.12]"
      title={`Select ${getFile(id).path} in the graph`}
    >
      <CategoryIcon category={getFile(id).category} size="xs" className="size-3.5" />
      {displayName(id)}
    </button>
  );
}

function InlineView({ content }: { content: Inline[] }) {
  return (
    <>
      {content.map((c, i) => (
        <Fragment key={i}>
          {c.kind === "text" && c.text}
          {c.kind === "strong" && <strong className="font-semibold text-fg">{c.text}</strong>}
          {c.kind === "code" && (
            <code className="rounded bg-white/[0.06] px-1 py-px font-mono text-[0.9em] text-fg">{c.text}</code>
          )}
          {c.kind === "file" && <FileChip id={c.id} />}
        </Fragment>
      ))}
    </>
  );
}

function EvidenceRow({ item, showSource = true }: { item: EvidenceItem; showSource?: boolean }) {
  return (
    <div className="flex min-w-0 items-center gap-1.5">
      {showSource && <FileChip id={item.source} />}
      <code className="min-w-0 truncate rounded bg-black/30 px-1.5 py-0.5 font-mono text-[10.5px] text-subtle">
        <span className="text-[#5d6274]">L{item.line}</span> {item.text}
      </code>
    </div>
  );
}

function BlockView({ block }: { block: Block }) {
  switch (block.type) {
    case "p":
      return (
        <p>
          <InlineView content={block.content} />
        </p>
      );
    case "note":
      return (
        <p className="flex gap-1.5 text-[0.9em] text-subtle">
          <Info className="mt-[3px] size-3 shrink-0" aria-hidden />
          <span>
            <InlineView content={block.content} />
          </span>
        </p>
      );
    case "list":
      return (
        <ul className="space-y-1 pl-1">
          {block.items.map((item, i) => (
            <li key={i} className="flex gap-2">
              <span className="mt-[0.6em] size-1 shrink-0 rounded-full bg-violet-soft" />
              <span>
                <InlineView content={item} />
              </span>
            </li>
          ))}
        </ul>
      );
    case "evidence":
      return (
        <div className="space-y-1.5 rounded-lg border border-line bg-white/[0.015] p-2">
          {block.items.map((item) => (
            <EvidenceRow key={`${item.source}-${item.target}`} item={item} />
          ))}
        </div>
      );
    case "path":
      return (
        <ol className="relative space-y-1.5 rounded-lg border border-line bg-white/[0.015] p-2.5">
          <li>
            <FileChip id={block.start} />
          </li>
          {block.steps.map((step, i) => (
            <li key={i} className="space-y-1.5">
              <div className="ml-2.5 flex items-center gap-2 border-l border-dashed border-line-strong py-0.5 pl-3">
                <span
                  className={cn(
                    "shrink-0 rounded px-1 text-[10px] font-medium",
                    step.kind === "fetch" ? "bg-cyan/10 text-cyan" : "bg-white/[0.06] text-muted",
                  )}
                >
                  {EDGE_KIND_META[step.kind].verb}
                </span>
                <code className="min-w-0 truncate font-mono text-[10.5px] text-subtle">
                  <span className="text-[#5d6274]">L{step.line}</span> {step.text}
                </code>
              </div>
              <FileChip id={step.target} />
            </li>
          ))}
        </ol>
      );
    case "stats":
      return (
        <dl className="grid grid-cols-4 gap-1.5">
          {block.items.map((s) => (
            <div key={s.label} className="rounded-md border border-line bg-white/[0.02] px-2 py-1">
              <dt className="text-[10px] text-subtle">{s.label}</dt>
              <dd className="font-mono text-[13px] text-fg">{s.value}</dd>
            </div>
          ))}
        </dl>
      );
  }
}
