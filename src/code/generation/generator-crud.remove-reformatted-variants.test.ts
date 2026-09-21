// Deleting a node whose variant object was REFORMATTED by an earlier mutation.
//
// The per-node cleanup passes drop a declaration by matching its first line and
// filtering it out. A babel reformat can leave a variant object spanning two
// lines whose first line opens AND closes a brace:
//
//   const divVariants = { default: { flex: '0 0 auto' }
//   };
//
// The guard there tested the last character, so this line was dropped and its
// `};` orphaned — babel then rejected the whole mutation and the delete was
// blocked ("AI changes blocked — validation failed", reported 2026-09-18).

import { describe, it, expect } from 'vitest';
import { removeNodeInCode } from './generator-crud';
import { validateGeneratedCode } from '@/code/mutation/mutation-queue';

const COMPONENT = `'use client';

import React from 'react';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';

const keepVariants = { default: { flex: '0 0 auto' }
};

const goneVariants = { default: { flex: '0 0 auto' }
};

function Navbar({ style, initialVariant = 'default', ...rest }: any) {
  return <LayoutGroup>
    <motion.div data-id="root" {...rest} data-mroot="root" style={style}>
    <AnimatePresence mode="popLayout">{initialVariant === "default" && <motion.div layout={true} data-id="gone" variants={goneVariants} initial={['default', initialVariant]} animate={['default', initialVariant]} data-name="Frame" style={{
            position: 'relative', height: '4px' }} key="gone"></motion.div>}</AnimatePresence>
    <motion.div layout={true} data-id="keep" variants={keepVariants} initial={['default', initialVariant]} animate={['default', initialVariant]} data-name="Frame" style={{
          position: 'relative', height: '4px' }}></motion.div></motion.div>
    </LayoutGroup>;
}
export default Navbar;
`;

describe('removeNodeInCode on a reformatted variant object', () => {
  const out = removeNodeInCode(COMPONENT, 'gone');

  // The gate the mutation queue itself runs — `parseJSX` recovers from errors
  // and returns null rather than throwing, so it cannot see this at all.
  it('passes the validation gate that blocked the delete', () => {
    expect(validateGeneratedCode(out)).toBeNull();
  });

  it('takes the whole variant object, not just its first line', () => {
    expect(out).not.toContain('goneVariants');
    expect(out).not.toMatch(/^\};$\n^\};$/m);   // the orphaned closer
  });

  it('keeps the siblings and their variant objects', () => {
    expect(out).toContain('data-id="keep"');
    expect(out).toContain('const keepVariants');
  });

  it('does not leave an empty AnimatePresence behind', () => {
    expect(out).not.toMatch(/<AnimatePresence[^>]*>\s*(\{\s*\})?\s*<\/AnimatePresence>/);
  });
});
