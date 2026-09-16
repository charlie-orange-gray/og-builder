// text-anim-paste.integration.test.ts — duplicating / pasting a text node that
// carries a TEXT EFFECT keeps the effect. The effect is JSX (`data-text-anim` +
// a `<RevymeSplitText>` wrapper), invisible to the clipboard's node model, so
// copy reads the config off the source and paste re-wraps the copy (live find
// 2026-09-09: the duplicate came out as a plain <p>).
import { describe, it, expect, beforeEach } from 'vitest';
import { projectFS } from '@/code/project/project-fs';
import { setActiveFilePath, flushNow, initMutationQueue } from '@/code/mutation/mutation-queue';
import { setBumpVersion } from '@/code/project/modify-file';
import { parseJSXToNodes } from '@/code/parsing/parser';
import { copyNodes } from './copy';
import { executePaste } from './paste';
import { parse } from '@babel/parser';
import { getDefaultStore } from 'jotai';
import { activeFilePathAtom } from '@/code/project/active-file-store';

const FILE = 'app/page.tsx';
const CONFIG = { animationType: 'blur-in', splitBy: 'word', duration: 1, delay: 0.05, blur: 10 };
const BASE = `'use client';
import React from 'react';
import { RevymeSplitText } from '@revyme/runtime';
export default function Page() {
  return (
    <div data-id="root" style={{ position: 'relative', width: '1440px', display: 'flex', flexDirection: 'column' }}>
      <p data-id="hero-text" data-name="Text" data-text-anim='${JSON.stringify(CONFIG)}' style={{ fontSize: '36px', color: '#ffffff', position: 'relative', flex: '0 0 auto' }}><RevymeSplitText spec={{ animationType: "blur-in", splitBy: "word", duration: 1, delay: 0.05, blur: 10 }}>Build faster</RevymeSplitText></p>
    </div>
  );
}`;

function seed(): Map<string, any> {
  projectFS.writeFile(FILE, BASE);
  setActiveFilePath(FILE);
  // copy reads the SOURCE through the active-file atom (not the queue's path)
  getDefaultStore().set(activeFilePathAtom, FILE);
  setBumpVersion(() => {});
  initMutationQueue(BASE, code => projectFS.writeFile(FILE, code));
  return parseJSXToNodes(BASE);
}
const expectParses = (code: string) =>
  expect(() => parse(code, { sourceType: 'module', plugins: ['jsx', 'typescript'] })).not.toThrow();

beforeEach(() => { projectFS.writeFile(FILE, BASE); });

describe('text effect survives copy/paste', () => {
  it('the duplicate carries data-text-anim and the RevymeSplitText wrapper', () => {
    const nodes = seed();
    copyNodes(['hero-text'], nodes);
    executePaste({ selectedIds: ['hero-text'], nodes, activeFilePath: FILE });
    flushNow();
    const out = projectFS.readFile(FILE)!;
    expectParses(out);
    expect(out.match(/data-text-anim=/g)?.length).toBe(2);
    expect(out.match(/<RevymeSplitText\b/g)?.length).toBe(2);
    // both wrappers hold the text
    expect(out.match(/Build faster\s*<\/RevymeSplitText>/g)?.length).toBe(2);
  });
});
