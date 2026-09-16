// validateGeneratedCode must not flag DOM element classes as undefined
// identifiers — `useRef<HTMLDivElement>` / `as HTMLCanvasElement` /
// `instanceof HTMLImageElement` are real browser globals (2026-09-09).
import { describe, test, expect, vi } from 'vitest';
vi.mock('@/shared/debug-trace', () => ({ trace: { action: vi.fn(), fn: vi.fn(), dom: vi.fn(), error: vi.fn() } }));
import { validateGeneratedCode } from './mutation-queue';

describe('validateGeneratedCode — DOM globals', () => {
  test('element classes in type and runtime positions are known', () => {
    const code = `'use client';
import { useRef } from 'react';
function X() {
  const r = useRef<HTMLDivElement>(null);
  const c: HTMLCanvasElement[] = [];
  const isImg = (el: Element) => el instanceof HTMLImageElement;
  const ctx = (c[0] as HTMLCanvasElement | undefined)?.getContext('2d') as CanvasRenderingContext2D | null;
  return <div ref={r} data-id="x">{String(!!ctx && !!isImg)}</div>;
}
export default X;`;
    expect(validateGeneratedCode(code)).toBeNull();
  });
  test('a genuinely undefined identifier is still reported', () => {
    const code = `function X() { return <div data-id="x">{someUndefinedThing}</div>; }\nexport default X;`;
    expect(validateGeneratedCode(code)).toContain('someUndefinedThing');
  });
});
