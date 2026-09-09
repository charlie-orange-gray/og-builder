import { describe, it, expect } from 'vitest';
import { syncLinkHandlerInCode } from './generator-styles';

/**
 * BUG 17 — Link To + Keep Params on a CMS row link.
 *
 * The href of a CMS-bound row is a TEMPLATE LITERAL containing `${…}`. The old
 * extraction (`/\bhref=\{([^}]+)\}/`) stopped at the first `}` — the one closing
 * `${item?._slug ?? ''}` — and inlined the truncated expression into the managed
 * onClick, so the file no longer parsed ("Unexpected token, expected }") and the
 * page could not be edited until the handler was deleted by hand.
 */
describe('syncLinkHandlerInCode — CMS-bound href', () => {
  const cmsLink = (extra: string) =>
    `<Link data-cms-nav="row" href={\`/blog/\${item?._slug ?? ''}\`} data-id="link-1"${extra}>x</Link>`;

  it('keeps the whole template literal when Keep Params is on', () => {
    const out = syncLinkHandlerInCode(cmsLink(' data-keep-params="true"'), 'link-1');
    // the FULL expression survives — not truncated at the `${…}` brace
    expect(out).toContain("/blog/${item?._slug ?? ''}");
    // and the truncated form must not appear anywhere
    expect(out).not.toContain("`/blog/${item?._slug ?? ''`");
  });

  it('produces balanced braces (the parse failure this bug caused)', () => {
    const out = syncLinkHandlerInCode(cmsLink(' data-keep-params="true"'), 'link-1');
    const opens = (out.match(/\{/g) || []).length;
    const closes = (out.match(/\}/g) || []).length;
    expect(opens).toBe(closes);
  });

  it('still handles a plain string href', () => {
    const out = syncLinkHandlerInCode(
      `<Link href="/blog/hello" data-id="link-2" data-keep-params="true">x</Link>`, 'link-2');
    expect(out).toContain('/blog/hello');
    const opens = (out.match(/\{/g) || []).length;
    const closes = (out.match(/\}/g) || []).length;
    expect(opens).toBe(closes);
  });

  it('handles a variable-bound data-keep-params containing braces', () => {
    const out = syncLinkHandlerInCode(
      `<Link href={\`/blog/\${item?._slug ?? ''}\`} data-id="link-3" data-keep-params={cond ? 'true' : undefined}>x</Link>`,
      'link-3');
    const opens = (out.match(/\{/g) || []).length;
    const closes = (out.match(/\}/g) || []).length;
    expect(opens).toBe(closes);
  });
});
