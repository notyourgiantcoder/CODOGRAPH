# Phase 11 — Complexity and network calls

**Goal.** The parser knows two more facts the landing page's demo shows: how
much branching each file has, and which files call an API route over HTTP.

## Build

- A complexity count for every parsed file: one, plus every branch point
  written in it — `if`, `?:`, each `case`, every loop, `catch`, and each `&&`,
  `||` and `??` (including their assignment forms). It's a count of syntax, not
  a grade, and it's labelled as a count wherever it's shown.
- `fetch()` calls become edges of a new kind, `fetch`, from the calling file to
  the file that declares the route it calls. The URL has to be written in the
  call: a string literal, or a template whose placeholders sit inside path
  segments. The method comes from a literal `method` in the options, `GET` when
  there are no options.
- A URL is matched against the routes the adapters already found, with Next.js's
  precedence: a static segment beats a dynamic one, which beats a catch-all. A
  placeholder segment can only match a dynamic or catch-all segment.
- Every `fetch()` call is counted. One that becomes an edge is matched; an
  absolute URL is external; everything else is unresolved with a reason —
  computed URL, relative URL, no matching route, or more than one file matching.

## Constraints

- Never guess. A call that could reach two files is unresolved, not drawn to
  either. Express routes are withheld, so calls to an Express API stay
  unresolved, and that's correct.
- Import resolution doesn't change: the import edges for a repository are
  byte-identical to before. Fan-in and fan-out still count imports only.
- The schema version goes up, so analyses stored by the older parser ask to be
  re-run instead of showing a complexity they never had.

## Acceptance check

1. `pnpm parse` on a Next.js repository with route handlers lists the fetch
   calls it matched and the ones it couldn't, each with a reason.
2. A file with no branches has complexity 1; adding an `if` makes it 2.
3. The import edges for a repository parsed before this change are identical.

## Not in this phase

Showing any of this in the UI. That's phases 12–15.
