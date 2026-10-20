import { FILES } from "@/data/repository";
import { CATEGORY_META, EDGE_KIND_META } from "@/lib/categories";
import {
  analyzeImpact,
  DEPENDENCIES,
  displayName,
  evidenceFor,
  FILE_METRICS,
  fileName,
  findPath,
  getFile,
  getIncoming,
  getMetrics,
  getOutgoing,
  LONGEST_CHAIN,
} from "@/lib/graph";
import type { Dependency, DependencyKind, ImpactMode } from "@/types/graph";

/**
 * A deterministic, template-based "assistant". It never calls a language model:
 * it resolves file mentions in the question, runs graph queries over the
 * synthetic dataset and formats the results.
 */

export type Inline =
  | { kind: "text"; text: string }
  | { kind: "strong"; text: string }
  | { kind: "code"; text: string }
  | { kind: "file"; id: string };

export interface EvidenceItem {
  source: string;
  target: string;
  kind: DependencyKind;
  line: number;
  text: string;
}

export type Block =
  | { type: "p"; content: Inline[] }
  | { type: "list"; items: Inline[][] }
  | { type: "path"; start: string; steps: EvidenceItem[] }
  | { type: "evidence"; items: EvidenceItem[] }
  | { type: "stats"; items: { label: string; value: string }[] }
  | { type: "note"; content: Inline[] };

export interface AssistantReply {
  blocks: Block[];
  action?: { fileId: string; mode: ImpactMode; label: string };
  /** File ids the answer is grounded in, used for the "Sources" footer. */
  sources: string[];
}

export const SUGGESTED_PROMPTS = [
  "What happens if I change the product data layer?",
  "Which files depend on the cart hook?",
  "Explain the path from the products page to the database.",
  "Which module has the most dependencies?",
  "Explain ProductCard in simple terms.",
];

// ── Inline markup: {{file-id}}, **strong**, `code` ──────────────────────────

export function md(input: string): Inline[] {
  const out: Inline[] = [];
  const re = /\{\{([a-z0-9-]+)\}\}|\*\*(.+?)\*\*|`([^`]+)`/g;
  let last = 0;
  for (const m of input.matchAll(re)) {
    if (m.index! > last) out.push({ kind: "text", text: input.slice(last, m.index) });
    if (m[1]) out.push({ kind: "file", id: m[1] });
    else if (m[2]) out.push({ kind: "strong", text: m[2] });
    else if (m[3]) out.push({ kind: "code", text: m[3] });
    last = m.index! + m[0].length;
  }
  if (last < input.length) out.push({ kind: "text", text: input.slice(last) });
  return out;
}

const p = (s: string): Block => ({ type: "p", content: md(s) });
const note = (s: string): Block => ({ type: "note", content: md(s) });
const f = (id: string) => `{{${id}}}`;
const plural = (n: number, one: string, many = one + "s") => `${n} ${n === 1 ? one : many}`;
const listFiles = (ids: string[]) => {
  if (ids.length <= 1) return ids.map(f).join("");
  return ids.slice(0, -1).map(f).join(", ") + " and " + f(ids[ids.length - 1]);
};

const toEvidence = (d: Dependency): EvidenceItem => ({
  source: d.source,
  target: d.target,
  kind: d.kind,
  ...evidenceFor(d),
});

// ── Entity resolution ───────────────────────────────────────────────────────

const GENERIC_NAMES = new Set(["page", "route", "layout"]);

const PHRASES: { phrase: string; id: string }[] = FILES.flatMap((file) => {
  const base = fileName(file.id).replace(/\.(tsx?|jsx?)$/, "").toLowerCase();
  const phrases = [
    ...file.aliases.map((a) => a.toLowerCase()),
    file.path.toLowerCase(),
    file.path.replace(/\.(tsx?|jsx?)$/, "").toLowerCase(),
  ];
  if (!GENERIC_NAMES.has(base)) phrases.push(base, fileName(file.id).toLowerCase());
  return phrases.map((phrase) => ({ phrase, id: file.id }));
});

const isWordChar = (ch: string | undefined) => !!ch && /[a-z0-9]/.test(ch);

/** Finds file mentions in order of appearance, preferring the longest phrase at each spot. */
export function resolveFiles(query: string): string[] {
  const q = query.toLowerCase();
  const hits: { start: number; end: number; id: string }[] = [];
  for (const { phrase, id } of PHRASES) {
    let from = 0;
    while (true) {
      const start = q.indexOf(phrase, from);
      if (start === -1) break;
      const end = start + phrase.length;
      if (!isWordChar(q[start - 1]) && !isWordChar(q[end])) hits.push({ start, end, id });
      from = start + 1;
    }
  }
  hits.sort((a, b) => b.end - b.start - (a.end - a.start) || a.start - b.start);
  const taken: typeof hits = [];
  for (const h of hits) {
    if (taken.some((t) => h.start < t.end && t.start < h.end)) continue;
    taken.push(h);
  }
  taken.sort((a, b) => a.start - b.start);
  return [...new Set(taken.map((t) => t.id))];
}

// ── Intents ─────────────────────────────────────────────────────────────────

function impactAnswer(id: string): AssistantReply {
  const result = analyzeImpact(id, "downstream");
  const file = getFile(id);
  if (result.order.length === 0) {
    return {
      blocks: [
        p(`Nothing in this repository imports ${f(id)}, so a change there stays local to the file itself.`),
        p(
          `It is an entry point (${CATEGORY_META[file.category].label.toLowerCase()}). Its own dependencies — ${plural(getOutgoing(id).length, "module")} — are unaffected by edits here.`,
        ),
      ],
      sources: [id],
    };
  }

  const byDepth = new Map<number, string[]>();
  for (const other of result.order) {
    const d = result.depths.get(other)!;
    byDepth.set(d, [...(byDepth.get(d) ?? []), other]);
  }
  const direct = getIncoming(id);
  const routes = result.order.filter((o) => getFile(o).category === "route");
  const crossesNetwork = [...result.edges].some(
    (e) => DEPENDENCIES.find((d) => d.id === e)?.kind === "fetch",
  );

  const blocks: Block[] = [
    p(
      `Changing ${f(id)} can reach **${plural(result.order.length, "module")}** across **${plural(result.maxDepth, "hop")}** of the dependency graph.`,
    ),
    {
      type: "list",
      items: [...byDepth.entries()].map(([depth, ids]) => [
        { kind: "strong", text: `Hop ${depth}` },
        { kind: "text", text: ` · ${ids.length} — ` },
        ...md(ids.slice(0, 5).map(f).join(", ") + (ids.length > 5 ? ` +${ids.length - 5} more` : "")),
      ]),
    },
    p(
      `The ${plural(direct.length, "direct importer")} ${direct.length === 1 ? "is" : "are"} where to look first. The longest chain ends at ${f(result.longestChain[result.longestChain.length - 1])}${routes.length ? `, and ${plural(routes.length, "route")} sit downstream` : ""}.`,
    ),
  ];
  if (crossesNetwork) {
    blocks.push(
      note(
        "Part of this chain crosses an HTTP boundary (`fetch` to an API route). Those clients are only affected if the response contract changes.",
      ),
    );
  }
  blocks.push(note("Illustrative static analysis over synthetic data — not a prediction of runtime breakage."));
  return {
    blocks,
    action: { fileId: id, mode: "downstream", label: "Show blast radius on graph" },
    sources: [id, ...direct.map((d) => d.source)],
  };
}

function dependentsAnswer(id: string): AssistantReply {
  const direct = getIncoming(id);
  const transitive = analyzeImpact(id, "downstream").order.length;
  if (!direct.length) {
    return { blocks: [p(`No file imports ${f(id)}. It is an entry point of the app.`)], sources: [id] };
  }
  return {
    blocks: [
      p(
        `**${plural(direct.length, "file")}** import ${f(id)} directly${transitive > direct.length ? `, and ${plural(transitive, "module")} depend on it transitively` : ""}:`,
      ),
      { type: "evidence", items: direct.map(toEvidence) },
      p(
        `Every reference above comes from a parsed statement, so the list is exhaustive for this dataset.`,
      ),
    ],
    action: { fileId: id, mode: "downstream", label: "Highlight dependents" },
    sources: [id, ...direct.map((d) => d.source)],
  };
}

function dependenciesAnswer(id: string): AssistantReply {
  const deps = getOutgoing(id);
  const upstream = analyzeImpact(id, "upstream").order.length;
  if (!deps.length) {
    return {
      blocks: [p(`${f(id)} has no internal dependencies — it is a leaf module that only uses the platform and npm packages.`)],
      sources: [id],
    };
  }
  return {
    blocks: [
      p(
        `${f(id)} depends on **${plural(deps.length, "module")}** directly${upstream > deps.length ? ` (${upstream} including transitive ones)` : ""}:`,
      ),
      { type: "evidence", items: deps.map(toEvidence) },
    ],
    action: { fileId: id, mode: "upstream", label: "Highlight upstream dependencies" },
    sources: [id, ...deps.map((d) => d.target)],
  };
}

function pathAnswer(from: string, to: string): AssistantReply {
  const forward = findPath(from, to);
  const backward = forward ? null : findPath(to, from);
  const path = forward ?? backward;
  if (!path) {
    return {
      blocks: [
        p(
          `There is no dependency path between ${f(from)} and ${f(to)} in either direction. They are independent in this graph, so changes to one cannot reach the other through imports.`,
        ),
      ],
      sources: [from, to],
    };
  }
  const [start, end] = forward ? [from, to] : [to, from];
  const kinds = new Set(path.map((d) => d.kind));
  return {
    blocks: [
      p(
        `${f(start)} reaches ${f(end)} in **${plural(path.length, "step")}**${backward ? " (the dependency runs the other way round)" : ""}:`,
      ),
      { type: "path", start, steps: path.map(toEvidence) },
      p(
        kinds.has("fetch")
          ? "The chain crosses the client/server boundary at the `fetch` call: everything before it runs in the browser, everything after it on the server."
          : "Every step is a static import, so this is a compile-time relationship.",
      ),
    ],
    sources: path.map((d) => d.source).concat(end),
  };
}

function rankingAnswer(query: string): AssistantReply {
  const all = [...FILE_METRICS.values()];
  const byFanOut = [...all].sort((a, b) => b.fanOut - a.fanOut || a.id.localeCompare(b.id));
  const byFanIn = [...all].sort((a, b) => b.fanIn - a.fanIn || a.id.localeCompare(b.id));
  const byReach = [...all].sort((a, b) => b.reach - a.reach || a.id.localeCompare(b.id));

  if (/complex/.test(query)) {
    const top = [...FILES].sort((a, b) => b.complexity - a.complexity).slice(0, 5);
    return {
      blocks: [
        p(`${f(top[0].id)} is the most complex module, with a synthetic complexity score of **${top[0].complexity}**.`),
        {
          type: "list",
          items: top.map((file) => md(`${f(file.id)} — score ${file.complexity}, ${file.loc} lines`)),
        },
      ],
      sources: top.map((t) => t.id),
    };
  }

  const wantsDependents = /(dependents|depended|imported the most|most used|most imported|relied)/.test(query);
  const ranked = wantsDependents ? byFanIn : byFanOut;
  const key = wantsDependents ? "fanIn" : "fanOut";
  const best = ranked[0][key];
  const leaders = ranked.filter((m) => m[key] === best);
  const runners = ranked.slice(leaders.length, leaders.length + 3);
  const other = wantsDependents ? byFanOut[0] : byFanIn[0];
  const lead =
    leaders.length === 1
      ? wantsDependents
        ? `${f(leaders[0].id)} is imported by the most modules: **${best} direct dependents**.`
        : `${f(leaders[0].id)} has the most dependencies: it imports **${best} modules** directly.`
      : `${listFiles(leaders.map((m) => m.id))} tie for the most ${wantsDependents ? "direct dependents" : "dependencies"}, with **${best} each**.`;

  return {
    blocks: [
      p(lead),
      p(`Next in line:`),
      { type: "list", items: runners.map((m) => md(`${f(m.id)} — ${m[key]}`)) },
      p(
        wantsDependents
          ? `By contrast, ${f(other.id)} has the most outgoing dependencies (${other.fanOut}).`
          : `On the other side, ${f(other.id)} is the most depended-upon module, with ${other.fanIn} direct importers — and ${f(byReach[0].id)} has the widest transitive reach (${byReach[0].reach} modules).`,
      ),
    ],
    action: { fileId: leaders[0].id, mode: wantsDependents ? "downstream" : "upstream", label: "Inspect on graph" },
    sources: [...leaders.map((m) => m.id), other.id, byReach[0].id],
  };
}

function explainAnswer(id: string, simple: boolean): AssistantReply {
  const file = getFile(id);
  const m = getMetrics(id);
  const deps = getOutgoing(id);
  const users = getIncoming(id);
  const category = CATEGORY_META[file.category].label.toLowerCase();

  const blocks: Block[] = [p(`${f(id)} is a ${category}. ${file.summary}`)];
  if (simple) {
    if (users.length) {
      blocks.push(
        p(
          `**Who uses it:** ${listFiles(users.map((d) => d.source))}. If it changes, ${plural(m.reach, "module")} could feel it.`,
        ),
      );
    } else blocks.push(p(`**Who uses it:** nothing imports it — it is an entry point.`));
    if (deps.length) {
      blocks.push(p(`**What it needs:** ${listFiles(deps.map((d) => d.target))}.`));
    }
  } else {
    blocks.push({
      type: "stats",
      items: [
        { label: "Imports", value: String(m.fanOut) },
        { label: "Imported by", value: String(m.fanIn) },
        { label: "Reach", value: String(m.reach) },
        { label: "Complexity", value: String(file.complexity) },
      ],
    });
    if (deps.length) blocks.push({ type: "evidence", items: deps.map(toEvidence) });
  }
  blocks.push(note(`Based on ${plural(deps.length + users.length, "parsed relationship")} in the synthetic graph.`));
  return {
    blocks,
    action: { fileId: id, mode: "direct", label: "Show neighbours on graph" },
    sources: [id, ...users.map((d) => d.source), ...deps.map((d) => d.target)],
  };
}

function overviewAnswer(): AssistantReply {
  const byKind = { import: 0, type: 0, fetch: 0 };
  for (const d of DEPENDENCIES) byKind[d.kind] += 1;
  const hubs = [...FILE_METRICS.values()].sort((a, b) => b.fanIn - a.fanIn).slice(0, 3);
  return {
    blocks: [
      p(
        `This synthetic storefront has **${FILES.length} files** and **${DEPENDENCIES.length} relationships**: ${byKind.import} imports, ${byKind.type} type-only imports and ${byKind.fetch} network calls.`,
      ),
      p(
        "It is layered top to bottom: routes → page components → leaf components → hooks → API routes → server data layer → database & types.",
      ),
      p(`The most depended-upon hubs are ${listFiles(hubs.map((h) => h.id))}. The longest import chain is ${LONGEST_CHAIN} hops.`),
    ],
    sources: hubs.map((h) => h.id),
  };
}

function helpAnswer(mentioned?: string): AssistantReply {
  return {
    blocks: [
      p(
        mentioned
          ? `I found ${f(mentioned)}, but I'm not sure what you'd like to know about it. Try asking what depends on it, what it imports, or what happens if it changes.`
          : "I can only answer questions about the demo repository's dependency graph. Try naming a file — for example `useCart`, `ProductCard` or the product data layer — and ask what depends on it, what it imports, or how two files connect.",
      ),
    ],
    sources: mentioned ? [mentioned] : [],
  };
}

export function answer(question: string): AssistantReply {
  const q = question.toLowerCase().replace(/\s+/g, " ").trim();
  const files = resolveFiles(q);
  const [first, second] = files;

  if (files.length >= 2 && /\b(path|flow|chain|connect|connected|get from|between|reach|from .+ to)\b/.test(q)) {
    return pathAnswer(first, second);
  }
  if (/\b(most|highest|largest|biggest|top|max(imum)?)\b/.test(q) && !first) {
    return rankingAnswer(q);
  }
  if (/\b(overview|architecture|structure|summari[sz]e|summary|layers|how big)\b/.test(q) && !first) {
    return overviewAnswer();
  }
  if (!first) return helpAnswer();

  if (/\b(what|which)\b.*\b(does|do)\b.*\b(depend on|import|use|need|rely on)\b/.test(q) || /\b(dependencies of|imports of|upstream)\b/.test(q)) {
    return dependenciesAnswer(first);
  }
  if (/\b(depend(s)? on|use(s)?|using|import(s)?|importers|dependents|consumers|rel(y|ies) on|who calls)\b/.test(q)) {
    return dependentsAnswer(first);
  }
  if (/\b(change|changing|modify|modifying|edit|refactor|break|impact|affect|happens if|blast radius|delete|remove|rename)\b/.test(q)) {
    return impactAnswer(first);
  }
  if (/\b(explain|what is|what's|what does|describe|tell me about|how does|simple|purpose|role)\b/.test(q) || files.length === 1) {
    return explainAnswer(first, /\b(simple|plain|eli5|beginner|non-technical)\b/.test(q));
  }
  return helpAnswer(first);
}

export const kindLabel = (kind: DependencyKind) => EDGE_KIND_META[kind].label;
export { displayName };
