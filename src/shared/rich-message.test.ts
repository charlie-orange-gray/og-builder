import { describe, it, expect } from 'vitest';
import { sanitizeRichMessage, unwrapParagraphs, innerJsxToRichMessage, isRichHtml } from './rich-message';

describe('rich-message', () => {
  it('unwraps TipTap paragraphs', () => {
    expect(unwrapParagraphs('<p><strong>bonjour</strong> mon ami</p>')).toBe('<strong>bonjour</strong> mon ami');
    expect(unwrapParagraphs('<p>a</p><p>b</p>')).toBe('a<br>b');
    expect(unwrapParagraphs('plain')).toBe('plain');
  });
  it('keeps the editor marks and filters styles', () => {
    const out = sanitizeRichMessage('<p><strong>hello</strong> <span style="color: red; position: absolute; font-size: 14px">my</span> <a href="https://x.y" target="_blank">friend</a></p>');
    expect(out).toBe('<strong>hello</strong> <span style="color: red; font-size: 14px">my</span> <a href="https://x.y" target="_blank" rel="noopener noreferrer">friend</a>');
  });
  it('strips scripts, handlers, javascript: links and unknown tags (unwrapping text)', () => {
    const out = sanitizeRichMessage('hi <script>alert(1)</script><div onclick="x()">there</div> <a href="javascript:alert(1)">l</a><img src=x onerror=y>');
    expect(out).not.toMatch(/script|onclick|javascript|<img|<div/);
    expect(out).toContain('there');
    expect(out).toContain('<a>l</a>');
  });
  it('is idempotent', () => {
    const once = sanitizeRichMessage('<em>a</em> <span style="color:#fff">b</span>');
    expect(sanitizeRichMessage(once)).toBe(once);
  });
  it('converts inner JSX to a message', () => {
    expect(innerJsxToRichMessage(`\n      <span style={{\n        color: 'rgb(238, 19, 19)'\n      }}>one</span> two <strong>three</strong>\n    `))
      .toBe('<span style="color: rgb(238, 19, 19)">one</span> two <strong>three</strong>');
    expect(isRichHtml('a <b>b</b>')).toBe(true);
    expect(isRichHtml('plain')).toBe(false);
  });
});

import { syncRunStyles, richMessageRunStyles } from './rich-message';
describe('syncRunStyles — translations inherit the default run styles', () => {
  const def = '<span style="font-size: 58px; font-weight: 700">hello</span> my <span style="color: red">friend</span>';
  it('re-bakes styled spans by ordinal, keeps structural marks and text', () => {
    const fr = '<strong><span style="font-size: 12px">bonjour</span></strong> mon <span style="color: blue">ami</span>';
    expect(syncRunStyles(def, fr)).toBe('<strong><span style="font-size: 58px; font-weight: 700">bonjour</span></strong> mon <span style="color: red">ami</span>');
    expect(richMessageRunStyles(def)).toEqual(['font-size: 58px; font-weight: 700', 'color: red']);
  });
  it('unwraps a translation span the default no longer has', () => {
    expect(syncRunStyles('<span style="color: red">a</span>', '<span style="color: red">x</span> <span style="font-size: 9px">y</span>')).toBe('<span style="color: red">x</span> y');
  });
  it('is idempotent', () => {
    const once = syncRunStyles(def, '<span style="x: y">bonjour</span>');
    expect(syncRunStyles(def, once)).toBe(once);
  });
});


import { flattenPastedRichHtml } from './rich-message';
describe('flattenPastedRichHtml — Google Docs / block paste', () => {
  const gdoc = '<b style="font-weight:normal;" id="docs-internal-guid-1"><h1><span style="color: rgb(11, 83, 148); font-family: &quot;Noto Sans&quot;, sans-serif; font-size: 22pt; font-weight: 900; text-decoration: none;">Plan d’Assurance Qualité</span></h1><p><br></p><h2><span style="color: rgb(11, 83, 148); font-size: 14pt; font-weight: 900;">Sommaire</span></h2><p style="line-height: 1.38"><span style="color: rgb(0, 0, 0); font-family: Arial; font-size: 12pt; font-weight: 400; text-decoration: none;">1.1 La méthode</span></p><p><span style="font-style: italic; text-decoration: underline;">note</span>&nbsp;<a href="https://x.y">lien</a></p></b>';
  it('flattens blocks to <br>-separated inline runs and keeps only structural marks', () => {
    const out = flattenPastedRichHtml(gdoc);
    expect(out).not.toMatch(/<(h1|h2|p|b|div)\b/);
    expect(out).not.toMatch(/font-size|font-family|pt\b/);
    expect(out).toContain('<span style="color: rgb(11, 83, 148); font-weight: 700">Plan d’Assurance Qualité</span>');
    expect(out).toContain('</span><br><br><span style="color: rgb(11, 83, 148); font-weight: 700">Sommaire</span><br>1.1 La méthode<br>');
    expect(out).toContain('<span style="font-style: italic; text-decoration: underline">note</span> <a href="https://x.y">lien</a>');
  });
  it('is a no-op for plain text and idempotent', () => {
    expect(flattenPastedRichHtml('hello')).toBe('hello');
    const once = flattenPastedRichHtml(gdoc);
    expect(flattenPastedRichHtml(once)).toBe(once);
  });
});
