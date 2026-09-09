import { describe, it, expect } from 'vitest';
import { buildTranslationTextOverrides } from './locale-override-map';

describe('buildTranslationTextOverrides — rich translation', () => {
  it('paints the HTML message through innerJsx, falling back to the default locale', () => {
    const nodes = new Map<string, any>([
      ['greet', { id: 'greet', type: 'p', translationKey: 'greet', richTranslation: true, hasMixedContent: true, textContent: '', children: [], styles: {} }],
      ['plain', { id: 'plain', type: 'p', translationKey: 'plain', textContent: '', children: [], styles: {} }],
    ]);
    const out = buildTranslationTextOverrides({
      nodes, namespace: 'home',
      activeMessagesRaw: JSON.stringify({ home: { plain: 'Bonjour' } }),
      defaultMessagesRaw: JSON.stringify({ home: { greet: '<strong>hello</strong> my friend', plain: 'Hello' } }),
    });
    expect(out.get('greet')).toEqual({ innerJsx: '<strong>hello</strong> my friend' });
    expect(out.get('plain')).toEqual({ text: 'Bonjour' });
  });
});
