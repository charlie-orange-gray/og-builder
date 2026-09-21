import { describe, it, expect } from 'vitest';
import { formatOverrideSource } from './format-override-source';

describe('formatOverrideSource', () => {
  it('re-prints a bundled one-liner over several lines, keeping comments', () => {
    const src = `import{forwardRef}from"react";// keep me
export function withX(Component){return forwardRef((props,ref)=>{const a=1;return <Component ref={ref} {...props} style={{...props.style,height:a}}/>})}`;
    const out = formatOverrideSource(src);
    expect(out.split('\n').length).toBeGreaterThan(5);
    expect(out).toContain('// keep me');
    expect(out).toContain('export function withX(Component)');
  });

  it('returns the input when it does not parse', () => {
    expect(formatOverrideSource('export function (')).toBe('export function (');
  });
});
