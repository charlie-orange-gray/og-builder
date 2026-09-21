import { describe, it, expect, vi } from 'vitest';
vi.mock('@/shared/debug-trace', () => ({ trace: { action: vi.fn(), fn: vi.fn(), error: vi.fn(), dom: vi.fn() } }));
import { updateVariantStyleInCode } from './generator-styles';
import { setInlineVariableForVariant } from '../features/variable-ops';
import { parseJSX } from '@/code/parsing/ast-utils';

// One layer's Fill reads Color A on the primary variant and
// Color B on another. The default entry must animate back to the BASE
// VARIABLE, and every variants object reading a prop lives inside the component.
const COMP = `'use client';
/** @propMeta {"color":{"type":"color","label":"Color A"},"color1":{"type":"color","label":"Color B"},"radius":{"label":"R"}} */
import React from 'react';
import { motion, LayoutGroup } from 'framer-motion';
import { withResponsiveProps } from '@revyme/runtime';
const variantConfig = [{ name: 'default', label: 'Frame', x: 0, y: 0, isPrimary: true }, { name: 'variant-1', label: 'Frame', x: 1000, y: 0 }];
function KaFiBi({ style, initialVariant = 'default', color = "#5199d4", color1 = "#9b23dc", radius = "73px", ...rest }: { style?: React.CSSProperties; initialVariant?: string; [key: string]: any }) {
  return (
    <LayoutGroup>
    <motion.div layout={true} data-id="root-1" {...rest} data-name="Frame" style={{ position: 'absolute', width: '930px', height: '638px', backgroundColor: color, borderRadius: '0px', ...style }}>
      <motion.div layout={true} data-id="child-2" data-name="Frame" style={{ position: 'absolute', width: '387px', height: '193px', borderRadius: radius, left: '229px', top: '218px' }}></motion.div>
    </motion.div>
    </LayoutGroup>);
}
export default withResponsiveProps(KaFiBi);`;

// The user's broken file: the default entry was seeded with the CSS initial.
const BROKEN = COMP.replace("function KaFiBi(", "const root1Variants = { default: { backgroundColor: 'rgba(0, 0, 0, 0)' }, 'variant-1': { backgroundColor: '#ff0000' } };\nfunction KaFiBi(")
  .replace('data-id="root-1" {...rest}', `data-id="root-1" variants={root1Variants} initial={['default', initialVariant]} animate={['default', initialVariant]} {...rest}`);

const constInsideFunction = (code: string, name: string) => code.indexOf(`const ${name}`) > code.indexOf('function KaFiBi(');

describe('per-variant values over a variable-bound base', () => {
  it('a literal on a variant seeds the default with the base variable, inside the component', () => {
    const out = updateVariantStyleInCode(COMP, 'root-1', 'variant-1', { backgroundColor: '#ff0000' });
    expect(out).toMatch(/default: \{ backgroundColor: color \}/);
    expect(constInsideFunction(out, 'root1Variants')).toBe(true);
    expect(parseJSX(out)).not.toBeNull();
  });

  it('the same for a variable-bound child (radius)', () => {
    const out = updateVariantStyleInCode(COMP, 'child-2', 'variant-1', { borderRadius: '0px' });
    expect(out).toMatch(/default: \{ borderRadius: radius \}/);
    expect(constInsideFunction(out, 'child2Variants')).toBe(true);
  });

  it('keeps literal bases literal and at module scope', () => {
    const out = updateVariantStyleInCode(COMP, 'root-1', 'variant-1', { borderRadius: '12px' });
    expect(out).toMatch(/default: \{ borderRadius: '0px' \}/);
    expect(constInsideFunction(out, 'root1Variants')).toBe(false);
  });

  it('binding Color B on the variant repairs a CSS-initial default to Color A', () => {
    const out = setInlineVariableForVariant(BROKEN, 'root-1', 'backgroundColor', 'variant-1', 'color1', '', '#9b23dc');
    expect(out).toMatch(/default:\s*\{\s*backgroundColor:\s*color\s*\}/);
    expect(out).toMatch(/'variant-1':\s*\{\s*backgroundColor:\s*color1\s*\}/);
    expect(out).not.toContain('rgba(0, 0, 0, 0)');
    expect(constInsideFunction(out, 'root1Variants')).toBe(true);
  });
});
