/**
 * Make the ids inside an imported graphic's markup unique per rendered copy.
 *
 * SVG ids are DOCUMENT-scoped, not per-`<svg>`. The same icon renders once per
 * viewport tile (and again for every instance on the page), so every copy ships
 * the same exporter-generated ids — `_clip2`, `_Image1`, … — and `url(#_clip2)`
 * resolves to whichever copy comes FIRST in the document.
 *
 * That is harmless while all copies are visible (they're identical), but culling
 * puts offscreen tiles under `display:none`. A display:none element is still in
 * the document, so it still WINS the id lookup — while a clipPath inside it
 * resolves to nothing. The surviving copies then paint their `<use>`/image
 * content unclipped, i.e. as solid black rectangles, and it comes and goes as
 * zoom changes which tiles are culled.
 *
 * Suffixing each copy's ids (and the references to them) keeps every copy
 * self-contained, so one being hidden can't corrupt the others.
 */

const ESCAPE_RE = /[.*+?^${}()|[\]\\]/g;

/** Ids DEFINED in this markup; references to anything else are left alone. */
function definedIds(markup: string): string[] {
  const ids = new Set<string>();
  const re = /\sid\s*=\s*"([^"]+)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(markup)) !== null) ids.add(m[1]);
  return [...ids];
}

export function scopeSvgMarkupIds(markup: string, scope: string): string {
  if (!markup || !scope) return markup;
  let out = markup;
  for (const id of definedIds(markup)) {
    const esc = id.replace(ESCAPE_RE, '\\$&');
    const next = `${id}-${scope}`;
    // The definition itself.
    out = out.replace(new RegExp(`(\\sid\\s*=\\s*")${esc}(")`, 'g'), `$1${next}$2`);
    // url(#id) — attribute values and inline CSS, quoted or bare.
    out = out.replace(new RegExp(`(url\\(\\s*["']?#)${esc}(["']?\\s*\\))`, 'g'), `$1${next}$2`);
    // href="#id" / xlink:href / the JSX-cased xlinkHref the icon pipeline emits.
    out = out.replace(
      new RegExp(`((?:\\sxlink:href|\\sxlinkHref|\\shref)\\s*=\\s*")#${esc}(")`, 'g'),
      `$1#${next}$2`,
    );
  }
  return out;
}

let seq = 0;
/** Stable per-ELEMENT scope token (each viewport tile gets its own element). */
export function elementSvgScope(el: Element): string {
  const holder = el as Element & { __svgIdScope?: string };
  if (!holder.__svgIdScope) holder.__svgIdScope = `s${++seq}`;
  return holder.__svgIdScope;
}
