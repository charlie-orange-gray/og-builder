/**
 * form-fields.ts — the fields the form's "+" adds (Text / Checkbox / Radio /
 * Select).
 *
 * Each field is real HTML: a `<label>` wrapping its control (clicking the text
 * toggles a checkbox or radio natively), controls NAMED for the submission and
 * styled inline, and the control STATES as rules in the page's style block:
 * `[data-id]:checked` (Checked) and `[data-id]:focus` (Focus), the rows the
 * Styles tool edits. Checkbox and radio draw themselves (`appearance: none`),
 * so their box, fill, border and check icon are all editable like any frame.
 *
 * Pure: returns the `addNode` subtree plus the state rules to write after it.
 */

import { generateNodeId } from '@/shared/id-utils';

export type FormFieldKind = 'text' | 'checkbox' | 'radio' | 'select';

export interface FieldNode {
  id: string;
  type: string;
  name?: string;
  styles: Record<string, string>;
  attrs?: Record<string, string>;
  textContent?: string;
  children?: FieldNode[];
}

export interface FieldStateRule {
  nodeId: string;
  pseudo: 'checked' | 'focus';
  styles: Record<string, string>;
}

export interface BuiltFormField {
  node: FieldNode;
  rules: FieldStateRule[];
}

const ACCENT = '#0099ff';
const FIELD_FILL = 'rgba(187, 187, 187, 0.15)';
const LABEL_TEXT: Record<string, string> = { position: 'relative', fontSize: '14px', lineHeight: '1.4', color: '#888888' };

/** A check mark as a data URI in `color` — the Checked state's Icon. */
export function checkIconUri(color: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><path d="M4 8.2 6.6 10.8 12 5.4" fill="none" stroke="${color}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

/** The check icon's colour, read back from a Checked rule's background-image (null = no icon). */
export function readCheckIconColor(backgroundImage: string | undefined): string | null {
  if (!backgroundImage || !backgroundImage.includes('data:image/svg+xml')) return null;
  let decoded = backgroundImage;
  try { decoded = decodeURIComponent(backgroundImage); } catch { /* already plain */ }
  return /stroke=(?:\\)?["']([^"'\\]+)/.exec(decoded)?.[1] ?? null;
}

/** The Checked state's icon declarations (checkbox). */
export function checkIconStyles(color: string): Record<string, string> {
  return {
    backgroundImage: checkIconUri(color),
    backgroundSize: '100% 100%',
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat',
  };
}

const id = (prefix: string) => generateNodeId(prefix);

/** A control drawn by its own styles (no browser chrome). */
function booleanBox(radius: string): Record<string, string> {
  return {
    appearance: 'none',
    position: 'relative',
    width: '16px',
    height: '16px',
    marginTop: '0px',
    marginRight: '0px',
    marginBottom: '0px',
    marginLeft: '0px',
    flex: '0 0 auto',
    backgroundColor: FIELD_FILL,
    borderTopLeftRadius: radius,
    borderTopRightRadius: radius,
    borderBottomRightRadius: radius,
    borderBottomLeftRadius: radius,
    borderTopWidth: '1px',
    borderRightWidth: '1px',
    borderBottomWidth: '1px',
    borderLeftWidth: '1px',
    borderStyle: 'solid',
    borderColor: 'rgba(136, 136, 136, 0.2)',
    cursor: 'pointer',
  };
}

function fieldInput(): Record<string, string> {
  return {
    position: 'relative',
    width: '100%',
    height: '40px',
    paddingTop: '0px',
    paddingRight: '12px',
    paddingBottom: '0px',
    paddingLeft: '12px',
    backgroundColor: FIELD_FILL,
    borderTopLeftRadius: '8px',
    borderTopRightRadius: '8px',
    borderBottomRightRadius: '8px',
    borderBottomLeftRadius: '8px',
    borderTopWidth: '1px',
    borderRightWidth: '1px',
    borderBottomWidth: '1px',
    borderLeftWidth: '1px',
    borderStyle: 'solid',
    borderColor: 'rgba(136, 136, 136, 0.2)',
    fontSize: '14px',
    color: 'inherit',
    outline: 'none',
  };
}

function labelColumn(): Record<string, string> {
  return { position: 'relative', display: 'flex', flexDirection: 'column', rowGap: '6px', columnGap: '6px', width: '100%' };
}

/** Focus: an accent border — the default for every control. */
const FOCUS_STYLES: Record<string, string> = { borderColor: ACCENT };

export function buildFormField(kind: FormFieldKind): BuiltFormField {
  if (kind === 'checkbox') {
    const inputId = id('checkbox');
    return {
      node: {
        id: id('label'), type: 'label', name: 'Label',
        styles: { position: 'relative', display: 'flex', flexDirection: 'row', alignItems: 'center', rowGap: '8px', columnGap: '8px', cursor: 'pointer' },
        children: [
          { id: inputId, type: 'input', name: 'Checkbox', styles: booleanBox('4px'), attrs: { type: 'checkbox', name: 'Newsletter' } },
          { id: id('text'), type: 'p', name: 'Text', styles: { ...LABEL_TEXT }, textContent: 'Subscribe to Newsletter' },
        ],
      },
      rules: [
        { nodeId: inputId, pseudo: 'checked', styles: { backgroundColor: ACCENT, borderColor: ACCENT, ...checkIconStyles('#ffffff') } },
        { nodeId: inputId, pseudo: 'focus', styles: { ...FOCUS_STYLES } },
      ],
    };
  }
  if (kind === 'radio') {
    const rules: FieldStateRule[] = [];
    const options = ['Option 1', 'Option 2', 'Option 3'].map((label, i) => {
      const inputId = id('radio');
      rules.push({ nodeId: inputId, pseudo: 'checked', styles: { backgroundColor: '#ffffff', borderColor: ACCENT, borderWidth: '5px' } });
      rules.push({ nodeId: inputId, pseudo: 'focus', styles: { ...FOCUS_STYLES } });
      return {
        id: id('label'), type: 'label', name: 'Label',
        styles: { position: 'relative', display: 'flex', flexDirection: 'row', alignItems: 'center', rowGap: '8px', columnGap: '8px', cursor: 'pointer' },
        children: [
          { id: inputId, type: 'input', name: 'Radio', styles: booleanBox('50%'), attrs: { type: 'radio', name: 'Radio', value: label, ...(i === 0 ? { checked: 'true' } : {}) } },
          { id: id('text'), type: 'p', name: 'Text', styles: { ...LABEL_TEXT }, textContent: label },
        ],
      } as FieldNode;
    });
    return {
      node: {
        id: id('radio-group'), type: 'div', name: 'Radio Group',
        styles: { position: 'relative', display: 'flex', flexDirection: 'column', rowGap: '8px', columnGap: '8px', width: '100%' },
        children: [{ id: id('text'), type: 'p', name: 'Text', styles: { ...LABEL_TEXT }, textContent: 'Radio' }, ...options],
      },
      rules,
    };
  }
  if (kind === 'select') {
    const selectId = id('select');
    return {
      node: {
        id: id('label'), type: 'label', name: 'Label', styles: labelColumn(),
        children: [
          { id: id('text'), type: 'p', name: 'Text', styles: { ...LABEL_TEXT }, textContent: 'Select' },
          {
            id: selectId, type: 'select', name: 'Select', styles: fieldInput(), attrs: { name: 'Select' },
            children: [
              { id: id('option'), type: 'option', styles: {}, attrs: { value: '', disabled: 'true', selected: 'true' }, textContent: 'Select…' },
              { id: id('option'), type: 'option', styles: {}, attrs: { value: 'Option 1' }, textContent: 'Option 1' },
              { id: id('option'), type: 'option', styles: {}, attrs: { value: 'Option 2' }, textContent: 'Option 2' },
            ],
          },
        ],
      },
      rules: [{ nodeId: selectId, pseudo: 'focus', styles: { ...FOCUS_STYLES } }],
    };
  }
  const inputId = id('input');
  return {
    node: {
      id: id('label'), type: 'label', name: 'Label', styles: labelColumn(),
      children: [
        { id: id('text'), type: 'p', name: 'Text', styles: { ...LABEL_TEXT }, textContent: 'Name' },
        { id: inputId, type: 'input', name: 'Input', styles: fieldInput(), attrs: { type: 'text', name: 'Name', placeholder: 'Jane Smith' } },
      ],
    },
    rules: [{ nodeId: inputId, pseudo: 'focus', styles: { ...FOCUS_STYLES } }],
  };
}
