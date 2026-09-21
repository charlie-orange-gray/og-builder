/** @vitest-environment jsdom */
// The copies only work if hydration is CLEAN. The client's first render must
// produce the same tree the server sent (all copies) — otherwise React hits a
// structural mismatch and can throw the subtree away and re-render it, which
// would trade a small pop for a whole-component flash. An effect then collapses
// to the matched copy.
import { describe, it, expect, vi, afterEach } from 'vitest';
import React, { act } from 'react';
import { renderToString } from 'react-dom/server';
import { hydrateRoot } from 'react-dom/client';
import withResponsiveProps from '../../../runtime/src/withResponsiveProps';

function Navbar({ style, initialVariant = 'default', ...rest }: any) {
  return (
    <div data-id="nav-root" {...rest} style={style}>
      {initialVariant !== 'variant-2' && <div data-id="links">Adidas</div>}
      {initialVariant === 'variant-2' && <div data-id="burger">burger</div>}
    </div>
  );
}
const W = withResponsiveProps(Navbar as any);
const RESP = JSON.stringify({ 450: { initialVariant: 'variant-2' }, _bp: [450, 1440] });

const count = (sel: string) => document.querySelectorAll(sel).length;
afterEach(() => { document.body.innerHTML = ''; vi.restoreAllMocks(); });

describe('hydration', () => {
  it('matches the server tree, then collapses to the matched copy', async () => {
    const errors: unknown[] = [];
    vi.spyOn(console, 'error').mockImplementation((...a) => { errors.push(a[0]); });

    const host = document.createElement('div');
    host.innerHTML = renderToString(<W data-id="nav-1" data-responsive={RESP} />);
    document.body.appendChild(host);
    // Both copies are in the server HTML.
    expect(count('[data-id="links"]')).toBe(1);
    expect(count('[data-id="burger"]')).toBe(1);

    // jsdom reports window.innerWidth 1024 → the base (desktop) copy wins.
    await act(async () => { hydrateRoot(host, <W data-id="nav-1" data-responsive={RESP} />); });

    // No hydration mismatch was reported…
    const mismatch = errors.filter((e) => String(e).match(/hydrat|did not match|Expected server HTML/i));
    expect(mismatch).toEqual([]);
    // …and only the matched copy survives.
    expect(count('[data-id="links"]')).toBe(1);
    expect(count('[data-id="burger"]')).toBe(0);
    // The picker stylesheet is gone too — one copy needs no media queries.
    expect(count('style[data-rv-copies]')).toBe(0);
  });
});

// HAZARD: every copy is MOUNTED for the first commit, so a component with a
// mount effect — a Marquee's rAF loop, a canvas scene, a scroll observer —
// starts up in copies that are about to be thrown away. This measures how much:
// it must be one commit's worth, and everything must be cleaned up after.
describe('effects in the copies that lose', () => {
  it('runs each copy once, then tears the losers down', async () => {
    const mounts: string[] = [];
    const unmounts: string[] = [];
    let rafHandles = 0;
    function Scene({ initialVariant = 'default', ...rest }: any) {
      React.useEffect(() => {
        mounts.push(initialVariant);
        const id = requestAnimationFrame(() => {});     // a Marquee-style loop
        rafHandles++;
        return () => { unmounts.push(initialVariant); cancelAnimationFrame(id); rafHandles--; };
      }, [initialVariant]);
      // NB `{...rest}` overrides data-id with the INSTANCE id, so count a
      // marker the spread cannot clobber.
      return <div data-id="scene" {...rest}><span data-scene-marker>{initialVariant}</span></div>;
    }
    const S = withResponsiveProps(Scene as any);
    const resp = JSON.stringify({ 450: { initialVariant: 'variant-2' }, 810: { initialVariant: 'variant-1' }, _bp: [450, 810, 1440] });

    const host = document.createElement('div');
    host.innerHTML = renderToString(<S data-id="s-1" data-responsive={resp} />);
    document.body.appendChild(host);
    await act(async () => { hydrateRoot(host, <S data-id="s-1" data-responsive={resp} />); });

    // Three distinct variants → three mounts on the hydrating commit…
    expect(mounts.sort()).toEqual(['default', 'variant-1', 'variant-2']);
    // …and the two that lost are unmounted once the effect collapses them.
    expect(unmounts.sort()).toEqual(['variant-1', 'variant-2']);
    // Nothing left running: the survivor holds exactly one frame handle.
    expect(rafHandles).toBe(1);
    expect(document.querySelectorAll('[data-scene-marker]').length).toBe(1);
  });
});

// HAZARD: a component with variants INSIDE another multiplies — the outer's
// copies each contain the inner, which makes its own. This pins the actual
// number so the cost is a measured fact rather than a guess.
describe('nesting', () => {
  it('multiplies copies N×M', () => {
    function Inner({ initialVariant = 'default', ...rest }: any) {
      return <span data-inner {...rest}>{initialVariant}</span>;
    }
    const I = withResponsiveProps(Inner as any);
    const innerResp = JSON.stringify({ 450: { initialVariant: 'variant-2' }, _bp: [450, 1440] });
    function Outer({ initialVariant = 'default', ...rest }: any) {
      return <div {...rest}><I data-id="inner-1" data-responsive={innerResp} /></div>;
    }
    const O = withResponsiveProps(Outer as any);
    const outerResp = JSON.stringify({ 450: { initialVariant: 'variant-2' }, 810: { initialVariant: 'variant-1' }, _bp: [450, 810, 1440] });

    const html = renderToString(<O data-id="outer-1" data-responsive={outerResp} />);
    const inners = html.match(/data-inner/g)?.length ?? 0;
    // 3 outer copies × 2 inner copies. Fine for a navbar; worth knowing before
    // putting variant components inside variant components several deep.
    expect(inners).toBe(6);
  });
});
