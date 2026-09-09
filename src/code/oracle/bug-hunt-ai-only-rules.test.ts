// Rules for the bug-hunt items whose BUILDER doors were closed on 2026-09-08
// but whose hand/AI-written shapes still slip through: 19 (pagination
// canonical form), 20 (per-variant `d` in CSS path() form), 21 (shorthand ⟷
// longhand mix in one style object).
import { describe, it, expect, vi } from 'vitest';
vi.mock('@/shared/debug-trace', () => ({ trace: { action: vi.fn(), fn: vi.fn(), error: vi.fn() } }));
import { checkFile } from './check-file';

const codes = (code: string, kind: 'page' | 'component' = 'page') => checkFile(code, { kind }).map((x) => x.code);
const find = (code: string, c: string, kind: 'page' | 'component' = 'page') => checkFile(code, { kind }).find((x) => x.code === c);

const CANVAS = `/** @canvas { "viewports": [ { "id": "desktop", "label": "Desktop", "width": 1440, "isPrimary": true, "order": 0 } ], "positions": { "desktop": { "x": 0, "y": 0 } } } */`;
const listPage = (marker: string, sliceVar: string, stateVar = sliceVar) => `'use client';
${CANVAS}
import React, { useState } from 'react';
import blog from '@/cms/blog.json';
import LoadMore from '@/components/LoadMore';
export default function Page() {
  const [${stateVar}, set${stateVar.charAt(0).toUpperCase() + stateVar.slice(1)}] = useState(2);
  return <div data-id="root" style={{ position: 'relative', width: '100%', display: 'flex', flexDirection: 'column' }}>
    <div data-id="frame-abc-1" style={{ position: 'relative', display: 'flex', flexDirection: 'column', order: '0' }} ${marker}>
      {blog.slice(0, ${sliceVar}).map((item, idx) => <div data-id="row" key={idx} style={{ position: 'relative', order: '0' }}><p data-id="t" style={{ position: 'relative' }}>{item.title}</p></div>)}
      {${sliceVar} < blog.length && <LoadMore data-id="loadmore-frame-abc-1" data-pagination-ui="true" onLoadMore={() => set${stateVar.charAt(0).toUpperCase() + stateVar.slice(1)}((c) => c + 2)} style={{ order: '1' }} />}
    </div>
  </div>;
}`;

describe('BUG 19 — CMS_PAGINATION_MARKER_FORM / CMS_PAGINATION_VAR_NONCANONICAL', () => {
  it('the canonical pair passes (marker + id-derived var)', () => {
    const vs = codes(listPage('data-pagination="loadMore:2"', 'visFrameabc1'));
    expect(vs).not.toContain('CMS_PAGINATION_MARKER_FORM');
    expect(vs).not.toContain('CMS_PAGINATION_VAR_NONCANONICAL');
    expect(codes(listPage('data-pagination="infinite:6"', 'visFrameabc1'))).not.toContain('CMS_PAGINATION_MARKER_FORM');
  });
  it('a marker the panel cannot read is flagged', () => {
    expect(codes(listPage('data-pagination="load-more: 2"', 'visFrameabc1'))).toContain('CMS_PAGINATION_MARKER_FORM');
    expect(codes(listPage("data-pagination='loadMore:2'", 'visFrameabc1'))).toContain('CMS_PAGINATION_MARKER_FORM');
    expect(codes(listPage('data-pagination="loadMore:0"', 'visFrameabc1'))).toContain('CMS_PAGINATION_MARKER_FORM');
  });
  it('a state var not derived from the container id is flagged with the exact expected name', () => {
    const v = find(listPage('data-pagination="loadMore:2"', 'visibleCount'), 'CMS_PAGINATION_VAR_NONCANONICAL');
    expect(v?.tier).toBe(2);
    expect(v?.message).toContain('recognises ONLY "visFrameabc1"');
    expect(v?.message).toContain('slices by "visibleCount"');
  });
});

describe('BUG 20 — SHAPE_VARIANT_D_CSS_FORM', () => {
  const master = (d: string) => `'use client';
import React, { useState } from 'react';
import { motion, LayoutGroup } from 'framer-motion';
import { withResponsiveProps } from '@revyme/runtime';
const variantConfig = [{ name: 'default', label: 'Frame', x: 0, y: 0, isPrimary: true }, { name: 'variant-1', label: 'V', x: 400, y: 0 }];
const shapeG0Variants = { default: {}, 'variant-1': { d: ${d} } };
function Fr({ style, initialVariant = 'default', ...rest }: any) {
  const [variant, setVariant] = useState(initialVariant);
  return <LayoutGroup><motion.div layout={true} data-id="frame-1" {...rest} data-mroot="frame-1" style={{ position: 'absolute', width: '100px', height: '100px', ...style }} initial={['default', initialVariant]} animate={['default', variant]}>
    <svg data-id="shape-1" viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: 'relative', width: '100px', height: '100px', overflow: 'visible' }}>
      <motion.path data-id="shape-1-g0" variants={shapeG0Variants} initial={['default', initialVariant]} animate={['default', variant]} fill="#000" d="M0 0 L100 100 L0 100 Z" />
    </svg>
  </motion.div></LayoutGroup>;
}
export default withResponsiveProps(Fr);`;
  it('raw path data passes, the CSS path() form is flagged', () => {
    expect(codes(master("'M0 0 L50 100 L0 100 Z'"), 'component')).not.toContain('SHAPE_VARIANT_D_CSS_FORM');
    const v = find(master(`'path("M0 0 L50 100 L0 100 Z")'`), 'SHAPE_VARIANT_D_CSS_FORM', 'component');
    expect(v?.tier).toBe(2);
    expect(v?.message).toContain("d: 'M0 0 L10 10 Z'");
  });
});

describe('BUG 21 — STYLE_SHORTHAND_LONGHAND_MIX', () => {
  const page = (style: string) => `'use client';
${CANVAS}
import React from 'react';
export default function Page() {
  return <div data-id="root" style={{ position: 'relative', width: '100%' }}>
    <div data-id="box" style={{ position: 'relative', ${style} }} />
  </div>;
}`;
  it('pure shorthand or pure longhands pass', () => {
    expect(codes(page("padding: '8px 16px', margin: '0px auto', borderRadius: '8px'"))).not.toContain('STYLE_SHORTHAND_LONGHAND_MIX');
    expect(codes(page("paddingTop: '8px', paddingBottom: '8px', borderTopLeftRadius: '4px'"))).not.toContain('STYLE_SHORTHAND_LONGHAND_MIX');
  });
  it('a longhand BEFORE the shorthand is dead code and is flagged', () => {
    const v = find(page("paddingTop: '40px', padding: '8px'"), 'STYLE_SHORTHAND_LONGHAND_MIX');
    expect(v?.tier).toBe(2);
    expect(v?.elementId).toBe('box');
    expect(v?.message).toContain('paddingTop is written BEFORE "padding"');
  });
  it('shorthand FIRST then a longhand override is the builder reset idiom and passes', () => {
    expect(codes(page("margin: 0, marginTop: '24px'"))).not.toContain('STYLE_SHORTHAND_LONGHAND_MIX');
    expect(codes(page("padding: '8px', paddingTop: '40px'"))).not.toContain('STYLE_SHORTHAND_LONGHAND_MIX');
  });
  it('border family and radius family are covered', () => {
    expect(codes(page("borderTopWidth: '4px', border: '1px solid red'"))).toContain('STYLE_SHORTHAND_LONGHAND_MIX');
    expect(codes(page("borderBottomLeftRadius: '0px', borderRadius: '8px'"))).toContain('STYLE_SHORTHAND_LONGHAND_MIX');
  });
});
