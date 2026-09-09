import { describe, it, expect } from 'vitest';
import { transformRichTextToTranslation, nodeHasTranslationCall, nodeHasRichTranslation } from './i18n-gen';
import { parseJSXToNodes } from '../parsing/parser';
import { checkFile } from '../oracle/check-file';

const page = `'use client';
import React from 'react';
export default function Page() {
  return <div data-id="root" data-name="Page" style={{ position: 'relative' }}>
    <p data-id="t1" data-name="Text" style={{ position: 'relative', fontSize: '16px' }}>
      <strong>hello</strong> my <span style={{
        color: 'rgb(4, 79, 253)'
      }}>friend</span>
    </p>
  </div>;
}`;

describe('rich translation round trip', () => {
  const out = transformRichTextToTranslation(page, 't1', 't1', 'home');
  it('rewrites the node to the dangerouslySetInnerHTML + t.raw shape and returns the seed HTML', () => {
    expect(out.changed).toBe(true);
    expect(out.originalHtml).toBe('<strong>hello</strong> my <span style="color: rgb(4, 79, 253)">friend</span>');
    expect(out.code).toMatch(/dangerouslySetInnerHTML=\{\{\s*__html: t\.raw\("t1"\)\s*\}\}/);
    expect(out.code).toMatch(/useTranslations\(["']home["']\)/);
    expect(out.code).not.toContain('<strong>');
  });
  it('is idempotent and detected by the translation-call helpers', () => {
    const again = transformRichTextToTranslation(out.code, 't1', 't1', 'home');
    expect(again.changed).toBe(false);
    expect(nodeHasTranslationCall(out.code, 't1')).toBe(true);
    expect(nodeHasRichTranslation(out.code, 't1')).toBe(true);
    expect(nodeHasRichTranslation(page, 't1')).toBe(false);
  });
  it('parses back as a rich translation node', () => {
    const nodes = parseJSXToNodes(out.code);
    const n = nodes.get('t1')!;
    expect(n.translationKey).toBe('t1');
    expect(n.richTranslation).toBe(true);
    expect(n.hasMixedContent).toBe(true);
    expect(n.children).toEqual([]);
  });
  it('passes the oracle (no DANGEROUS_INNER_HTML / RESOLVE_TEXT_EMPTY), while arbitrary innerHTML still fails', () => {
    const codes = checkFile(out.code, { kind: 'page', path: 'app/page.client.tsx' }).map((x) => x.code);
    expect(codes).not.toContain('DANGEROUS_INNER_HTML');
    expect(codes).not.toContain('RESOLVE_TEXT_EMPTY');
    const bad = page.replace('<p data-id="t1" data-name="Text" style={{ position: \'relative\', fontSize: \'16px\' }}>', '<p data-id="t1" data-name="Text" style={{ position: \'relative\' }} dangerouslySetInnerHTML={{ __html: item.body }}>');
    expect(checkFile(bad, { kind: 'page', path: 'app/page.client.tsx' }).map((x) => x.code)).toContain('DANGEROUS_INNER_HTML');
  });
  it('resolves legacy per-run keys into the seed', () => {
    const legacy = page.replace('<strong>hello</strong> my', "<strong>{t('t1__r0')}</strong> my");
    const r = transformRichTextToTranslation(legacy, 't1', 't1', 'home', (k) => (k === 't1__r0' ? 'hello' : ''));
    expect(r.originalHtml).toContain('<strong>hello</strong> my');
  });
});
