import { ts, type SourceFile } from "ts-morph";

// Each of these is a point where control can go one of two ways.
const BRANCHES = new Set<ts.SyntaxKind>([
  ts.SyntaxKind.IfStatement,
  ts.SyntaxKind.ConditionalExpression,
  ts.SyntaxKind.CaseClause,
  ts.SyntaxKind.ForStatement,
  ts.SyntaxKind.ForInStatement,
  ts.SyntaxKind.ForOfStatement,
  ts.SyntaxKind.WhileStatement,
  ts.SyntaxKind.DoStatement,
  ts.SyntaxKind.CatchClause,
]);

const SHORT_CIRCUIT = new Set<ts.SyntaxKind>([
  ts.SyntaxKind.AmpersandAmpersandToken,
  ts.SyntaxKind.BarBarToken,
  ts.SyntaxKind.QuestionQuestionToken,
  ts.SyntaxKind.AmpersandAmpersandEqualsToken,
  ts.SyntaxKind.BarBarEqualsToken,
  ts.SyntaxKind.QuestionQuestionEqualsToken,
]);

/**
 * One plus every branch point written in the file: the whole file's
 * cyclomatic complexity. Walks the compiler's own tree once; wrapping every
 * node in ts-morph would cost more than the count is worth.
 */
export function complexity(sourceFile: SourceFile): number {
  let count = 1;
  const visit = (node: ts.Node): void => {
    if (BRANCHES.has(node.kind)) count++;
    else if (ts.isBinaryExpression(node) && SHORT_CIRCUIT.has(node.operatorToken.kind)) count++;
    ts.forEachChild(node, visit);
  };
  visit(sourceFile.compilerNode);
  return count;
}
