// rotated-layout-lift.spec.ts — dragging a flow child of a ROTATED flex frame
// keeps the lifted overlay under the cursor (2026-09-09: the live-size
// correction read the child's painted AABB and swapped its width/height mid-
// drag, shifting the overlay 40px off the pointer for the whole gesture).
import { test, expect } from '@playwright/test';
import { EditorPage } from './helpers/editor-page';

test('lifted child of a rotate(90deg) flex frame stays centred on the cursor', async ({ page }) => {
  const editor = new EditorPage(page);
  await editor.gotoWithSeed('ROTATED_FLEX_FRAME');
  await editor.primeNode('chip');
  await editor.select(['chip']);
  await page.waitForTimeout(200);

  const box = await editor.nodeBox('chip');
  const from = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  const to = { x: from.x + 60, y: from.y + 40 };
  await editor.duringDrag('chip', to, async () => {
    const info = await editor.sandbox().locator('[data-id="chip"]').first().evaluate((el) => {
      const r = el.getBoundingClientRect();
      return { cx: r.left + r.width / 2, cy: r.top + r.height / 2, w: el.style.width, h: el.style.height };
    });
    // The lift keeps the CSS (unrotated) size — 120×40 — never the painted 40×120 AABB.
    expect(info.w).toBe('120px');
    expect(info.h).toBe('40px');
    // Grabbed at the centre → the overlay centre tracks the pointer (±1px after
    // the ±1px pump wiggle).
    expect(Math.abs(info.cx - to.x)).toBeLessThan(3);
    expect(Math.abs(info.cy - to.y)).toBeLessThan(3);
  }, { prime: false, steps: 24 });
});
