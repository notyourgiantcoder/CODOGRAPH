# Phase 13 — A big repository, made simple

**Goal.** A repository of tens of thousands of files opens as a handful of
parts you can read, and you go deeper by clicking, the way a map zooms.

## Build

- Tests are hidden when an analysis opens. The Tests chip turns them back on,
  and picking a test file anywhere brings them back.
- The map shows one folder at a time: its subfolders as boxes, its own files as
  a panel of rows. It starts at the repository root. Clicking a box goes into
  that folder; a breadcrumb above the map goes back out to any level.
- Inside a folder, imports to and from the rest of the repository still show:
  each one ends at a box for the outside folder it comes from, drawn apart from
  the folder's own boxes, saying how many of its files are linked. Clicking one
  goes there.
- Only the strongest connections are drawn when there are many, with a switch
  to show them all. Lines touching the selection are always drawn.
- A Focus view for a selected file: the file in the middle, what imports it on
  one side and what it imports on the other, nothing else. Clicking a neighbour
  moves the focus to it.
- Revealing a file (search, explorer, inspector) goes to its folder and
  selects it.

## Constraints

- Nothing new is guessed. Every box is a real folder, every line stands for
  real edges, and a count says how many.
- Each box is a real subfolder directly inside the folder in view. A folder
  with more than 23 subfolders boxes the 23 biggest; the smaller ones' files
  are listed with the folder's own, under a label that says how many folders
  they came from.
- A folder holding nothing but one subfolder is passed through on the way
  down, so no click lands on an empty level.
- Explaining a folder explains the folder as it is, whatever the map shows.

## Acceptance check

1. Open stablyai/orca. The map shows a few top-level parts, not 24 scattered
   folders, and tests are off.
2. Click into src, then main: the breadcrumb reads orca / src / main, imports
   to the rest of src show as outside boxes, and clicking the breadcrumb goes
   back.
3. Search for a file: the map goes to its folder and selects it.
4. Select a file and open Focus: only it and its neighbours are drawn.

## Not in this phase

An Electron adapter (a known limitation: Electron apps' main-process files
stay unclassified). Impact analysis and paths, the assistant and insights move
to phases 14–16.
