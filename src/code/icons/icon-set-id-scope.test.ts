import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { SVG_ID_SCOPE_HELPERS, buildIconSetFile, upgradeVectorSetInstanceBranch } from './icon-set-template';

/** Evaluate the helpers exactly as they are emitted into an icon-set file. */
function loadHelpers() {
  const fn = new Function('React', `${SVG_ID_SCOPE_HELPERS}\nreturn { svgIdsIn, scopeSvgIds };`);
  return fn(React) as {
    svgIdsIn: (n: unknown, out: Set<string>) => Set<string>;
    scopeSvgIds: (n: unknown, uid: string, ids: Set<string>) => React.ReactElement;
  };
}

/** The shape the icon pipeline produces: raster art in defs, drawn through a clip. */
const icon = () =>
  React.createElement(
    'svg',
    { viewBox: '0 0 10 10' },
    React.createElement(
      'g',
      { 'clip-path': 'url(#_clip2)', key: 'g' },
      React.createElement('use', { xlinkHref: '#_Image3', width: '5px' }),
    ),
    React.createElement(
      'clipPath',
      { id: '_clip2', key: 'c' },
      React.createElement('path', { d: 'M0,0L1,1Z' }),
    ),
    React.createElement(
      'defs',
      { key: 'd' },
      React.createElement('image', { id: '_Image3', xlinkHref: 'data:image/png;base64,AAAA' }),
    ),
  );

describe('emitted svg id scoping', () => {
  it('collects the ids defined in the icon subtree', () => {
    const { svgIdsIn } = loadHelpers();
    expect([...svgIdsIn(icon(), new Set())].sort()).toEqual(['_Image3', '_clip2']);
  });

  it('suffixes definitions and their references', () => {
    const { svgIdsIn, scopeSvgIds } = loadHelpers();
    const ids = svgIdsIn(icon(), new Set());
    const html = renderToStaticMarkup(scopeSvgIds(icon(), 'r1', ids));
    expect(html).toContain('id="_clip2-r1"');
    expect(html).toContain('clip-path="url(#_clip2-r1)"');
    expect(html).toContain('id="_Image3-r1"');
    expect(html).toContain('xlink:href="#_Image3-r1"');
    expect(html).not.toMatch(/#_clip2(?!-)/);
    expect(html).not.toMatch(/#_Image3(?!-)/);
  });

  it('gives two mounts disjoint id sets — the bug itself', () => {
    const { svgIdsIn, scopeSvgIds } = loadHelpers();
    const ids = svgIdsIn(icon(), new Set());
    const idsOf = (uid: string) =>
      [...renderToStaticMarkup(scopeSvgIds(icon(), uid, ids)).matchAll(/ id="([^"]+)"/g)].map((m) => m[1]);
    const a = idsOf('r1');
    const b = idsOf('r2');
    expect(a).toEqual(['_clip2-r1', '_Image3-r1']);
    expect(a.some((id) => b.includes(id))).toBe(false);
  });

  it('leaves the base64 payload and refs to outside ids alone', () => {
    const { svgIdsIn, scopeSvgIds } = loadHelpers();
    const ids = svgIdsIn(icon(), new Set());
    const html = renderToStaticMarkup(scopeSvgIds(icon(), 'r1', ids));
    expect(html).toContain('xlink:href="data:image/png;base64,AAAA"');

    const outside = React.createElement('g', { 'clip-path': 'url(#external)' });
    expect(renderToStaticMarkup(scopeSvgIds(outside, 'r1', ids))).toContain('url(#external)');
  });
});

describe('generated icon-set file', () => {
  const file = buildIconSetFile('Logos', 'Logos', [
    {
      id: 'icon-1',
      displayName: 'Logo',
      svgJSX: '<svg viewBox="0 0 10 10"><clipPath id="_clip2"/><g clip-path="url(#_clip2)"/></svg>', leftPx: 0,
    },
  ]);

  it('ships the scoping helpers and calls them per mount', () => {
    expect(file).toContain('function scopeSvgIds(');
    expect(file).toContain('React.useId()');
    expect(file).toContain('React.Children.map(filledKids, scoped)');
    expect(file).toContain('if (!name) return scoped(master);');
  });
});

describe('healing an existing icon-set file', () => {
  // A file that is current in every other respect (guarded forwardRef + motion
  // render + responsive wrapper) but predates the id scoping — i.e. every icon
  // set already in a user's project.
  const current = buildIconSetFile('Logos', 'Logos', [
    { id: 'icon-1', displayName: 'Logo', leftPx: 0, svgJSX: '<svg viewBox="0 0 10 10"><clipPath id="_clip2"/><g clip-path="url(#_clip2)"/></svg>' },
  ]);
  const unscoped = current
    .replace(/export const SVG_ID_SCOPE_HELPERS[\s\S]*?\n\nconst /, 'const ')
    .replace(/const SVG_URL_REF[\s\S]*?\n\}\n\nconst /, 'const ')
    .replace('  if (!name) return scoped(master);', '  if (!name) return master;')
    .replace('React.Children.map(filledKids, scoped)', 'filledKids');

  it('is genuinely unscoped to start with', () => {
    expect(unscoped).not.toContain('function scopeSvgIds(');
    expect(unscoped).toContain('const safeRef =');          // otherwise current
    expect(unscoped).toContain('  if (!name) return master;');
  });

  it('gains the scoping on compile, and the upgrade is idempotent', () => {
    const once = upgradeVectorSetInstanceBranch(unscoped);
    expect(once).toContain('function scopeSvgIds(');
    expect(once).toContain('React.useId()');
    expect(once).toContain('if (!name) return scoped(master);');
    expect(once).toContain('React.Children.map(filledKids, scoped)');
    expect(once).toContain('url(#_clip2)');                 // artwork untouched
    expect(upgradeVectorSetInstanceBranch(once)).toBe(once);
  });
});
