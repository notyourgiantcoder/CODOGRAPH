# Phase 12 — The landing page's look, on real data

**Goal.** An analysed repository opens into the same workspace as the landing
page's interactive playground, and every screen around it looks like the
landing page.

## Build

- The landing page's visual system in the app: its palette, panels, glows, type
  scale and motion, in both themes. The theme switch still works.
- The analysis workspace laid out as the playground: a toolbar on top, a file
  explorer on the left, the map in the middle and an inspector on the right.
- Toolbar: jump-to-file search (`/` and ⌘K focus it), a filter chip per
  category with its count, a type-only-edges toggle, fit and reset.
- Categories are the roles the repository's frameworks define, each with a
  colour and an icon from the landing page's set. Turning one off hides its
  files from the map and dims them in the explorer.
- The map keeps folders folding into boxes, because a real repository is too big
  to draw file by file, but every box, row and line looks like the landing
  page's: rounded panels with a role icon, violet lines into the selection, cyan
  lines out of it, dashed lines for type-only imports and network calls, arrows,
  a dotted background, a legend, a minimap and zoom controls.
- The explorer is the repository's real folder tree. Clicking a file selects it
  and brings it into view on the map.
- The inspector, for a file: icon, name, role, path with copy, and four counts —
  incoming, outgoing, complexity, lines. Tabs: Overview (the model's explanation
  on request, exports, complexity, connected files), Deps, Dependents (each
  with its kind and the line that creates it) and Code (the file at the analysed
  commit, with the lines that create edges highlighted).
- For a folder, and for nothing selected, the inspector shows what it shows
  today, in the new look.
- The workspace header, the dashboard, sign-in and progress screens in the
  landing page's look.

## Constraints

- Nothing new is guessed: every count, line and colour comes from the parse.
- The code shown is the analysed commit's, checked against the stored hash; if
  GitHub's copy differs, the tab says so instead of showing it.
- Complexity is shown as a count of branch points, not a rating.

## Acceptance check

1. Open an analysis. It reads as the landing page's playground: toolbar,
   explorer, map, inspector, legend, minimap.
2. Search for a file, pick it: its folder opens on the map, it's selected, and
   the inspector shows it.
3. Turn a category off: its files leave the map and dim in the explorer.
4. Select a file: violet lines into it, cyan lines out, everything else dims.
5. The Code tab shows the file with its import lines highlighted.
6. Switch to light theme: everything stays readable.

## Not in this phase

Impact analysis and paths (13), the assistant (14), the insights dashboard (15).
