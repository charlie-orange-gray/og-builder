import { describe, it, expect } from 'vitest';
import { wouldCreateComponentCycle, componentImportsOf } from './component-cycle';

const files: Record<string, string> = {
  'components/Header.tsx': `import React from 'react';\nimport Button from '@/components/Button';\nexport default function Header() { return <Button />; }`,
  'components/Button.tsx': `import React from 'react';\nexport default function Button() { return <button />; }`,
  'components/Card.tsx': `import React from 'react';\nimport Header from '@/components/Header.tsx';\nimport Logo from '@/icons/Logo';\nexport default function Card() { return <Header />; }`,
  'icons/Logo.tsx': `export default function Logo() { return <svg />; }`,
  'app/page.client.tsx': `import Header from '@/components/Header';`,
};
const read = (p: string) => files[p] ?? null;

describe('componentImportsOf', () => {
  it('lists component and icon master imports, normalising the .tsx suffix', () => {
    expect(componentImportsOf('components/Card.tsx', read)).toEqual(['components/Header.tsx', 'icons/Logo.tsx']);
    expect(componentImportsOf('components/Button.tsx', read)).toEqual([]);
  });
});

describe('wouldCreateComponentCycle', () => {
  it('a master into itself', () => {
    expect(wouldCreateComponentCycle('components/Header.tsx', 'components/Header.tsx', read)).toBe(true);
  });
  it('a master whose chain reaches the target (Card → Header → Button; drop Card into Button)', () => {
    expect(wouldCreateComponentCycle('components/Card.tsx', 'components/Button.tsx', read)).toBe(true);
    expect(wouldCreateComponentCycle('components/Card.tsx', 'components/Header.tsx', read)).toBe(true);
  });
  it('the safe directions and pages never cycle', () => {
    expect(wouldCreateComponentCycle('components/Button.tsx', 'components/Header.tsx', read)).toBe(false);
    expect(wouldCreateComponentCycle('components/Header.tsx', 'components/Card.tsx', read)).toBe(false);
    expect(wouldCreateComponentCycle('components/Header.tsx', 'app/page.client.tsx', read)).toBe(false);
    expect(wouldCreateComponentCycle('', 'components/Header.tsx', read)).toBe(false);
  });
});
