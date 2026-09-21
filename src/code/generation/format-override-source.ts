// format-override-source.ts — readable source for imported code override files.
//
// Imported override files come out of a bundler: whole functions land on one
// line (`export function withX(Component){return forwardRef((props,ref)=>{…`).
// The Library's Code Overrides rows open these files for editing, so the
// import re-prints them with Babel's generator (comments kept). Falls back to
// the original text when it doesn't parse.

import { parse } from '@babel/parser';
import generate from '@babel/generator';
import { trace } from '@/shared/debug-trace';

export function formatOverrideSource(source: string): string {
  try {
    const ast = parse(source, { sourceType: 'module', plugins: ['jsx', 'typescript'] });
    const gen = (generate as unknown as { default?: typeof generate }).default ?? generate;
    const { code } = gen(ast, { comments: true, retainLines: false, jsescOption: { minimal: true } }, source);
    return code.endsWith('\n') ? code : code + '\n';
  } catch (err) {
    trace.error('format-override-source:failed', err);
    return source;
  }
}
