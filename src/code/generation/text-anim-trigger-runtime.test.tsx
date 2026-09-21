// Runtime check of the text effect triggers: On Appear plays on mount, Layer in View waits for
// the text's own top to cross the Start line, Section in View waits for the section's top.
import { describe, it, expect, afterEach } from 'vitest';
import { render, act, cleanup } from '@testing-library/react';
import { RevymeSplitText } from '@revyme/runtime';

const settle = () => act(() => new Promise((r) => setTimeout(r, 900)));
const rect = (top: number) => () => ({ top, bottom: top + 50, left: 0, right: 100, width: 100, height: 50, x: 0, y: top, toJSON: () => ({}) });
const firstUnitOpacity = (root: HTMLElement) => Number((root.querySelector('span span') as HTMLElement).style.opacity);
const SPEC = { animationType: 'word' as const, opacity: 0, transition: { type: 'tween' as const, duration: 0.05 } };

describe('RevymeSplitText triggers', () => {
  afterEach(cleanup);

  it('On Appear plays on mount even far below the fold', async () => {
    const spy = HTMLElement.prototype.getBoundingClientRect;
    HTMLElement.prototype.getBoundingClientRect = rect(5000) as never;
    try {
      const { container } = render(<RevymeSplitText spec={{ ...SPEC, trigger: 'appear' }}>Hello world</RevymeSplitText>);
      await settle();
      expect(firstUnitOpacity(container)).toBe(1);
    } finally { HTMLElement.prototype.getBoundingClientRect = spy; }
  });

  it('Layer in View waits until the text crosses its Start line', async () => {
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 1000 });
    const spy = HTMLElement.prototype.getBoundingClientRect;
    HTMLElement.prototype.getBoundingClientRect = rect(700) as never;
    try {
      const { container } = render(<RevymeSplitText spec={{ ...SPEC, trigger: 'view', viewport: 'middle' }}>Hello world</RevymeSplitText>);
      await settle();
      expect(firstUnitOpacity(container)).toBe(0);          // 700 is below the middle line (500)
      HTMLElement.prototype.getBoundingClientRect = rect(400) as never;
      await act(async () => { window.dispatchEvent(new Event('scroll')); });
      await settle();
      expect(firstUnitOpacity(container)).toBe(1);
    } finally { HTMLElement.prototype.getBoundingClientRect = spy; }
  });

  it('Section in View follows the section, and Replay hides it again', async () => {
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 1000 });
    const section = document.createElement('section');
    section.id = 'story';
    document.body.appendChild(section);
    section.getBoundingClientRect = rect(1500) as never;
    try {
      const { container } = render(<RevymeSplitText spec={{ ...SPEC, trigger: 'section', sectionId: 'story', viewport: 'top', replay: true }}>Hello world</RevymeSplitText>);
      await settle();
      expect(firstUnitOpacity(container)).toBe(0);
      section.getBoundingClientRect = rect(-10) as never;
      await act(async () => { window.dispatchEvent(new Event('scroll')); });
      await settle();
      expect(firstUnitOpacity(container)).toBe(1);
      section.getBoundingClientRect = rect(300) as never;
      await act(async () => { window.dispatchEvent(new Event('scroll')); });
      await settle();
      expect(firstUnitOpacity(container)).toBe(0);
    } finally { section.remove(); }
  });
});
