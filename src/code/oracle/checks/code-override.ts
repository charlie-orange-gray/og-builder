// oracle/checks/code-override.ts — `<Override>` must wrap exactly one element
// and name overrides the file actually imports.
//
// The runtime `Override` swaps its ONLY child's component type for the
// overridden one (runtime/src/code-override.tsx) — `React.Children.only`
// throws on zero or several children, which blanks the page in preview and on
// the live site while the canvas (which never runs overrides) looks fine.
// The editor's lift/restore (code-override-gen.ts) also re-wraps by the
// child's data-id, so a child without one silently loses its override on the
// next edit. And a `with={withX}` that isn't imported is a ReferenceError at
// render time. An AI/MCP-authored file bypasses the panel that guarantees all
// three, so this rule stands in for it.
//
// Tier 3 for the crashes (child count, undefined override), tier 2 for a
// child the editor can't carry.

import * as t from '@babel/types';
import { traverse, jsxTagName, jsxAttrs } from './shared';
import type { OracleViolation } from './shared';

export function checkCodeOverrides(ast: t.File, v: OracleViolation[]): void {
  const imported = new Set<string>();
  const declared = new Set<string>();
  for (const stmt of ast.program.body) {
    if (t.isImportDeclaration(stmt)) {
      for (const s of stmt.specifiers) imported.add(s.local.name);
    } else if (t.isFunctionDeclaration(stmt) && stmt.id) {
      declared.add(stmt.id.name);
    } else if (t.isVariableDeclaration(stmt)) {
      for (const d of stmt.declarations) if (t.isIdentifier(d.id)) declared.add(d.id.name);
    }
  }

  traverse(ast, {
    JSXElement(path: { node: t.JSXElement }) {
      const opening = path.node.openingElement;
      if (jsxTagName(opening.name) !== 'Override') return;
      const line = opening.loc?.start.line;
      const elements = path.node.children.filter((c) => t.isJSXElement(c)) as t.JSXElement[];
      const other = path.node.children.filter((c) => !t.isJSXElement(c) && !(t.isJSXText(c) && !c.value.trim()));
      if (elements.length !== 1 || other.length > 0) {
        v.push({
          code: 'OVERRIDE_CHILD_COUNT',
          tier: 3,
          line,
          message: `<Override> must wrap exactly one JSX element (found ${elements.length} element(s)${other.length ? ' plus other content' : ''}). It replaces its only child's component at runtime and throws otherwise. Write one <Override with={withX}> directly around each element: <Override with={withX}><motion.div data-id="…" /></Override>.`,
        });
      } else {
        const childAttrs = jsxAttrs(elements[0].openingElement);
        if (!childAttrs.some((a) => t.isJSXAttribute(a) && a.name.name === 'data-id')) {
          v.push({
            code: 'OVERRIDE_CHILD_NO_DATA_ID',
            tier: 2,
            line,
            message: 'The element inside <Override> has no data-id. The editor carries overrides through edits by the wrapped element\'s data-id, so this override would be dropped on the next change. Give the wrapped element a data-id.',
          });
        }
      }

      const withAttr = jsxAttrs(opening).find((a) => t.isJSXAttribute(a) && a.name.name === 'with') as t.JSXAttribute | undefined;
      const expr = withAttr && t.isJSXExpressionContainer(withAttr.value) ? withAttr.value.expression : null;
      const items = !expr || t.isJSXEmptyExpression(expr) ? [] : t.isArrayExpression(expr) ? expr.elements : [expr];
      if (items.length === 0) {
        v.push({
          code: 'OVERRIDE_WITHOUT_OVERRIDE',
          tier: 2,
          line,
          message: '<Override> has no `with={…}`. Name the override to apply (with={withX}, imported from \'@/overrides/<File>\') or remove the wrapper.',
        });
      }
      for (const item of items) {
        const root = t.isIdentifier(item) ? item.name : t.isMemberExpression(item) && t.isIdentifier(item.object) ? item.object.name : null;
        if (!root) {
          v.push({
            code: 'OVERRIDE_WITH_NOT_IDENTIFIER',
            tier: 2,
            line,
            message: '`with` on <Override> must reference imported override functions by name (with={withX} or with={[withA, withB]}), not an inline expression. The Code Overrides panel can only show and edit named overrides.',
          });
        } else if (!imported.has(root) && !declared.has(root)) {
          v.push({
            code: 'OVERRIDE_NOT_IMPORTED',
            tier: 3,
            line,
            message: `Override "${root}" is not imported or declared, so the page throws a ReferenceError when it renders. Add: import { ${root} } from '@/overrides/<File>';`,
          });
        }
      }
    },
  });
}
