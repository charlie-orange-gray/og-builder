import { describe, it, expect } from 'vitest';
import { InMemoryProjectFS, createEmptyProject } from './project-fs';
import { parseJSX } from '@/code/parsing/ast-utils';

// A user's Home page `app/page.client.tsx` was found at ZERO bytes inside an
// otherwise intact project (2026-09-09). It was repaired in the DB and came
// back empty a day later when a stale client flushed its pre-heal file map —
// so the fix has to live in the editor, not in the database: refuse the
// truncation on write, and rebuild the body on load for projects already
// holding one.
const real = `'use client';\nexport default function Page() { return <div data-id="root"><section data-id="hero">mine</section></div>; }`;
const WRAPPER = `import PageClient from './page.client';\n\nexport const metadata = {};\n\nexport default function Page() {\n  return <PageClient />;\n}\n`;

describe('ProjectFS truncation guard', () => {
  it('an empty module PARSES — which is why the parse gate could never catch this', () => {
    // The premise of the whole guard: every other net in the write path is
    // phrased in terms of parseability, and '' is valid JS.
    expect(parseJSX('')).toBeTruthy();
  });

  it('refuses to replace real content with an empty file', () => {
    const fs = new InMemoryProjectFS(new Map([['app/page.client.tsx', real]]));
    fs.writeFile('app/page.client.tsx', '');
    expect(fs.readFile('app/page.client.tsx')).toBe(real);
  });

  it('refuses whitespace-only content too', () => {
    const fs = new InMemoryProjectFS(new Map([['app/page.client.tsx', real]]));
    fs.writeFile('app/page.client.tsx', '\n  \t\n');
    expect(fs.readFile('app/page.client.tsx')).toBe(real);
  });

  it('still allows CREATING an empty file (CodeEditor "New File")', () => {
    const fs = new InMemoryProjectFS(new Map<string, string>());
    fs.writeFile('lib/utils.ts', '');
    expect(fs.readFile('lib/utils.ts')).toBe('');
    fs.writeFile('lib/utils.ts', 'export const a = 1;');   // then filled in
    expect(fs.readFile('lib/utils.ts')).toBe('export const a = 1;');
  });

  it('still allows overwriting an already-empty file with an empty one', () => {
    const fs = new InMemoryProjectFS(new Map([['lib/a.ts', '']]));
    fs.writeFile('lib/a.ts', '');
    expect(fs.readFile('lib/a.ts')).toBe('');
  });

  it('what AUTOSAVE ships still holds the real page after a refused write', () => {
    // The guard only matters if the snapshot autosave PUTs is unaffected —
    // autosave serializes `projectFS.getSnapshot()`, so a refused write must
    // leave the good bytes in the map, not merely log a complaint.
    const fs = new InMemoryProjectFS(new Map([
      ['app/page.client.tsx', real],
      ['app/page.tsx', WRAPPER],
    ]));
    fs.writeFile('app/page.client.tsx', '');          // the bug fires
    const shipped = Object.fromEntries(fs.getSnapshot());
    expect(shipped['app/page.client.tsx']).toBe(real); // …and this is what persists
    expect(shipped['app/page.client.tsx'].length).toBeGreaterThan(0);
  });

  it('does NOT catch a PARTIAL truncation — a real remaining limit', () => {
    // Honest boundary: the guard keys on emptiness. Content that is wrong but
    // non-empty still goes through, which is why the refusal needs reporting
    // server-side rather than being treated as a complete fix.
    const fs = new InMemoryProjectFS(new Map([['app/page.client.tsx', real]]));
    const halfGone = `'use client';\n`;
    fs.writeFile('app/page.client.tsx', halfGone);
    expect(fs.readFile('app/page.client.tsx')).toBe(halfGone);   // written, not blocked
  });

  it('guards every file, not just pages', () => {
    const fs = new InMemoryProjectFS(new Map([['app/globals.css', ':root { --x: 1px; }']]));
    fs.writeFile('app/globals.css', '');
    expect(fs.readFile('app/globals.css')).toBe(':root { --x: 1px; }');
  });
});

describe('ProjectFS empty-page-body heal', () => {
  const emptyBody = createEmptyProject().get('app/page.client.tsx')!;

  it('rebuilds a 0-byte page body on load', () => {
    const fs = new InMemoryProjectFS(new Map<string, string>());
    fs.loadSnapshot(new Map([
      ['app/page.client.tsx', ''],
      ['app/page.tsx', WRAPPER],
    ]));
    expect(fs.readFile('app/page.client.tsx')).toBe(emptyBody);
  });

  it('heals a nested page too, and leaves intact pages alone', () => {
    const fs = new InMemoryProjectFS(new Map<string, string>());
    fs.loadSnapshot(new Map([
      ['app/page.client.tsx', real],
      ['app/about/page.client.tsx', '   \n'],
      ['app/about/page.tsx', WRAPPER],
    ]));
    expect(fs.readFile('app/page.client.tsx')).toBe(real);          // untouched
    expect(fs.readFile('app/about/page.client.tsx')).toBe(emptyBody);
  });

  it('drops the stray data-id the wrapper picked up while the body was missing', () => {
    // With no body to parse, the editor treated the server wrapper as the
    // page's tree and stamped its <PageClient /> reference. The real project
    // carried `data-id="PageClient-mshwlhxc-f"`, generated 2026-08-06.
    const fs = new InMemoryProjectFS(new Map<string, string>());
    fs.loadSnapshot(new Map([
      ['app/page.client.tsx', ''],
      ['app/page.tsx', WRAPPER.replace('<PageClient />', '<PageClient data-id="PageClient-mshwlhxc-f" />')],
    ]));
    expect(fs.readFile('app/page.tsx')).toBe(WRAPPER);
  });

  it('leaves a wrapper that has no stray data-id byte-identical', () => {
    const fs = new InMemoryProjectFS(new Map<string, string>());
    fs.loadSnapshot(new Map([
      ['app/page.client.tsx', ''],
      ['app/page.tsx', WRAPPER],
    ]));
    expect(fs.readFile('app/page.tsx')).toBe(WRAPPER);
  });

  it('the healed body parses and carries a root node', () => {
    const fs = new InMemoryProjectFS(new Map<string, string>());
    fs.loadSnapshot(new Map([['app/page.client.tsx', '']]));
    const healed = fs.readFile('app/page.client.tsx')!;
    expect(parseJSX(healed)).toBeTruthy();
    expect(healed).toContain('data-id="root"');
  });
});
