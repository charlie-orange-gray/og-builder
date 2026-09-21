// split-text-scroll-window.test.tsx — the scroll-mode unit WINDOW, executed.
//
// A scroll-scrubbed text reveal steps one word at a time (each word scrubs over its own
// 1/N slice), where the runtime's default spreads every unit over 40% of the range and
// a dozen words blend into a soft gradient (live report 2026-09-16: "ours is a smooth
// fade, the original is sharp"). `scrollWindow: 0` is the one-at-a-time window.
// Scroll progress is pinned at 0.5 so the per-word opacities read the window directly.

import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render } from '@testing-library/react';

vi.mock('framer-motion', async (orig) => {
  const actual = await orig<typeof import('framer-motion')>();
  return {
    ...actual,
    useScroll: () => ({ scrollYProgress: actual.motionValue(0.5), scrollY: actual.motionValue(0), scrollX: actual.motionValue(0), scrollXProgress: actual.motionValue(0) }),
    useSpring: (v: unknown) => v,
  };
});

import { RevymeSplitText } from '@revyme/runtime';

beforeAll(() => {
  if (!('IntersectionObserver' in globalThis)) {
    (globalThis as any).IntersectionObserver = class {
      observe() {} unobserve() {} disconnect() {} takeRecords() { return []; }
      root = null; rootMargin = ''; thresholds = [];
    };
  }
});

const TEXT = 'one two three four five six seven eight nine ten';
const opacities = (container: HTMLElement) =>
  [...container.querySelectorAll('span')]
    .filter((s) => s.style.opacity !== '' && s.textContent?.trim())
    .map((s) => Number(s.style.opacity));

describe('RevymeSplitText scroll window', () => {
  it('scrollWindow 0 steps one word at a time: half the words on, half at rest', () => {
    const { container } = render(
      <RevymeSplitText spec={{ animationType: 'word', trigger: 'scroll', opacity: 0.2, scrollWindow: 0 } as any}>{TEXT}</RevymeSplitText>,
    );
    const ops = opacities(container);
    expect(ops).toHaveLength(10);
    expect(ops.slice(0, 5).every((o) => o === 1)).toBe(true);
    expect(ops.slice(5).every((o) => Math.abs(o - 0.2) < 1e-6)).toBe(true);
  });

  it('the default window still overlaps units into a gradient (unchanged)', () => {
    const { container } = render(
      <RevymeSplitText spec={{ animationType: 'word', trigger: 'scroll', opacity: 0.2 } as any}>{TEXT}</RevymeSplitText>,
    );
    const ops = opacities(container);
    expect(ops).toHaveLength(10);
    const between = ops.filter((o) => o > 0.21 && o < 0.99);
    expect(between.length).toBeGreaterThan(2);
  });
});
