import { describe, it, expect } from 'vitest';
import { findBandDeclsMissingImportant, appendImportantToBandDecls, healStyleBlockImportant } from './media-important';

const CSS = `
:lang(fr) [data-id="t"] { color: #fff; }
[data-id="x"]::after { content: ''; border: 1px solid red; }
select[data-id="s"] { background-image: url("data:image/svg+xml;charset=utf8,%3Csvg%3E"); }
@media (max-width: 768px) and (min-width: 375.02px) {
  [data-id="hero-title"] { font-size: 44px; letter-spacing: -1.4px; }
  [data-id="hero"] { flex: 0 0 auto !important; width: 100% !important; }
  :lang(fr) [data-id="hero-title"] { font-size: 40px; }
  [data-id="bg"] { background-image: url("data:image/svg+xml;a;b"); --locale-off-color: 1 !important; }
}
@media (max-width: 375px) { [data-id="a"], [data-id="b"] { display: none } }
`;

describe('findBandDeclsMissingImportant', () => {
  it('flags band + :lang declarations only, honours ; inside url()', () => {
    const m = findBandDeclsMissingImportant(CSS);
    expect(m.map((d) => `${d.selector}|${d.prop}`)).toEqual([
      ':lang(fr) [data-id="t"]|color',
      '[data-id="hero-title"]|font-size',
      '[data-id="hero-title"]|letter-spacing',
      ':lang(fr) [data-id="hero-title"]|font-size',
      '[data-id="bg"]|background-image',
      '[data-id="a"], [data-id="b"]|display',
    ]);
    expect(m[4].value).toBe('url("data:image/svg+xml;a;b")');
  });
  it('passes generator output', () => {
    expect(findBandDeclsMissingImportant(`@media (max-width: 768px) { [data-id="r"] { padding: 8px !important; --locale-off-x: 1 !important; } }`)).toEqual([]);
  });
});

describe('appendImportantToBandDecls', () => {
  it('appends to every scoped declaration, idempotent, leaves top-level pseudo/caret rules alone', () => {
    const healed = appendImportantToBandDecls(CSS);
    expect(findBandDeclsMissingImportant(healed)).toEqual([]);
    expect(healed).toContain(`[data-id="hero-title"] { font-size: 44px !important; letter-spacing: -1.4px !important; }`);
    expect(healed).toContain(`{ display: none !important }`);
    expect(healed).toContain(`:lang(fr) [data-id="t"] { color: #fff !important; }`);
    expect(healed).toContain(`[data-id="x"]::after { content: ''; border: 1px solid red; }`);
    expect(healed).toContain(`select[data-id="s"] { background-image: url("data:image/svg+xml;charset=utf8,%3Csvg%3E"); }`);
    expect(healed).toContain(`flex: 0 0 auto !important; width: 100% !important;`);
    expect(appendImportantToBandDecls(healed)).toBe(healed);
  });
});

describe('healStyleBlockImportant', () => {
  it('rewrites only the <style> template literal and skips interpolated ones', () => {
    const src = `<div style={{ fontSize: '64px' }}><style>{\`@media (max-width: 375px) { [data-id="h"] { font-size: 32px; } }\`}</style></div>`;
    expect(healStyleBlockImportant(src)).toBe(`<div style={{ fontSize: '64px' }}><style>{\`@media (max-width: 375px) { [data-id="h"] { font-size: 32px !important; } }\`}</style></div>`);
    const dyn = `<style>{\`@media (max-width: 375px) { [data-id="h"] { font-size: \${s}px; } }\`}</style>`;
    expect(healStyleBlockImportant(dyn)).toBe(dyn);
    expect(healStyleBlockImportant('no style here')).toBe('no style here');
  });
});
