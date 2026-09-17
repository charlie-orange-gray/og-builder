import { describe, it, expect } from 'vitest';
import {
  liftCodeOverrides, restoreCodeOverrides, setCodeOverridesInCode, readCodeOverrides,
  listOverrideExports, overrideNamesInOpenTag,
} from './code-override-gen';
import { removeNodeInCode } from './generator-crud';
import { parseJSXToNodes as parseCode } from '../parsing/parser';

const PAGE = `'use client';
import { motion } from 'framer-motion';

export default function Page() {
  return (
    <div data-id="root">
      <motion.div data-id="card-1" style={{ height: '560px' }}>
        <p data-id="t1">One</p>
      </motion.div>
      <motion.div data-id="card-2" style={{ height: '560px' }} />
    </div>
  );
}
`;

const REF = { file: 'overrides/MouseHeight.tsx', name: 'withMouseDistanceHeight' };

describe('code overrides', () => {
  it('wraps an element and adds the override import', () => {
    const out = setCodeOverridesInCode(PAGE, 'card-1', [REF]);
    expect(out).toContain("import { withMouseDistanceHeight } from '@/overrides/MouseHeight';");
    expect(out).toMatch(/<Override with=\{withMouseDistanceHeight\}><motion\.div data-id="card-1"[^]*?<\/motion\.div><\/Override>/);
    expect(readCodeOverrides(out, 'card-1')).toEqual([REF]);
    expect(readCodeOverrides(out, 'card-2')).toEqual([]);
    expect(out).toContain("import { Override } from '@revyme/runtime';");
  });

  it('shares one import across elements and prunes it when the last use goes', () => {
    let out = setCodeOverridesInCode(PAGE, 'card-1', [REF]);
    out = setCodeOverridesInCode(out, 'card-2', [REF]);
    expect(out.match(/@\/overrides\/MouseHeight/g)).toHaveLength(1);
    expect(out.match(/<Override /g)).toHaveLength(2);
    out = setCodeOverridesInCode(out, 'card-1', []);
    out = setCodeOverridesInCode(out, 'card-2', []);
    expect(out).not.toContain('Override');
    expect(out).not.toContain('@/overrides');
  });

  it('stacks several overrides as a list', () => {
    const out = setCodeOverridesInCode(PAGE, 'card-2', [REF, { file: 'overrides/Fx.tsx', name: 'withHover' }]);
    expect(out).toContain('<Override with={[withMouseDistanceHeight, withHover]}>');
    expect(readCodeOverrides(out, 'card-2').map((r) => r.name)).toEqual(['withMouseDistanceHeight', 'withHover']);
  });

  it('lift + restore round-trips, and a removed element drops its wrapper', () => {
    const wrapped = setCodeOverridesInCode(setCodeOverridesInCode(PAGE, 'card-1', [REF]), 't1', [REF]);
    const { code, lifted } = liftCodeOverrides(wrapped);
    expect(code).not.toContain('<Override');
    expect([...lifted.keys()].sort()).toEqual(['card-1', 't1']);
    expect(restoreCodeOverrides(code, lifted).replace(/\s/g, '')).toBe(wrapped.replace(/\s/g, ''));
    const afterRemove = restoreCodeOverrides(removeNodeInCode(code, 'card-1'), lifted);
    expect(afterRemove).not.toContain('<Override');
  });

  it('the parser looks through the wrapper and records the override', () => {
    const out = setCodeOverridesInCode(PAGE, 'card-1', [REF]);
    const nodes = parseCode(out);
    const card = nodes.get('card-1')!;
    expect(card.codeOverrides).toEqual(['withMouseDistanceHeight']);
    expect(card.parentId).toBe('root');
    expect(nodes.get('t1')!.parentId).toBe('card-1');
    expect([...nodes.values()].some((n) => (n as { tagName?: string }).tagName === 'Override')).toBe(false);
  });

  it('lists override exports and reads names from the tag', () => {
    const src = `export function withA(Component): ComponentType { return Component }
export const withB = (Component) => Component
function helper() {}`;
    expect(listOverrideExports(src)).toEqual(['withA', 'withB']);
    expect(overrideNamesInOpenTag('<Override with={[a, b]}>')).toEqual(['a', 'b']);
  });
});
