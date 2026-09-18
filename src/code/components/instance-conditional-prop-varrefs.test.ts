import { describe, it, expect } from 'vitest';
import { parseConditionalPropVarRefs, conditionalPropVarForVariant, parseConditionalPropExpression } from './instance-conditional-prop';

describe('per-variant prop bound to master variables', () => {
  const expr = "variant === 'variant-1' ? priceYearly : priceMonthly";

  it('reads the variable per variant', () => {
    expect(parseConditionalPropVarRefs(expr)).toEqual({ 'variant-1': 'priceYearly', default: 'priceMonthly' });
    expect(conditionalPropVarForVariant(expr, 'variant-1')).toBe('priceYearly');
    expect(conditionalPropVarForVariant(expr, null)).toBe('priceMonthly');
    expect(conditionalPropVarForVariant(expr, 'variant-2')).toBe('priceMonthly');
  });

  it('leaves literal ternaries to the value parser, and ignores unrelated ones', () => {
    expect(parseConditionalPropVarRefs("initialVariant === 'Hover' ? 18 : 14")).toBeNull();
    expect(parseConditionalPropExpression(expr)).toBeNull();
    expect(parseConditionalPropVarRefs("isOpen === 'yes' ? a : b")).toBeNull();
    expect(parseConditionalPropVarRefs("variant === 'v' ? undefined : x")).toBeNull();
  });
});
