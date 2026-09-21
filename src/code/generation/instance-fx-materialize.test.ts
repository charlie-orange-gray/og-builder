import { describe, it, expect, vi } from 'vitest';
vi.mock('@/shared/debug-trace', () => ({ trace: { action: vi.fn(), fn: vi.fn(), error: vi.fn(), dom: vi.fn() } }));
import { materializeInstanceFxInCode } from './instance-fx-gen';
import { syncImports } from '@/code/mutation/mutation-queue';
import { checkFile } from '@/code/oracle/check-file';

// A site import writes a nested link's staggered appear as the spec only;
// the builder generates the code with its own writer on import.
const MASTER = `'use client';
/** @name "Menu" */
import React, { useState, useEffect } from 'react';
import { motion, LayoutGroup } from 'framer-motion';
import { withResponsiveProps } from '@revyme/runtime';
import CustomLinkS from '@/components/CustomLinkS';
const variantConfig = [{ name: 'default', label: 'Desktop', x: 0, y: 0, isPrimary: true }];
function Menu({ style, initialVariant = 'default', ...rest }: { style?: React.CSSProperties; initialVariant?: string; [key: string]: any }) {
  const [variant, setVariant] = useState(initialVariant);
  useEffect(() => { setVariant(initialVariant); }, [initialVariant]);
  return (
    <LayoutGroup>
    <motion.div layout={true} data-id="menu-1" {...rest} data-name="Menu" initial={['default', initialVariant]} animate={['default', variant]} style={{ position: 'absolute', display: 'flex', ...style }}>
      <CustomLinkS data-id="menu-2" data-name="Custom Link S" data-instance-fx='{"appear":{"from":{"opacity":0,"y":20},"trigger":"onAppear","replay":false,"transition":{"type":"tween","duration":1,"delay":0.4,"ease":"[.2,0,.2,1]"}}}' style={{ position: 'relative' }}></CustomLinkS>
    </motion.div>
    </LayoutGroup>
  );
}
export default withResponsiveProps(Menu);`;

describe('materializeInstanceFxInCode', () => {
  it('generates the appear code for a spec-only instance, oracle-clean inside a master', () => {
    const out = syncImports(materializeInstanceFxInCode(MASTER));
    expect(out).toContain('const menu_2FxAppOpacity = useMotionValue(0);');
    // A cubic-bezier ease is an array to motion, never a quoted name.
    expect(out).toContain("animate(menu_2FxAppOpacity, 1, { type: 'tween', duration: 1, ease: [.2,0,.2,1], delay: 0.4 });");
    expect(out).toMatch(/style=\{\{ opacity: menu_2FxAppOpacity, y: menu_2FxAppY/);
    expect(checkFile(out, { kind: 'component' } as any).map((v: any) => v.code)).toEqual([]);
  });

  it('is idempotent', () => {
    const once = materializeInstanceFxInCode(MASTER);
    expect(materializeInstanceFxInCode(once)).toBe(once);
  });
});
