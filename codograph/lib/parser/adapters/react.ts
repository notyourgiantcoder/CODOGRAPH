import { ts, type SourceFile } from "ts-morph";
import type { Role } from "../../roles.ts";
import { toolConventions, toolRole } from "./conventions.ts";
import { NO_ROUTES, type AdapterFile, type FrameworkAdapter } from "./types.ts";

// React has two conventions a file can be read by. A hook's name starts with
// "use" — React's own rule, which its lint enforces. A component renders JSX,
// which is in the syntax tree rather than in a naming habit, so a .tsx file of
// helpers isn't claimed as one.
const HOOK_NAME = /^use([A-Z0-9]|-[a-z0-9])/;

export function reactRole({ path, source }: AdapterFile): Role | null {
  const name = path.slice(path.lastIndexOf("/") + 1);
  if (HOOK_NAME.test(name)) return "hook";
  if (containsJsx(source)) return "component";
  return null;
}

// Walks the compiler's own nodes and stops at the first JSX: wrapping every
// node of a file that has none, to learn that it has none, is the slowest
// thing a large repository's parse would otherwise do.
function containsJsx(source: SourceFile): boolean {
  const visit = (node: ts.Node): boolean =>
    ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node) || ts.isJsxFragment(node) || ts.forEachChild(node, visit) === true;
  return ts.forEachChild(source.compilerNode, visit) === true;
}

export const reactAdapter: FrameworkAdapter = {
  name: "React",
  detect: (project) => project.dependencies.has("react"),
  excludeDirectory: () => null,
  reachedBy: toolConventions,
  // Tests render JSX too; the runner's pattern says what they are first.
  roleOf: (file) => toolRole(file.path) ?? reactRole(file),
  routeSource: () => false,
  routes: () => NO_ROUTES,
};
