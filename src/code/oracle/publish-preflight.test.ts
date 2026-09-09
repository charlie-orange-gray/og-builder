import { describe, it, expect, beforeEach } from 'vitest';
import { resetProjectFS } from '@/code/project/project-fs';
import { runPublishPreflight, formatPreflightIssues, publishGatedFiles } from './publish-preflight';

const CANVAS = `/** @canvas { "viewports": [ { "id": "desktop", "label": "Desktop", "width": 1440, "isPrimary": true, "order": 0 } ], "positions": { "desktop": { "x": 0, "y": 0 } } } */`;
const CLEAN_PAGE = `'use client';
${CANVAS}
import React from 'react';
export default function Page() {
  return <div data-id="root" style={{ position: 'relative', width: '100%' }}>
    <p data-id="t" style={{ position: 'relative' }}>hello</p>
  </div>;
}`;
const STRING_STYLE_PAGE = CLEAN_PAGE.replace('<p data-id="t" style={{ position: \'relative\' }}>hello</p>', '<p data-id="t" style={{ position: \'relative\' }}>hi <span style="color:red">there</span></p>');
const DANGLING_PAGE = CLEAN_PAGE.replace('<p data-id="t"', '<p data-id="t" onClick={event1}');
const CLEAN_COMPONENT = `'use client';
import React from 'react';
import { motion, LayoutGroup } from 'framer-motion';
import { withResponsiveProps } from '@revyme/runtime';
const variantConfig = [{ name: 'default', label: 'Card', x: 0, y: 0, isPrimary: true }];
function Card({ style, initialVariant = 'default', ...rest }: any) {
  return <LayoutGroup><motion.div layout={true} data-id="card" {...rest} data-mroot="card" style={{ position: 'absolute', width: '100px', height: '100px', ...style }} /></LayoutGroup>;
}
export default withResponsiveProps(Card);`;

describe('publish pre-flight (bug-hunt 22)', () => {
  beforeEach(() => resetProjectFS(new Map()));

  it('a clean project passes', () => {
    resetProjectFS(new Map([['app/page.client.tsx', CLEAN_PAGE], ['components/Card.tsx', CLEAN_COMPONENT], ['lib/util.ts', 'export const a = 1;']]));
    expect(publishGatedFiles().map((f) => f.path).sort()).toEqual(['app/page.client.tsx', 'components/Card.tsx']);
    expect(runPublishPreflight()).toEqual([]);
  });

  it('a string style attribute blocks with file + line', () => {
    resetProjectFS(new Map([['app/page.client.tsx', STRING_STYLE_PAGE], ['components/Card.tsx', CLEAN_COMPONENT]]));
    const issues = runPublishPreflight();
    expect(issues.map((i) => [i.path, i.code])).toEqual([['app/page.client.tsx', 'STRING_STYLE_ATTR']]);
    expect(issues[0].line).toBeGreaterThan(0);
    expect(formatPreflightIssues(issues)).toMatch(/^Publish blocked — this file would crash the live site:\napp\/page\.client\.tsx:\d+ — /);
  });

  it('an undeclared handler identifier and a syntax error block too', () => {
    resetProjectFS(new Map([['app/page.client.tsx', DANGLING_PAGE], ['components/Broken.tsx', CLEAN_COMPONENT.replace('</LayoutGroup>', '')]]));
    const codes = runPublishPreflight().map((i) => `${i.path}:${i.code}`).sort();
    expect(codes).toContain('app/page.client.tsx:WOULD_CRASH');
    expect(codes).toContain('components/Broken.tsx:SYNTAX_ERROR');
  });

  it('tier-2 dialect findings never block a publish', () => {
    // No @canvas block and a classname — dialect violations, not crashes.
    const dialectOnly = `'use client';
import React from 'react';
export default function Page() {
  return <div data-id="root" className="p-4" style={{ position: 'relative' }}><p data-id="t" style={{ position: 'relative' }}>x</p></div>;
}`;
    resetProjectFS(new Map([['app/page.client.tsx', dialectOnly]]));
    expect(runPublishPreflight()).toEqual([]);
  });
});
