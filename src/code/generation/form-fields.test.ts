import { describe, it, expect } from 'vitest';
import { buildFormField, checkIconUri, readCheckIconColor, type FormFieldKind } from './form-fields';
import { addNodeInCode } from './generator-crud';
import { updatePseudoStyleInCode, removePseudoStyleInCode } from './generator-styles';
import { parsePseudoRules } from '@/code/parsing/pseudo-parser';
import { parseJSX } from '@/code/parsing/ast-utils';
import { checkFile } from '@/code/oracle/check-file';

const PAGE = `'use client';
import React from 'react';

export default function Page() {
  return (
    <div data-id="root" data-name="Page" style={{ position: 'relative', display: 'flex', flexDirection: 'column' }}>
      <style>{\`\`}</style>
      <form data-id="form-1" data-name="Form" data-form='{"sendTo":[{"id":"d1","type":"email","recipient":"a@b.com"}]}' onSubmit={async (e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); const fields = Object.fromEntries(fd.entries()); await fetch("/api/form", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ formId: "form-1", fields }) }); }} style={{ position: 'relative', display: 'flex', flexDirection: 'column', rowGap: '12px', columnGap: '12px' }}>
        <button data-id="btn-1" data-name="Submit" type="submit" style={{ position: 'relative' }}>Send</button>
      </form>
    </div>
  );
}
`;

const insert = (kind: FormFieldKind) => {
  const built = buildFormField(kind);
  let code = addNodeInCode(PAGE, 'form-1', built.node as any, 0);
  for (const r of built.rules) code = updatePseudoStyleInCode(code, r.nodeId, r.pseudo, r.styles);
  return { code, built };
};

describe('form fields (the form\'s "+")', () => {
  for (const kind of ['text', 'checkbox', 'radio', 'select'] as FormFieldKind[]) {
    it(`${kind}: inserts real, parseable form markup the oracle accepts`, () => {
      const { code, built } = insert(kind);
      expect(() => parseJSX(code)).not.toThrow();
      const blocking = checkFile(code, { kind: 'page' }).filter((v) => v.tier >= 2
        && /ELEMENT_UNSUPPORTED_TAG|RAW_STYLE_TAG|STYLE_PROP_NO_CONTROL|FORM_|STYLE_SHORTHAND/.test(v.code));
      expect(blocking).toEqual([]);
      expect(code.indexOf(built.node.id)).toBeLessThan(code.indexOf('data-id="btn-1"'));
    });
  }

  it('checkbox: a label wrapping a self-drawn box, with Checked and Focus state rules', () => {
    const { code, built } = insert('checkbox');
    const inputId = built.rules[0].nodeId;
    expect(code).toMatch(new RegExp(`<label data-id="${built.node.id}"[\\s\\S]*<input data-id="${inputId}"[^>]*type="checkbox"[^>]*name="Newsletter"`));
    expect(code).toContain("appearance: 'none'");
    const rules = parsePseudoRules(code).get(inputId)!;
    expect(rules.checked?.backgroundColor).toBe('#0099ff');
    expect(readCheckIconColor(rules.checked?.backgroundImage)).toBe('#ffffff');
    expect(rules.focus?.borderColor).toBe('#0099ff');
    expect(code).toContain(`[data-id="${inputId}"]:checked {`);
    expect(code).toContain(`[data-id="${inputId}"]:focus {`);
  });

  it('radio: a group of three labelled radios sharing a name, the first checked', () => {
    const { code, built } = insert('radio');
    expect((code.match(/type="radio" name="Radio"/g) ?? []).length).toBe(3);
    expect((code.match(/checked="true"/g) ?? []).length).toBe(1);
    expect(built.node.name).toBe('Radio Group');
    const radioId = built.rules[0].nodeId;
    expect(parsePseudoRules(code).get(radioId)?.checked).toMatchObject({ backgroundColor: '#ffffff', borderColor: '#0099ff', borderWidth: '5px' });
  });

  it('removing a state rule leaves the other', () => {
    const { code, built } = insert('checkbox');
    const inputId = built.rules[0].nodeId;
    const after = removePseudoStyleInCode(code, inputId, 'checked');
    const rules = parsePseudoRules(after).get(inputId)!;
    expect(rules.checked).toBeUndefined();
    expect(rules.focus?.borderColor).toBe('#0099ff');
  });

  it('the check icon colour round-trips', () => {
    expect(readCheckIconColor(checkIconUri('#123abc'))).toBe('#123abc');
    expect(readCheckIconColor(checkIconUri('rgb(255, 255, 255)'))).toBe('rgb(255, 255, 255)');
    expect(readCheckIconColor('none')).toBeNull();
  });
});
