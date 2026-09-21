import { describe, it, expect } from 'vitest';
import { checkFile } from '../check-file';

const page = (jsx: string, imports = "import { withA } from '@/overrides/Fx';") => `'use client';
import { motion } from 'framer-motion';
import { Override } from '@revyme/runtime';
${imports}

export default function Page() {
  return (
    <div data-id="root">
      ${jsx}
    </div>
  );
}
`;

const codes = (code: string) => checkFile(code, { kind: 'page' }).map((x) => x.code).filter((c) => c.startsWith('OVERRIDE_'));

describe('oracle: code overrides', () => {
  it('accepts a well-formed override', () => {
    expect(codes(page('<Override with={withA}><motion.div data-id="a" /></Override>'))).toEqual([]);
    expect(codes(page(`<Override with={[withA, withB]}>
        <motion.div data-id="a" />
      </Override>`, "import { withA, withB } from '@/overrides/Fx';"))).toEqual([]);
  });

  it('flags several children, a missing data-id and a missing import', () => {
    expect(codes(page('<Override with={withA}><div data-id="a" /><div data-id="b" /></Override>'))).toContain('OVERRIDE_CHILD_COUNT');
    expect(codes(page('<Override with={withA}><div /></Override>'))).toContain('OVERRIDE_CHILD_NO_DATA_ID');
    expect(codes(page('<Override with={withZ}><div data-id="a" /></Override>'))).toContain('OVERRIDE_NOT_IMPORTED');
    expect(codes(page('<Override><div data-id="a" /></Override>'))).toContain('OVERRIDE_WITHOUT_OVERRIDE');
  });
});
