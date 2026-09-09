import { describe, it, expect } from 'vitest';
import { updateNodeChildrenFromHTML } from './generator-crud';

// A Google Docs paste committed block HTML (<h1>, <h2>, <p>) INSIDE a text
// node's <p> (live find 2026-09-07): invalid nesting + the node's typography
// overridden by 22pt Noto runs. The commit path flattens it.
describe('updateNodeChildrenFromHTML — block HTML is flattened', () => {
  it('turns headings/paragraphs into <br>-separated inline runs without size/family', () => {
    const code = `'use client';
export default function Page() {
  return <div data-id="root" style={{ position: 'relative' }}>
    <p data-id="t" data-name="Text" style={{ fontSize: '16px', position: 'relative' }}>old</p>
  </div>;
}`;
    const html = '<h1><span style="color: rgb(11, 83, 148); font-family: Noto Sans; font-size: 22pt; font-weight: 900">Plan</span></h1><p><br></p><h2><span style="font-size: 14pt; font-weight: 900">Sommaire</span></h2><p><span style="font-size: 12pt">1.1 La méthode</span></p>';
    const out = updateNodeChildrenFromHTML(code, 't', html);
    expect(out).not.toMatch(/<h1|<h2|<p>|fontSize: '22pt'|fontFamily/);
    expect(out).toContain('<br />');
    expect(out).toContain("color: 'rgb(11, 83, 148)'");
    expect(out).toContain('Sommaire');
    expect(out).toContain('1.1 La méthode');
  });
});
