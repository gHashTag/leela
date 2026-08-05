/**
 * Assertions nothing waits on, read from source text.
 *
 * Separated from `scripts/audit-awaited.mjs` for the reason the other audit
 * libraries are: the judgement here is `isWaitedFor`, and a check that decides
 * what counts as waiting is one that can be wrong in both directions. It is
 * asked directly by `apps/mobile/tests/awaited.test.ts` over source it is
 * handed, so neither answer depends on what happens to be on disk.
 */

import ts from 'typescript';

/** The two members that turn `expect` into something asynchronous. */
const ASYNC_MATCHERS = new Set(['resolves', 'rejects']);

/**
 * Does something wait on the value this node produces?
 *
 * Climbs to the enclosing function and stops there: past that boundary the
 * value has left the expression it was written in, and whether it is settled is
 * a different question than the one this asks.
 */
function isWaitedFor(node) {
  let current = node.parent;

  while (current) {
    switch (current.kind) {
      case ts.SyntaxKind.AwaitExpression:
      case ts.SyntaxKind.ReturnStatement:
      // Captured under a name. The value was taken hold of, and what happens to
      // it afterwards is a question this check does not pretend to answer.
      //
      // Chaining is deliberately NOT here, and the test for this file is what
      // settled it: `expect(p).resolves.toBe(x).catch(() => {})` reads as
      // though somebody dealt with the promise, and nothing waits on it either
      // way -- the `.catch` only makes the failure quieter. A first draft of
      // this list excused it and the test refused, which is the whole reason
      // the judgement lives in a file something can ask.
      case ts.SyntaxKind.VariableDeclaration:
      case ts.SyntaxKind.BinaryExpression:
        return true;

      case ts.SyntaxKind.ArrowFunction:
      case ts.SyntaxKind.FunctionExpression:
      case ts.SyntaxKind.FunctionDeclaration:
      case ts.SyntaxKind.MethodDeclaration: {
        // A callback. An arrow with an expression body returns its assertion to
        // whatever collects it -- `[...].map((x) => expect(x).resolves.toBe(1))`
        // is the common spelling and is correct. A block body is not: inside
        // one, the assertion needed its own `await` or `return`, and reaching
        // this case means the climb found neither.
        const body = current.body;
        return Boolean(body) && !ts.isBlock(body);
      }

      case ts.SyntaxKind.ExpressionStatement:
        // A statement on its own. Nothing above it can be waiting.
        return false;

      default:
        break;
    }

    current = current.parent;
  }

  return false;
}

/**
 * Every `.resolves`/`.rejects` assertion in `source` that nothing waits on.
 *
 * Parsed rather than matched. A line-oriented search reports three correct
 * sites in `apps/bot` whose `await` sits on an earlier line, and a check that
 * names three innocents to catch one defect is one somebody switches off.
 */
export function floatingAssertions(source, filename = 'source.tsx') {
  const parsed = ts.createSourceFile(
    filename,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const lines = source.split('\n');
  const found = [];

  const visit = (node) => {
    if (
      ts.isPropertyAccessExpression(node) &&
      ASYNC_MATCHERS.has(node.name.text) &&
      ts.isCallExpression(node.expression) &&
      ts.isIdentifier(node.expression.expression) &&
      node.expression.expression.text === 'expect' &&
      !isWaitedFor(node)
    ) {
      const { line } = parsed.getLineAndCharacterOfPosition(node.getStart(parsed));
      found.push({ line: line + 1, member: node.name.text, text: (lines[line] ?? '').trim() });
    }
    ts.forEachChild(node, visit);
  };

  visit(parsed);
  return found;
}
