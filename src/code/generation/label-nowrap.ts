// label-nowrap.ts — one-line labels never wrap.
//
// A button / pill label is one line by definition, and the builder's Fit
// sizing is `min-content`: a Fit parent measures a WRAPPABLE text by its
// longest word, so a hugging row of buttons overflowed its parent and a
// narrowed Load More stacked "Load / More" (2026-09-08). Generated label
// texts carry `whiteSpace: 'nowrap'`; this heal adds it in place to masters
// generated before that, keeping every other style the user set.

/** Add `whiteSpace: 'nowrap'` to the inline style object of the element with
 *  `data-id="<dataId>"` when it declares no whiteSpace at all. Idempotent;
 *  untouched when the element or its style object is missing. */
export function ensureTextNodeNowrap(code: string, dataId: string): string {
  const tag = code.indexOf(`data-id="${dataId}"`);
  if (tag === -1) return code;
  const tagEnd = code.indexOf('>', tag);
  const styleStart = code.indexOf('style={{', tag);
  if (styleStart === -1 || (tagEnd !== -1 && styleStart > tagEnd)) return code;
  const styleEnd = code.indexOf('}}', styleStart);
  if (styleEnd === -1) return code;
  const body = code.slice(styleStart, styleEnd);
  if (/\bwhiteSpace\s*:/.test(body)) return code;
  const insertAt = styleStart + 'style={{'.length;
  return code.slice(0, insertAt) + "\n        whiteSpace: 'nowrap'," + code.slice(insertAt);
}
