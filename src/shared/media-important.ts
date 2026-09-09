// media-important.ts — the "!important" law for the page/component <style>
// block, shared by the oracle rule (MEDIA_DECL_MISSING_IMPORTANT) and the
// load-time heal (project-fs loadSnapshot).
//
// Every base style is an INLINE style attribute, so a banded `@media` rule or
// a `:lang()` locale rule can only beat it with `!important`. Every builder
// generator writes `prop: value !important;` (generator-styles.ts,
// locale-gen.ts). The canvas bakes band values straight onto the replica
// tiles and the panel parser strips an OPTIONAL `!important`, so a plain
// declaration LOOKS applied in the editor while the live site ignores it
// (2026-09-07: an AI-written page whose responsive font sizes, paddings and
// column flips all silently failed on the published site — only the
// `flex/width` re-base pairs, copied from a prompt example, carried it).

export interface BandDeclaration {
  /** Selector of the enclosing rule, e.g. `[data-id="hero-title"]`. */
  selector: string;
  /** Head of the enclosing @media/@container band, or '' for a top-level :lang rule. */
  band: string;
  prop: string;
  value: string;
  /** Offset of the declaration's first char inside the css string. */
  index: number;
}

/** Split a declaration block into `[start, end)` spans on `;` while respecting
 *  parentheses and quotes (`url(data:image/svg+xml;…)`, `content: ";"`). */
function declSpans(block: string, base: number): Array<[number, number]> {
  const spans: Array<[number, number]> = [];
  let depth = 0;
  let quote: string | null = null;
  let start = 0;
  for (let i = 0; i < block.length; i++) {
    const ch = block[i];
    if (quote) { if (ch === quote && block[i - 1] !== '\\') quote = null; continue; }
    if (ch === '"' || ch === "'") { quote = ch; continue; }
    if (ch === '(') depth++;
    else if (ch === ')') depth = Math.max(0, depth - 1);
    else if (ch === ';' && depth === 0) { spans.push([base + start, base + i]); start = i + 1; }
  }
  if (block.slice(start).trim()) spans.push([base + start, base + block.length]);
  return spans;
}

interface RuleSpan { selector: string; band: string; bodyStart: number; bodyEnd: number }

/** Every leaf rule (`selector { decls }`) that lives inside an @media/@container
 *  band or is a top-level `:lang(` rule. Brace-balanced walk; nested at-rules
 *  are descended, other top-level rules (pseudo/hover codegen, select caret)
 *  are skipped. */
function collectScopedRules(css: string): RuleSpan[] {
  const out: RuleSpan[] = [];
  const walk = (from: number, to: number, band: string, scoped: boolean): void => {
    let i = from;
    while (i < to) {
      const open = css.indexOf('{', i);
      if (open === -1 || open >= to) return;
      const head = css.slice(i, open).trim();
      // find the matching close
      let depth = 1;
      let j = open + 1;
      while (j < to && depth > 0) {
        if (css[j] === '{') depth++;
        else if (css[j] === '}') depth--;
        j++;
      }
      if (depth !== 0) return;
      const bodyStart = open + 1;
      const bodyEnd = j - 1;
      if (head.startsWith('@')) {
        const isBand = /^@(media|container)\b/.test(head);
        walk(bodyStart, bodyEnd, isBand ? head : band, scoped || isBand);
      } else if (css.slice(bodyStart, bodyEnd).includes('{')) {
        // nested rule block (not a leaf) — descend with the same scope
        walk(bodyStart, bodyEnd, band, scoped);
      } else if (scoped || head.startsWith(':lang(')) {
        out.push({ selector: head.replace(/\s+/g, ' '), band, bodyStart, bodyEnd });
      }
      i = j;
    }
  };
  walk(0, css.length, '', false);
  return out;
}

/** Declarations inside bands / :lang rules that lack `!important`. */
export function findBandDeclsMissingImportant(css: string): BandDeclaration[] {
  const missing: BandDeclaration[] = [];
  for (const rule of collectScopedRules(css)) {
    const body = css.slice(rule.bodyStart, rule.bodyEnd);
    for (const [s, e] of declSpans(body, rule.bodyStart)) {
      const decl = css.slice(s, e);
      const colon = decl.indexOf(':');
      if (colon === -1) continue;
      const prop = decl.slice(0, colon).trim();
      const value = decl.slice(colon + 1).trim();
      if (!prop || !value) continue;
      if (/!\s*important\s*$/i.test(value)) continue;
      missing.push({ selector: rule.selector, band: rule.band, prop, value, index: s + decl.search(/\S/) });
    }
  }
  return missing;
}

/** Append ` !important` to every band / :lang declaration that lacks it.
 *  Returns the css unchanged when nothing is missing. Idempotent. */
export function appendImportantToBandDecls(css: string): string {
  const spans: Array<[number, number, string]> = [];
  for (const rule of collectScopedRules(css)) {
    const body = css.slice(rule.bodyStart, rule.bodyEnd);
    for (const [s, e] of declSpans(body, rule.bodyStart)) {
      const decl = css.slice(s, e);
      const colon = decl.indexOf(':');
      if (colon === -1) continue;
      const prop = decl.slice(0, colon).trim();
      const value = decl.slice(colon + 1).trim();
      if (!prop || !value || /!\s*important\s*$/i.test(value)) continue;
      // keep the original whitespace before the terminator; insert right after the value
      const trailing = decl.length - decl.trimEnd().length;
      spans.push([e - trailing, e - trailing, ' !important']);
    }
  }
  if (spans.length === 0) return css;
  let out = css;
  for (const [s, , ins] of spans.sort((a, b) => b[0] - a[0])) out = out.slice(0, s) + ins + out.slice(s);
  return out;
}

const STYLE_LITERAL_RE = /(<style>\s*\{`)([\s\S]*?)(`\}\s*<\/style>)/g;

/** Apply `appendImportantToBandDecls` to every `<style>{`…`}</style>` literal of
 *  a page/component source. Literals carrying `${…}` interpolation are left
 *  alone (no writer can reach them either). */
export function healStyleBlockImportant(src: string): string {
  if (!src.includes('<style>')) return src;
  return src.replace(STYLE_LITERAL_RE, (whole, open: string, css: string, close: string) => {
    if (css.includes('${')) return whole;
    const healed = appendImportantToBandDecls(css);
    return healed === css ? whole : `${open}${healed}${close}`;
  });
}
