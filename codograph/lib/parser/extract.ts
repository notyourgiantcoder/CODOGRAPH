import { Node, ts, type ImportClause, type SourceFile } from "ts-morph";
import type { ImportKind } from "./types.ts";

// Searching a whole file goes through the compiler's own tree, not ts-morph's
// wrappers: wrapping every node of a large repository costs minutes and
// gigabytes for what one walk of plain nodes answers. Top-level statements,
// few and already wrapped, are still read through ts-morph.

/**
 * Every node the extractors search a file for, gathered in one walk. Pre-order
 * through forEachChild, the order ts-morph's descendant searches use, so what
 * is found and the order it's found in are the same.
 */
export type Scan = {
  source: ts.SourceFile;
  calls: ts.CallExpression[];
  /** Plain `=` assignments: the CommonJS export forms. */
  assignments: ts.BinaryExpression[];
};

export function scanFile(sourceFile: SourceFile): Scan {
  const source = sourceFile.compilerNode;
  const calls: ts.CallExpression[] = [];
  const assignments: ts.BinaryExpression[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node)) calls.push(node);
    else if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken) assignments.push(node);
    ts.forEachChild(node, visit);
  };
  ts.forEachChild(source, visit);
  return { source, calls, assignments };
}

/** The line a node starts on, its leading comments left out, as ts-morph counts it. */
function lineOf(node: ts.Node, source: ts.SourceFile): number {
  return source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
}

export type RawImport = {
  kind: ImportKind;
  line: number;
  typeOnly: boolean;
} & (
  | { literal: true; specifier: string }
  // import(someVariable), require(someVariable): seen and reported, but there is no path to resolve.
  | { literal: false; expression: string }
);

export function extractImports(sourceFile: SourceFile, scan: Scan): RawImport[] {
  const found: RawImport[] = [];

  // Static imports and re-exports are only legal at the top level of a module.
  for (const statement of sourceFile.getStatements()) {
    if (Node.isImportDeclaration(statement)) {
      const clause = statement.getImportClause();
      found.push({
        kind: "import",
        literal: true,
        specifier: statement.getModuleSpecifierValue(),
        line: statement.getStartLineNumber(),
        typeOnly: clause ? isTypeOnlyClause(clause) : false,
      });
    } else if (Node.isExportDeclaration(statement)) {
      const specifier = statement.getModuleSpecifierValue();
      if (specifier === undefined) continue; // `export { a }` names a local, not a file
      found.push({
        kind: "re-export",
        literal: true,
        specifier,
        line: statement.getStartLineNumber(),
        typeOnly: statement.isTypeOnly() || allTypeOnly(statement.getNamedExports()),
      });
    } else if (Node.isImportEqualsDeclaration(statement)) {
      // `import x = require("y")` is TypeScript import syntax, not a require() call.
      const reference = statement.getModuleReference();
      if (Node.isExternalModuleReference(reference)) {
        const expression = reference.getExpression();
        if (expression && Node.isStringLiteral(expression)) {
          found.push({
            kind: "import",
            literal: true,
            specifier: expression.getLiteralValue(),
            line: statement.getStartLineNumber(),
            typeOnly: statement.isTypeOnly(),
          });
        }
      }
    }
  }

  // import() and require() can appear anywhere an expression can. The
  // `require` inside `import x = require("y")` above is not a call expression,
  // so nothing here sees it a second time.
  const { source } = scan;
  for (const call of scan.calls) {
    const callee = call.expression;
    const kind: ImportKind | null =
      callee.kind === ts.SyntaxKind.ImportKeyword
        ? "dynamic-import"
        : ts.isIdentifier(callee) && callee.getText(source) === "require"
          ? "require"
          : null;
    if (kind === null) continue;
    const [argument] = call.arguments;
    const line = lineOf(call, source);
    if (argument && (ts.isStringLiteral(argument) || ts.isNoSubstitutionTemplateLiteral(argument))) {
      found.push({ kind, literal: true, specifier: argument.text, line, typeOnly: false });
    } else {
      found.push({ kind, literal: false, expression: argument ? argument.getText(source) : "", line, typeOnly: false });
    }
  }

  return found;
}

/** A path segment of a fetch() URL: written out, or holding a template placeholder. */
export type UrlSegment = { static: string } | { placeholder: true };

export type RawFetch = {
  line: number;
  /** The URL argument as written. */
  text: string;
  /** Upper case. Null when the options set a method that isn't written as a literal. */
  method: string | null;
  url:
    | { form: "path"; segments: UrlSegment[] }
    | { form: "absolute" }
    | { form: "relative" }
    | { form: "computed" };
};

// The global fetch, called directly or through window, globalThis or self.
const FETCH_RECEIVERS = new Set(["window", "globalThis", "self"]);

/**
 * Every fetch() call, with its URL and method read from the syntax. Only what
 * is written in the call counts: a URL held in a variable is computed, because
 * following the variable would mean deciding which value it has at runtime.
 */
export function extractFetches(scan: Scan): RawFetch[] {
  const { source } = scan;
  const found: RawFetch[] = [];
  for (const call of scan.calls) {
    const callee = call.expression;
    const isFetch =
      (ts.isIdentifier(callee) && callee.getText(source) === "fetch") ||
      (ts.isPropertyAccessExpression(callee) && callee.name.text === "fetch" && FETCH_RECEIVERS.has(callee.expression.getText(source)));
    if (!isFetch) continue;
    const [urlArgument, options] = call.arguments;
    if (!urlArgument) continue;
    found.push({
      line: lineOf(call, source),
      text: urlArgument.getText(source),
      method: fetchMethod(options, source),
      url: fetchUrl(urlArgument),
    });
  }
  return found;
}

// Placeholders are kept as whole segments; the query string and fragment never
// choose a route, so they're dropped along with anything placed in them.
function fetchUrl(argument: ts.Expression): RawFetch["url"] {
  let written: (string | null)[];
  if (ts.isStringLiteral(argument) || ts.isNoSubstitutionTemplateLiteral(argument)) {
    written = [argument.text];
  } else if (ts.isTemplateExpression(argument)) {
    written = [argument.head.text];
    for (const span of argument.templateSpans) written.push(null, span.literal.text);
  } else {
    return { form: "computed" };
  }

  const first = written[0] ?? "";
  if (first === "" && written.length > 1) return { form: "computed" }; // `${base}/api/…`
  if (/^[a-z][a-z0-9+.-]*:/i.test(first) || first.startsWith("//")) return { form: "absolute" };
  if (!first.startsWith("/")) return { form: "relative" };

  const segments: UrlSegment[] = [];
  let current = "";
  let placeholder = false;
  const close = () => {
    segments.push(placeholder ? { placeholder: true } : { static: current });
    current = "";
    placeholder = false;
  };
  outer: for (const part of written) {
    if (part === null) {
      placeholder = true;
      continue;
    }
    for (const char of part) {
      if (char === "?" || char === "#") break outer;
      if (char === "/") close();
      else current += char;
    }
  }
  close();
  // The leading "/" opens an empty first segment; a trailing "/" closes an empty last one.
  return { form: "path", segments: segments.slice(1).filter((s, i, all) => !(i === all.length - 1 && "static" in s && s.static === "")) };
}

function fetchMethod(options: ts.Expression | undefined, source: ts.SourceFile): string | null {
  if (!options) return "GET";
  if (!ts.isObjectLiteralExpression(options)) return null;
  let method = "GET";
  for (const property of options.properties) {
    if (ts.isSpreadAssignment(property)) return null;
    if (ts.isShorthandPropertyAssignment(property) && property.name.text === "method") return null;
    if (!ts.isPropertyAssignment(property)) continue;
    const name = property.name;
    const key = ts.isIdentifier(name) ? name.getText(source) : literalText(name);
    if (key === null) return null; // a computed key could be "method"
    if (key !== "method") continue;
    const value = literalText(property.initializer);
    if (value === null) return null;
    method = value.toUpperCase();
  }
  return method;
}

/** What `module.exports = <value>` is called when the value's own names can't all be read. */
export const WHOLE_MODULE = "module.exports";

type Add = (name: string, at: number) => void;

/**
 * The names a file exports, read from its own syntax: ESM export statements at
 * the top level, and CommonJS assignments to module.exports or exports
 * wherever they appear. Source order, each name once.
 */
export function extractExports(sourceFile: SourceFile, scan: Scan): string[] {
  const { source } = scan;
  const found: { name: string; at: number }[] = [];
  const add: Add = (name, at) => found.push({ name, at });

  for (const statement of sourceFile.getStatements()) {
    if (Node.isExportDeclaration(statement)) {
      // `export * from` names nothing here; `export * as ns from` names ns.
      const namespace = statement.getNamespaceExport();
      if (namespace) add(namespace.getName(), statement.getStart());
      for (const specifier of statement.getNamedExports()) {
        add(specifier.getAliasNode()?.getText() ?? specifier.getName(), specifier.getStart());
      }
    } else if (Node.isExportAssignment(statement)) {
      // `export = x` is TypeScript's spelling of module.exports = x.
      if (statement.isExportEquals()) addWholeModule(statement.getExpression().compilerNode, add, source);
      else add("default", statement.getStart());
    } else if (Node.isVariableStatement(statement)) {
      if (!statement.hasExportKeyword()) continue;
      for (const declaration of statement.getDeclarations()) {
        const name = declaration.getNameNode();
        if (Node.isIdentifier(name)) add(name.getText(), name.getStart());
        // `export const { a, b: c } = x` exports a and c.
        else for (const element of name.getDescendantsOfKind(ts.SyntaxKind.BindingElement)) {
          const bound = element.getNameNode();
          if (Node.isIdentifier(bound)) add(bound.getText(), bound.getStart());
        }
      }
    } else if (
      Node.isFunctionDeclaration(statement) ||
      Node.isClassDeclaration(statement) ||
      Node.isInterfaceDeclaration(statement) ||
      Node.isTypeAliasDeclaration(statement) ||
      Node.isEnumDeclaration(statement) ||
      Node.isModuleDeclaration(statement) ||
      Node.isImportEqualsDeclaration(statement)
    ) {
      if (!statement.hasExportKeyword()) continue;
      if (statement.hasDefaultKeyword()) {
        add("default", statement.getStart());
        continue;
      }
      const name = statement.getNameNode();
      // `declare module "x"` is named by a string and exports nothing from this file.
      if (name && Node.isIdentifier(name)) add(name.getText(), name.getStart());
    }
  }

  for (const assignment of scan.assignments) {
    const target = assignment.left;
    if (isModuleExports(target, source)) {
      addWholeModule(assignment.right, add, source);
      continue;
    }
    // module.exports.name = …, exports.name = …, and the ["name"] forms.
    if (ts.isPropertyAccessExpression(target) || ts.isElementAccessExpression(target)) {
      const object = target.expression;
      if (!isModuleExports(object, source) && !(ts.isIdentifier(object) && object.getText(source) === "exports")) continue;
      const name = ts.isPropertyAccessExpression(target) ? target.name.text : literalText(target.argumentExpression);
      if (name !== null) add(name, target.getStart(source));
    }
  }

  // Object.defineProperty(exports, "name", …) is how compiled CommonJS writes
  // them. "__esModule" is the compiler's own marker, not something exported.
  for (const call of scan.calls) {
    if (call.expression.getText(source) !== "Object.defineProperty") continue;
    const [object, key] = call.arguments;
    if (!object || !(isModuleExports(object, source) || object.getText(source) === "exports")) continue;
    const name = literalText(key);
    if (name !== null && name !== "__esModule") add(name, call.getStart(source));
  }

  found.sort((a, b) => a.at - b.at);
  return [...new Set(found.map((f) => f.name))];
}

/**
 * Whether everything the file exports is a type: exported interfaces and type
 * aliases, and export lists marked type-only. Anything that might carry a
 * value says no: a value declaration, a default or `export =`, `export *`, an
 * export list not marked type-only, or any CommonJS export. A file exporting
 * nothing isn't a types file either.
 */
export function exportsOnlyTypes(sourceFile: SourceFile, scan: Scan): boolean {
  let exportsSomething = false;
  for (const statement of sourceFile.getStatements()) {
    if (Node.isInterfaceDeclaration(statement) || Node.isTypeAliasDeclaration(statement)) {
      if (statement.hasExportKeyword()) exportsSomething = true;
    } else if (Node.isExportDeclaration(statement)) {
      if (!(statement.isTypeOnly() || allTypeOnly(statement.getNamedExports()))) return false;
      exportsSomething = true;
    } else if (Node.isExportAssignment(statement)) {
      return false;
    } else if (
      (Node.isVariableStatement(statement) ||
        Node.isFunctionDeclaration(statement) ||
        Node.isClassDeclaration(statement) ||
        Node.isEnumDeclaration(statement) ||
        Node.isModuleDeclaration(statement) ||
        Node.isImportEqualsDeclaration(statement)) &&
      statement.hasExportKeyword()
    ) {
      return false;
    }
  }
  const { source } = scan;
  const commonJs =
    scan.assignments.some((a) => {
      const target = a.left;
      if (isModuleExports(target, source)) return true;
      if (!ts.isPropertyAccessExpression(target) && !ts.isElementAccessExpression(target)) return false;
      const object = target.expression;
      return isModuleExports(object, source) || (ts.isIdentifier(object) && object.getText(source) === "exports");
    }) || scan.calls.some((c) => c.expression.getText(source) === "Object.defineProperty");
  return exportsSomething && !commonJs;
}

// `module.exports = { a, b }` exports a and b. Anything else, including an
// object with a spread or a computed key, is one value whose names aren't all
// written here, so it's recorded as that value rather than as a partial list.
function addWholeModule(value: ts.Expression, add: Add, source: ts.SourceFile): void {
  if (ts.isObjectLiteralExpression(value)) {
    const names: { name: string; at: number }[] = [];
    for (const property of value.properties) {
      if (ts.isSpreadAssignment(property)) return add(WHOLE_MODULE, value.getStart(source));
      const nameNode = property.name;
      const name = ts.isIdentifier(nameNode) ? nameNode.getText(source) : literalText(nameNode);
      if (name === null) return add(WHOLE_MODULE, value.getStart(source));
      names.push({ name, at: property.getStart(source) });
    }
    for (const n of names) add(n.name, n.at);
    return;
  }
  add(WHOLE_MODULE, value.getStart(source));
}

function isModuleExports(node: ts.Node, source: ts.SourceFile): boolean {
  return (
    ts.isPropertyAccessExpression(node) &&
    node.name.text === "exports" &&
    ts.isIdentifier(node.expression) &&
    node.expression.getText(source) === "module"
  );
}

function literalText(node: ts.Node | undefined): string | null {
  if (node && (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node))) return node.text;
  return null;
}

function isTypeOnlyClause(clause: ImportClause): boolean {
  if (clause.isTypeOnly()) return true;
  // `import { type A, type B } from` erases entirely; one value binding keeps it.
  if (clause.getDefaultImport() || clause.getNamespaceImport()) return false;
  return allTypeOnly(clause.getNamedImports());
}

function allTypeOnly(specifiers: { isTypeOnly(): boolean }[]): boolean {
  return specifiers.length > 0 && specifiers.every((specifier) => specifier.isTypeOnly());
}
