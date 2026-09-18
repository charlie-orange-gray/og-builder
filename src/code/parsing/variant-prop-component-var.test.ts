// A per-variant code-component prop whose branches are the MASTER's own component
// variables (a pricing card's monthly / yearly price) must parse like any other
// per-variant prop: the active branch resolves, and the variable names are recorded
// so the panel can show the binding.
import { describe, it, expect } from 'vitest';
import { parseJSXToNodes } from './parser';

const MASTER = `'use client';
/** @propMeta {"priceMonthly":{"type":"number","label":"Price Monthly"},"priceYearly":{"type":"number","label":"Price Yearly"}} */
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import NumberFlow from '@/components/NumberFlow';

const variantConfig = [
  { name: 'default', label: 'Monthly', x: 0, y: 0, isPrimary: true },
  { name: 'variant-1', label: 'Yearly', x: 451, y: 0 },
];

export default function PricingCard({ style, initialVariant = 'default', priceMonthly = 12, priceYearly = 120, ...rest }: any) {
  const [variant, setVariant] = useState(initialVariant);
  return (
    <motion.div data-id="card" {...rest} data-name="Card" style={{ ...style }}>
      <NumberFlow data-id="price" data-name="Price" prefix={'$'} value={variant === 'variant-1' ? priceYearly : priceMonthly} style={{ position: 'relative' }}></NumberFlow>
    </motion.div>
  );
}
`;

describe('per-variant code-component prop bound to component variables', () => {
  it('resolves each branch and records the variable names', () => {
    const node = parseJSXToNodes(MASTER).get('price') as unknown as {
      attrs?: Record<string, string>;
      attrConditional?: Record<string, Record<string, string>>;
      attrConditionalVarRefs?: Record<string, Record<string, string>>;
    };
    expect(node).toBeTruthy();
    expect(node.attrConditional?.value).toEqual({ 'variant-1': '120', default: '12' });
    expect(node.attrConditionalVarRefs?.value).toEqual({ 'variant-1': 'priceYearly', default: 'priceMonthly' });
    expect(node.attrs?.value).toBe('12');
  });
});
