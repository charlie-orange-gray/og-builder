import { describe, it, expect } from 'vitest';
import { InMemoryProjectFS } from './project-fs';

const PAGE = `'use client';
export default function Page() {
  return (<div data-id="root" style={{ position: 'relative' }}>
    <h1 data-id="hero-title" style={{ fontSize: '64px' }}>Hi</h1>
    <style>{\`
      :lang(fr) [data-id="hero-title"] { color: #fff; }
      @media (max-width: 768px) and (min-width: 375.02px) {
        [data-id="hero-title"] { font-size: 44px; letter-spacing: -1.4px; }
        [data-id="hero"] { flex: 0 0 auto !important; width: 100% !important; }
      }
      @media (max-width: 375px) { [data-id="hero-title"] { font-size: 32px; } }
    \`}</style>
  </div>);
}
`;

describe('loadSnapshot media !important heal', () => {
  it('appends !important to every banded / :lang declaration on load, idempotent', () => {
    const fs = new InMemoryProjectFS(new Map<string, string>());
    fs.loadSnapshot(new Map([['app/page.client.tsx', PAGE], ['components/Card.tsx', PAGE], ['lib/x.ts', 'const a = `@media (max-width: 375px) { [data-id="q"] { top: 0; } }`;']]));
    const healed = fs.readFile('app/page.client.tsx')!;
    expect(healed).toContain(`[data-id="hero-title"] { font-size: 44px !important; letter-spacing: -1.4px !important; }`);
    expect(healed).toContain(`:lang(fr) [data-id="hero-title"] { color: #fff !important; }`);
    expect(healed).toContain(`[data-id="hero-title"] { font-size: 32px !important; }`);
    expect(healed).toContain(`flex: 0 0 auto !important; width: 100% !important;`);
    expect(healed).toContain(`style={{ fontSize: '64px' }}`);
    expect(fs.readFile('components/Card.tsx')).toBe(healed);
    expect(fs.readFile('lib/x.ts')).toContain('top: 0;');
    const again = new InMemoryProjectFS(new Map<string, string>());
    again.loadSnapshot(new Map([['app/page.client.tsx', healed]]));
    expect(again.readFile('app/page.client.tsx')).toBe(healed);
  });
});
