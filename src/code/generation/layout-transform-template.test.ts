import { describe, it, expect, vi } from 'vitest';
vi.mock('@/shared/debug-trace', () => ({ trace: { action: vi.fn(), fn: vi.fn(), error: vi.fn(), dom: vi.fn() } }));
import { ensureTransformTemplateInCode } from './generator-motion-props';
import { checkFile } from '@/code/oracle/check-file';

// A centred box (`translate(-50%, -50%)`) with `layout` in a master with two
// variants: resizing across variants FLIPs it and motion's projection rebuilds
// the transform without the translate unless a transformTemplate composes it.
const master = (variants: number) => `'use client';
import React, { useState, useEffect } from 'react';
import { motion, LayoutGroup } from 'framer-motion';
import { withResponsiveProps } from '@revyme/runtime';
const variantConfig = [${['default', 'variant-1'].slice(0, variants).map((n, i) => `{ name: '${n}', label: 'V', x: ${i * 400}, y: 0${i === 0 ? ', isPrimary: true' : ''} }`).join(', ')}];
function Card({ style, initialVariant = 'default', ...rest }: { style?: React.CSSProperties; initialVariant?: string; [key: string]: any }) {
  const [variant, setVariant] = useState(initialVariant);
  useEffect(() => { setVariant(initialVariant); }, [initialVariant]);
  return <LayoutGroup><motion.div layout={true} data-id="card-1" {...rest} data-name="Card" initial={['default', initialVariant]} animate={['default', variant]} style={{ position: 'absolute', width: variant === 'variant-1' ? '358px' : '300px', height: '300px', overflow: 'hidden', ...style }}>
    <motion.div data-id="frame-2" data-name="Frame" layout={true} style={{ position: 'absolute', top: '50%', left: '50%', width: '560px', height: '560px', transform: 'translate(-50%, -50%)' }}></motion.div>
  </motion.div></LayoutGroup>;
}
export default withResponsiveProps(Card);`;

describe('layout rebuilds the transform in multi-variant masters', () => {
  it('pairs a transformTemplate on a centred layout box', () => {
    const out = ensureTransformTemplateInCode(master(2), 'frame-2');
    expect(out).toContain('transformTemplate={(_, generated) => `translate(-50%, -50%) ${generated}`}');
    expect(checkFile(out, { kind: 'component' } as any).filter((v: any) => v.code === 'MOTION_TRANSFORM_TEMPLATE_DRIFT')).toEqual([]);
  });

  it('the oracle flags the unpaired box', () => {
    expect(checkFile(master(2), { kind: 'component' } as any).map((v: any) => v.code)).toContain('MOTION_TRANSFORM_TEMPLATE_DRIFT');
  });

  it('a single-variant master needs no template', () => {
    expect(ensureTransformTemplateInCode(master(1), 'frame-2')).toBe(master(1));
  });
});
