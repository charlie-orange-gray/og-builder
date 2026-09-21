import { describe, it, expect } from 'vitest';
import { scanCodeOverrideUsage } from './library-usage-store';

describe('code override usage', () => {
  it('attributes each wrapped element to its file and export', () => {
    const page = `'use client';
import { Override } from '@revyme/runtime';
import { withA, withB as withB2 } from '@/overrides/Fx';
export default function Page() {
  return (
    <div data-id="root">
      <Override with={withA}><div data-id="c1" data-name="Card A" /></Override>
      <Override with={[withA, withB2]}><div data-id="c2" data-name="Card B" /></Override>
    </div>
  );
}`;
    const usage = scanCodeOverrideUsage(new Map([['app/page.client.tsx', page], ['overrides/Fx.tsx', 'export function withA(C){return C}']]));
    const list = usage.get('overrides/Fx.tsx')!;
    expect(list.map((u) => [u.nodeName, u.detail])).toEqual([['Card A', 'withA'], ['Card B', 'withA, withB']]);
  });
});
