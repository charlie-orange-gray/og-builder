// Reordering a node that is HIDDEN on some variants.
//
// The variant-visibility system does not give such a node a plain slot in its
// parent — it wraps it:
//
//   <AnimatePresence mode="popLayout">{initialVariant === 'x' && <el …/>}</AnimatePresence>
//
// `reorderNodeInCode` used to splice only when the element's direct parent was
// a JSXElement. Inside the wrapper the parent is a LogicalExpression, so the
// removal silently no-opped while the clone was inserted anyway — the node
// ended up in the file TWICE and the layers tree showed two identical rows
// that never went away (user report 2026-09-19).

import { describe, test, expect } from 'vitest';
import { reorderNodeInCode, moveNodeInCode } from './generator-crud';

const PAGE = `export default function Header({ initialVariant = 'default' }) {
  return (
    <div data-id="bar" style={{ display: 'flex' }}>
      <div data-id="logo" style={{ order: '0' }}>Logo</div>
      <div data-id="chat" style={{ order: '1' }}>Chat</div>
      <AnimatePresence mode="popLayout">{initialVariant === "variant-2" && <motion.div data-id="burger" style={{ order: '2' }}>Burger</motion.div>}</AnimatePresence>
      <div data-id="links" style={{ order: '3' }}>Links</div>
    </div>
  );
}`;

const count = (code: string, id: string) =>
  (code.match(new RegExp(`data-id="${id}"`, 'g')) ?? []).length;

/** Child data-ids in source order (the container's own id dropped). */
const sequence = (code: string, root = 'bar') =>
  [...code.matchAll(/data-id="([^"]+)"/g)].map(m => m[1]).filter(id => id !== root);

describe('reorderNodeInCode — variant-wrapped node', () => {
  test('moving the wrapped node does NOT duplicate it', () => {
    const out = reorderNodeInCode(PAGE, 'burger', 'bar', 0);
    expect(count(out, 'burger')).toBe(1);
  });

  test('the node actually lands at the requested index', () => {
    const out = reorderNodeInCode(PAGE, 'burger', 'bar', 0);
    expect(sequence(out)).toEqual(['burger', 'logo', 'chat', 'links']);
  });

  // The wrapper is what gates visibility. Dropping it (as a MOVE does, where
  // the element leaves the file) would make a per-variant element permanently
  // visible on every variant.
  test('the AnimatePresence wrapper travels WITH the node', () => {
    const out = reorderNodeInCode(PAGE, 'burger', 'bar', 0);
    expect(out).toContain('AnimatePresence');
    expect(out).toMatch(/AnimatePresence[^]*initialVariant === "variant-2"[^]*data-id="burger"/);
    expect((out.match(/<AnimatePresence/g) ?? []).length).toBe(1);
  });

  test('reordering to the end works too', () => {
    const out = reorderNodeInCode(PAGE, 'burger', 'bar', 3);
    expect(count(out, 'burger')).toBe(1);
    expect(sequence(out)).toEqual(['logo', 'chat', 'links', 'burger']);
  });

  // The wrapper occupies the wrapped node's slot, so its VISIBLE siblings must
  // still index correctly around it.
  test('a visible sibling reorders correctly across the wrapper', () => {
    const out = reorderNodeInCode(PAGE, 'links', 'bar', 0);
    expect(count(out, 'burger')).toBe(1);
    expect(sequence(out)).toEqual(['links', 'logo', 'chat', 'burger']);
  });

  test('an unwrapped node still reorders as before', () => {
    const out = reorderNodeInCode(PAGE, 'chat', 'bar', 0);
    expect(count(out, 'chat')).toBe(1);
    expect(sequence(out)).toEqual(['chat', 'logo', 'burger', 'links']);
  });

  // A bare `{cond && <el/>}` with no AnimatePresence is the same shape.
  test('a bare conditional wrapper is handled too', () => {
    const bare = PAGE
      .replace('<AnimatePresence mode="popLayout">', '')
      .replace('</AnimatePresence>', '');
    const out = reorderNodeInCode(bare, 'burger', 'bar', 0);
    expect(count(out, 'burger')).toBe(1);
    expect(sequence(out)).toEqual(['burger', 'logo', 'chat', 'links']);
  });
});

describe('reorderNodeInCode — anchors still pinned', () => {
  // A leading <style> block has no data-id and must NOT consume a slot index.
  const WITH_STYLE = `export default function Page() {
  return (
    <div data-id="root" style={{ display: 'flex' }}>
      <style>{\`.x{color:red}\`}</style>
      <div data-id="a" style={{ order: '0' }}>A</div>
      <div data-id="b" style={{ order: '1' }}>B</div>
    </div>
  );
}`;

  test('a style anchor stays first and does not absorb a slot', () => {
    const out = reorderNodeInCode(WITH_STYLE, 'b', 'root', 0);
    expect(sequence(out, 'root')).toEqual(['b', 'a']);
    expect(out.indexOf('<style>')).toBeLessThan(out.indexOf('data-id="b"'));
  });
});

// MOVING a variant-hidden node to a NEW PARENT.
//
// `moveNodeInCode` deleted the AnimatePresence wrapper on the way out — correct
// when the element is being removed from the file, wrong for a move, where the
// element survives. The condition went with the wrapper, so a hidden node
// became unconditionally rendered: the layers row still showed the eye-slash
// while the canvas painted it on every variant (user report 2026-09-19).
describe('moveNodeInCode — variant-wrapped node keeps its visibility', () => {
  const TREE = `export default function Header({ initialVariant = 'default' }) {
  return (
    <div data-id="bar" style={{ display: 'flex' }}>
      <div data-id="logo" style={{ order: '0' }}>Logo</div>
      <AnimatePresence mode="popLayout">{initialVariant === "variant-2" && <motion.div data-id="burger" style={{ order: '1' }}>Burger</motion.div>}</AnimatePresence>
      <div data-id="menu" style={{ display: 'flex', order: '2' }}>
        <p data-id="t1">Adidas</p>
      </div>
    </div>
  );
}`;

  test('the condition survives the reparent', () => {
    const out = moveNodeInCode(TREE, 'burger', 'menu', undefined, 1);
    expect(out).toMatch(/initialVariant === "variant-2"/);
    expect(out).toContain('AnimatePresence');
  });

  test('the node moves exactly once', () => {
    const out = moveNodeInCode(TREE, 'burger', 'menu', undefined, 1);
    expect(count(out, 'burger')).toBe(1);
  });

  test('it really lands inside the new parent, still wrapped', () => {
    const out = moveNodeInCode(TREE, 'burger', 'menu', undefined, 1);
    const menuAt = out.indexOf('data-id="menu"');
    const burgerAt = out.indexOf('data-id="burger"');
    expect(burgerAt).toBeGreaterThan(menuAt);
    // the wrapper travelled with it, not left behind next to the logo
    const wrapperAt = out.indexOf('<AnimatePresence');
    expect(wrapperAt).toBeGreaterThan(menuAt);
  });

  test('an UNWRAPPED node still moves plainly', () => {
    const out = moveNodeInCode(TREE, 'logo', 'menu', undefined, 0);
    expect(count(out, 'logo')).toBe(1);
    expect((out.match(/<AnimatePresence/g) ?? []).length).toBe(1);
    expect(out.indexOf('data-id="logo"')).toBeGreaterThan(out.indexOf('data-id="menu"'));
  });
});
