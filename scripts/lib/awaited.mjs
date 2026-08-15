/**
 * Assertions nothing waits on, read from source text.
 *
 * The judgement here is `isWaitedFor`, and a check that decides what counts as
 * waiting is one that can be wrong in both directions. It is asked directly by
 * `apps/mobile/tests/awaited.test.ts` over source it is handed, so neither
 * answer depends on what happens to be on disk.
 *
 * This was split out of `scripts/audit-awaited.mjs`, and that script no longer
 * exists: as of 2026-08-06 the repo-wide sweep is `bunx eslint`, configured in
 * `eslint.config.mjs`, which asks the same question of every workspace with
 * type analysis rather than shapes. Both readers were run against one planted
 * unawaited assertion and both named it, at the same file and line, before the
 * bespoke sweep was removed.
 *
 * So nothing calls this over the tree any more, and it is deliberately kept
 * anyway. It is the unit-level statement of the rule: the test beside it runs
 * `floatingAssertions` over a corpus of shapes — a `.catch` that reads as
 * though somebody dealt with the promise but waits on nothing, an arrow with an
 * expression body that correctly returns its assertion to a collector — and
 * those cases are the argument for where the boundary sits. A lint rule
 * enforces the boundary; it does not explain it. Deleting this would delete the
 * explanation and the corpus that holds it in place.
 *
 * KNOWN, MEASURED, AND NOT FIXED HERE. Removing the sweep took away the only
 * caller of `floatingAssertions` that `scripts/audit-unread.mjs` can see, and
 * that audit goes red:
 *
 *     1 export(s) have no caller here:
 *       floatingAssertions  (function, scripts/lib/awaited.mjs)
 *
 * The export is not actually uncalled — `apps/mobile/tests/awaited.test.ts`
 * calls it four times. It is invisible because `audit-unread`'s SEARCH is each
 * workspace's *sources* plus `scripts`, and never a `tests` directory, so a
 * library whose only consumer is a test now looks dead. Proved by causation
 * rather than inferred: restoring the deleted script put `audit-unread` back to
 * exit 0, and removing it again returned the finding.
 *
 * The repair is one entry in that audit's `PUBLIC_API`, which already records
 * exactly this case for other exports (`rollMany: 'used by tests and by anyone
 * seeding a replay'`). It is left undone because `scripts/audit-unread.mjs`
 * belongs to another change in flight and editing it here would collide:
 *
 *     floatingAssertions: 'the rule asked directly by apps/mobile/tests/awaited.test.ts',
 *
 * Until that lands, CI's audit-unread step is red for this reason and no other.
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
