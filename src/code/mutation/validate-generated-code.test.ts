import { describe, it, expect } from 'vitest';
import { validateGeneratedCode } from './mutation-queue';

const page = (body: string) => `'use client';\nimport React from 'react';\nfunction useResponsiveText(p: string, o: Record<number, string>, w: number[]) { return p; }\nexport default function Page() {\n  return <div data-id="root">${body}</div>;\n}\n`;

describe('validateGeneratedCode — character-indexed properties', () => {
  it('lets responsive-text overrides keyed by viewport width through (second viewport edit)', () => {
    // Regression 2026-09-07: editing text on mobile then tablet produced two
    // width-keyed overrides and the old regex blocked the mutation.
    const code = page(`<p data-id="t">{useResponsiveText("Cena je 768 dinara", {\n  375: "sdfdsf",\n  768: "kdxdxd"\n}, [375, 768, 1440])}</p>`);
    expect(validateGeneratedCode(code)).toBeNull();
  });
  it('still rejects a JSON string spread into sequential numeric keys', () => {
    const code = page(`<p data-id="t" style={{ 0: 'a', 1: 'b', 2: 'c' }} />`);
    expect(validateGeneratedCode(code)).toMatch(/character-indexed/);
  });
});
