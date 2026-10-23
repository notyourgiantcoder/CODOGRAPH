import type { RawFetch, UrlSegment } from "./extract.ts";
import type { Route, UnresolvedFetchReason } from "./types.ts";

// Pure: a fetch() call and the route list in, the one file it reaches (or why
// there isn't one) out. Route patterns arrive in their framework's own syntax:
// Next.js writes [id], [...slug] and [[...slug]]; NestJS writes :id.

type PatternSegment =
  | { kind: "static"; text: string }
  | { kind: "dynamic" }
  | { kind: "catch-all" }
  | { kind: "optional-catch-all" };

export type FetchOutcome =
  | { status: "matched"; target: string }
  | { status: "external" }
  | { status: "unresolved"; reason: UnresolvedFetchReason; detail: string };

// Next.js's precedence: at each position a static segment beats a dynamic one,
// which beats a catch-all, which beats an optional catch-all.
const RANK: Record<PatternSegment["kind"], number> = { static: 0, dynamic: 1, "catch-all": 2, "optional-catch-all": 3 };

export function createFetchMatcher(routes: readonly Route[]) {
  // A pattern holding anything else (a regex, a wildcard) can't be matched exactly, so it's left out.
  const compiled = routes.flatMap((route) => {
    const segments = compilePattern(route.pattern);
    return segments ? [{ route, segments }] : [];
  });

  return function match(call: RawFetch): FetchOutcome {
    switch (call.url.form) {
      case "absolute":
        return { status: "external" };
      case "computed":
        return { status: "unresolved", reason: "computed-url", detail: "the URL is built at runtime" };
      case "relative":
        return { status: "unresolved", reason: "relative-url", detail: "a relative URL depends on the page it's called from" };
    }
    const url = call.url.segments;

    const candidates = compiled.filter((c) => matches(c.segments, url));
    if (candidates.length === 0) {
      return { status: "unresolved", reason: "no-matching-route", detail: "no route the parser found has this path" };
    }
    // Only the most specific pattern can receive the request.
    const best = candidates.reduce((top, c) => (compareSpecificity(c.segments, top.segments) < 0 ? c : top));
    const winners = candidates.filter((c) => compareSpecificity(c.segments, best.segments) === 0);
    const forMethod = call.method === null ? winners : winners.filter((c) => c.route.method === call.method || c.route.method === "ALL");
    if (forMethod.length === 0) {
      return {
        status: "unresolved",
        reason: "no-matching-route",
        detail: `${best.route.pattern} has no ${call.method} handler`,
      };
    }
    const files = [...new Set(forMethod.map((c) => c.route.file))];
    if (files.length > 1) {
      return {
        status: "unresolved",
        reason: "several-files-match",
        detail: `${call.method ?? "an unwritten method"} reaches ${files.join(", ")}`,
      };
    }
    return { status: "matched", target: files[0] ?? "" };
  };
}

function compilePattern(pattern: string): PatternSegment[] | null {
  const segments: PatternSegment[] = [];
  for (const part of pattern.split("/").slice(1)) {
    if (part === "") continue;
    if (/^\[\[\.\.\.[^\]]+\]\]$/.test(part)) segments.push({ kind: "optional-catch-all" });
    else if (/^\[\.\.\.[^\]]+\]$/.test(part)) segments.push({ kind: "catch-all" });
    else if (/^\[[^\]]+\]$/.test(part) || /^:[A-Za-z0-9_]+$/.test(part)) segments.push({ kind: "dynamic" });
    else if (/[[\]:*()?+]/.test(part)) return null;
    else segments.push({ kind: "static", text: part });
  }
  return segments;
}

// A placeholder's value isn't known, so it can only land in a segment that takes any value.
function matches(pattern: readonly PatternSegment[], url: readonly UrlSegment[]): boolean {
  let i = 0;
  for (const segment of pattern) {
    if (segment.kind === "catch-all") return i < url.length;
    if (segment.kind === "optional-catch-all") return true;
    const part = url[i];
    if (!part) return false;
    if (segment.kind === "static" && !("static" in part && part.static === segment.text)) return false;
    i++;
  }
  return i === url.length;
}

function compareSpecificity(a: readonly PatternSegment[], b: readonly PatternSegment[]): number {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const x = a[i];
    const y = b[i];
    // Running out first means the other pattern only got here through an optional catch-all.
    if (!x || !y) return (x ? 1 : 0) - (y ? 1 : 0);
    if (RANK[x.kind] !== RANK[y.kind]) return RANK[x.kind] - RANK[y.kind];
  }
  return 0;
}
