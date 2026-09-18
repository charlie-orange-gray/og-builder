import { describe, it, expect } from 'vitest';
import { scopeSvgMarkupIds, elementSvgScope } from './svg-id-scope';

// The real shape emitted by the icon pipeline (create-vector-set-from-svgs):
// raster art in <defs>, drawn through <use>, painted inside a clip-path group.
const ICON = `<g clip-path="url(#_clip2)"><use xlinkHref="#_Image3" x="1" y="2" width="535px" height="527px"/></g>` +
  `<clipPath id="_clip2"><path d="M0,0L10,10Z"/></clipPath>` +
  `<defs><image id="_Image3" width="535px" height="527px" xlinkHref="data:image/png;base64,AAAA"/></defs>`;

describe('scopeSvgMarkupIds', () => {
  it('suffixes definitions and every reference to them', () => {
    const out = scopeSvgMarkupIds(ICON, 's7');
    expect(out).toContain('id="_clip2-s7"');
    expect(out).toContain('clip-path="url(#_clip2-s7)"');
    expect(out).toContain('id="_Image3-s7"');
    expect(out).toContain('xlinkHref="#_Image3-s7"');
    // no unscoped id or reference survives
    expect(out).not.toMatch(/#_clip2(?!-)/);
    expect(out).not.toMatch(/#_Image3(?!-)/);
    expect(out).not.toMatch(/id="_(clip2|Image3)"/);
  });

  it('gives two copies disjoint id sets (the actual bug)', () => {
    const a = scopeSvgMarkupIds(ICON, 's1');
    const b = scopeSvgMarkupIds(ICON, 's2');
    const ids = (m: string) => [...m.matchAll(/\sid="([^"]+)"/g)].map((x) => x[1]);
    expect(ids(a)).toEqual(['_clip2-s1', '_Image3-s1']);
    expect(ids(b)).toEqual(['_clip2-s2', '_Image3-s2']);
    expect(ids(a).some((id) => ids(b).includes(id))).toBe(false);
  });

  it('leaves the base64 payload and unrelated markup untouched', () => {
    const out = scopeSvgMarkupIds(ICON, 's1');
    expect(out).toContain('xlinkHref="data:image/png;base64,AAAA"');
    expect(out).toContain('<path d="M0,0L10,10Z"/>');
  });

  it('does not rewrite references to ids defined elsewhere', () => {
    const out = scopeSvgMarkupIds('<g clip-path="url(#external)"/>', 's1');
    expect(out).toBe('<g clip-path="url(#external)"/>');
  });

  it('handles url() with quotes and inline style refs', () => {
    const src = `<clipPath id="c"/><g style="clip-path:url('#c')" mask="url(#c)"/>`;
    const out = scopeSvgMarkupIds(src, 's1');
    expect(out).toContain(`url('#c-s1')`);
    expect(out).toContain('mask="url(#c-s1)"');
  });

  it('escapes regex-special characters in ids', () => {
    const out = scopeSvgMarkupIds('<clipPath id="a.b(c)"/><g clip-path="url(#a.b(c))"/>', 's1');
    expect(out).toContain('id="a.b(c)-s1"');
    expect(out).toContain('url(#a.b(c)-s1)');
  });

  it('is a no-op without markup or scope', () => {
    expect(scopeSvgMarkupIds('', 's1')).toBe('');
    expect(scopeSvgMarkupIds(ICON, '')).toBe(ICON);
  });
});

describe('elementSvgScope', () => {
  it('is stable per element and distinct across elements', () => {
    const a = document.createElement('div');
    const b = document.createElement('div');
    expect(elementSvgScope(a)).toBe(elementSvgScope(a));
    expect(elementSvgScope(a)).not.toBe(elementSvgScope(b));
  });
});
