/** @vitest-environment node */
// The variant a viewport gets, painted BEFORE hydration.
//
// A published page is server-rendered with no idea how wide the browser is, so
// framer-motion bakes the DEFAULT variant inline and a phone shows the desktop
// design until React hydrates — the ~0.5s "loads desktop, then snaps to mobile"
// users reported on 2026-09-18. React gives a parent no way to see a child's
// rendered output (react.dev/reference/react/Children), so the HOC is handed
// the variants objects by reference at the export site and derives the CSS from
// them on the server.
//
// Imported from the runtime SOURCE (not the published package) so this covers
// the code as written here; the runtime package has no test runner of its own.
import { it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { motion } from 'framer-motion';
import withResponsiveProps from '../../../runtime/src/withResponsiveProps';

const navRootVariants = {
  default: { flexDirection: 'row', gap: '40px' },
  'variant-2': { flexDirection: 'column', gap: '4px' },
};
const navLinksVariants = {
  default: { display: 'flex' },
  'variant-2': { display: 'none' },
};

function Nav({ style, initialVariant = 'default', ...rest }: any) {
  const [variant] = React.useState(initialVariant);
  return (
    <motion.div data-id="nav-root" data-mroot="nav-root" {...rest}
      variants={navRootVariants} initial={['default', variant]} animate={['default', variant]} style={style}>
      <motion.div data-id="nav-links" variants={navLinksVariants}
        initial={['default', variant]} animate={['default', variant]}>links</motion.div>
    </motion.div>
  );
}

// A component as they exist TODAY — no map, must behave exactly as before.
function PlainNav(props: any) { return Nav(props); }
const Old = withResponsiveProps(PlainNav);

// The shape codegen emits: a static beside the function, export line untouched.
// Assigned AFTER the wrap on purpose — the runtime reads it per render, so a
// component file's statement order must not matter.
const New = withResponsiveProps(Nav);
(Nav as any).variantsById = { 'nav-root': navRootVariants, 'nav-links': navLinksVariants };
const RESPONSIVE = JSON.stringify({ 810: { initialVariant: 'variant-2' }, _bp: [810, 1440] });

it('server HTML still paints the desktop variant inline (unchanged)', () => {
  const html = renderToString(<New data-id="nav-1" data-responsive={RESPONSIVE} />);
  expect(html).toContain('flex-direction:row');
});

it('ships CSS that states the mobile variant, gated until hydration', () => {
  const html = renderToString(<New data-id="nav-1" data-responsive={RESPONSIVE} />);
  require('fs').writeFileSync('/tmp/prestyle.html', html);
  expect(html).toContain('@media (max-width: 810px)');
  expect(html).toContain(':not([data-rv-hydrated])');
  expect(html).toContain('flex-direction: column !important');
  expect(html).toContain('gap: 4px !important');
  // the child element too
  expect(html).toContain('display: none !important');
  // scoped to THIS instance, root matched via data-mroot
  expect(html).toContain('[data-id="nav-1"]:not([data-rv-hydrated]) [data-id="nav-links"]');
  expect(html).toContain('[data-id="nav-1"]:not([data-rv-hydrated])[data-mroot="nav-root"]');
});

it('emits nothing without the map — existing components are untouched', () => {
  const html = renderToString(<Old data-id="nav-1" data-responsive={RESPONSIVE} />);
  expect(html).not.toContain('data-rv-hydrated');
  expect(html).toContain('flex-direction:row');
});

it('emits nothing when no breakpoint changes the variant', () => {
  const html = renderToString(<New data-id="nav-1" data-responsive={JSON.stringify({ _bp: [810] })} />);
  expect(html).not.toContain('data-rv-hydrated');
});
