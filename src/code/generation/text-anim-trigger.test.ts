import { describe, it, expect } from 'vitest';
import { buildSplitTextSpecSource } from './text-anim-gen';

describe('text effect triggers (On Appear / Layer in View / Section in View)', () => {
  it('serialises the trigger and its options into the runtime spec', () => {
    expect(buildSplitTextSpecSource({ animationType: 'word', trigger: 'appear' })).toContain('trigger: "appear"');
    const layer = buildSplitTextSpecSource({ animationType: 'word', trigger: 'view', viewport: 'middle', replay: true });
    expect(layer).not.toContain('trigger:');
    expect(layer).toContain('viewport: "middle"');
    expect(layer).toContain('replay: true');
    const section = buildSplitTextSpecSource({ animationType: 'character', trigger: 'section', sectionId: 'hero', viewport: 'top', replay: false });
    expect(section).toContain('trigger: "section"');
    expect(section).toContain('sectionId: "hero"');
    expect(section).toContain('viewport: "top"');
    expect(section).toContain('replay: false');
  });
});
