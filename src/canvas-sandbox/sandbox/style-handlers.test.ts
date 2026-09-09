import { describe, it, expect } from 'vitest';
import { applyTwoPass } from './style-handlers';

// A REPLICA / component-variant style edit COMMITS to an `@container`/@media
// rule with `!important` (updateContainerQueryStyle). The LIVE drag preview
// must therefore patch the DOM with `!important` too — a plain inline patch
// (no priority) loses to the stale `!important` rule still carrying the
// pre-drag value, so the canvas wouldn't move during the drag and only jumped
// on release (live find 2026-07-03). ControlProvider.updateStyleLive passes
// `important: true` for the replica/variant branch; this locks in that
// applyTwoPass honours it.
describe('applyTwoPass — important flag (replica/variant live drag)', () => {
  it('sets inline !important when important=true (beats a stale @container !important rule)', () => {
    const el = document.createElement('div');
    applyTwoPass(el, { padding: '96px' }, true);
    expect(el.style.getPropertyPriority('padding')).toBe('important');
    expect(el.style.padding).toBe('96px');
  });

  it('sets a plain inline value when important=false (primary/base edit)', () => {
    const el = document.createElement('div');
    applyTwoPass(el, { padding: '96px' }, false);
    expect(el.style.getPropertyPriority('padding')).toBe('');
    expect(el.style.padding).toBe('96px');
  });

  it('camelCase keys are kebab-cased for the important setProperty path', () => {
    const el = document.createElement('div');
    applyTwoPass(el, { paddingTop: '40px' }, true);
    expect(el.style.getPropertyPriority('padding-top')).toBe('important');
    expect(el.style.paddingTop).toBe('40px');
  });
});

// ─── data-live-important residue tracking ───────────────────────────────────
// A replica live-scrub patches inline with !important; the commit skips the
// render, so renderNodes must know which props to sweep (the undo-stale bug).
import { trackLiveImportant, untrackLiveImportant } from './style-handlers';

describe('live-important residue marker', () => {
  it('important set marks the element; plain set unmarks', () => {
    const el = document.createElement('div');
    applyTwoPass(el, { paddingTop: '44px' }, true);
    expect(el.getAttribute('data-live-important')).toBe('padding-top');
    expect(el.style.getPropertyPriority('padding-top')).toBe('important');
    applyTwoPass(el, { paddingTop: '20px' }, false);
    expect(el.getAttribute('data-live-important')).toBeNull();
  });

  it('accumulates multiple props and removes one at a time', () => {
    const el = document.createElement('div');
    trackLiveImportant(el, 'padding-top');
    trackLiveImportant(el, 'max-width');
    trackLiveImportant(el, 'max-width');
    expect(el.getAttribute('data-live-important')!.split(',').sort()).toEqual(['max-width', 'padding-top']);
    untrackLiveImportant(el, 'padding-top');
    expect(el.getAttribute('data-live-important')).toBe('max-width');
    untrackLiveImportant(el, 'max-width');
    expect(el.getAttribute('data-live-important')).toBeNull();
  });
});

// batch fan-out marks replica-target patches too (the unmarked gap that kept
// a tablet replica's inline stale through undo — live find 2026-07-21)
import { patchMultipleStyles } from './style-handlers';
import { setContentRoot } from './sandbox-state';

describe('patchMultipleStyles residue marking', () => {
  it('marks replica-target batch patches, leaves primary unmarked', () => {
    document.body.innerHTML = '';
    const root = document.createElement('div');
    document.body.appendChild(root);
    setContentRoot(root);
    const mk = (dni: string, id: string) => {
      const el = document.createElement('div');
      el.setAttribute('data-node-id', dni);
      el.setAttribute('data-id', id);
      root.appendChild(el);
      return el;
    };
    const desktop = mk('badge', 'badge');
    const tablet = mk('tablet-badge', 'badge');
    patchMultipleStyles([
      { nodeId: 'badge', vpPrefix: '', styles: { width: '120px' }, important: false },
      { nodeId: 'badge', vpPrefix: 'tablet-', styles: { width: '120px' }, important: false },
    ] as never);
    expect(desktop.getAttribute('data-live-important')).toBeNull();
    expect(tablet.getAttribute('data-live-important')).toBe('width');
  });
});

import { setCollectionGhostsHidden } from './style-handlers';

describe('setCollectionGhostsHidden — row vs node-inside-row', () => {
  const rule = () => document.getElementById('collection-ghost-hide-style')?.textContent ?? '';
  it('a ROW drag collapses whole ghost rows; a node inside the row hides only its own copies, keeping the rows', () => {
    const root = document.createElement('div');
    root.innerHTML = `
      <div data-node-id="d:list" data-id="list">
        <div data-node-id="d:row" data-id="row"><p data-node-id="d:title" data-id="title">a</p></div>
        <div data-node-id="d:row__1" data-id="row" data-collection-ghost="true" data-cms-ghost="true"><p data-node-id="d:title__1" data-id="title">b</p></div>
        <div data-node-id="d:row__2" data-id="row" data-collection-ghost="true" data-cms-ghost="true"><p data-node-id="d:title__2" data-id="title">c</p></div>
      </div>`;
    document.body.appendChild(root);
    setContentRoot(root);

    setCollectionGhostsHidden('list', 'd:', true);
    expect(rule()).toBe('[data-node-id="d:list"] > [data-collection-ghost] { display: none !important; }');
    setCollectionGhostsHidden('list', 'd:', false);
    expect(rule()).toBe('');

    setCollectionGhostsHidden('list', 'd:', true, 'title');
    expect(rule()).toBe('[data-node-id="d:list"] > [data-collection-ghost] [data-node-id^="d:title__"] { visibility: hidden !important; }');
    // the rule targets exactly the two ghost copies of the dragged title, never the primary or the rows
    const matched = Array.from(root.querySelectorAll('[data-node-id="d:list"] > [data-collection-ghost] [data-node-id^="d:title__"]')).map((e) => e.getAttribute('data-node-id'));
    expect(matched).toEqual(['d:title__1', 'd:title__2']);
    expect(root.querySelectorAll('[data-collection-ghost]').length).toBe(2);
    setCollectionGhostsHidden('list', 'd:', false, 'title');
    expect(rule()).toBe('');
    root.remove();
  });
});

import { setNodeHidden } from './style-handlers';

describe('setNodeHidden — transient drop hide in a head stylesheet', () => {
  it('adds/removes a per-node rule in document.head, independent of the renderer-owned canvas sheet', () => {
    const sheet = () => document.getElementById('node-transient-hide-style')?.textContent ?? '';
    setNodeHidden('VuDaNu-1', '', true);
    expect(sheet()).toBe('[data-node-id="VuDaNu-1"] { visibility: hidden !important; }');
    setNodeHidden('frame-2', 'desktop:', true);
    expect(sheet()).toContain('[data-node-id="desktop:frame-2"]');
    setNodeHidden('VuDaNu-1', '', false);
    expect(sheet()).toBe('[data-node-id="desktop:frame-2"] { visibility: hidden !important; }');
    setNodeHidden('frame-2', 'desktop:', false);
    expect(sheet()).toBe('');
  });
});
