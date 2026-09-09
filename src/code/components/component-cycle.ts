// component-cycle.ts — "would instancing component A inside file B make a
// cycle?" A master that renders an instance of itself (directly, or through
// a chain of masters) recurses forever on the canvas and on the live site;
// the parser gives up with "Failed to parse JSX" and the page goes blank
// (2026-09-08: Header dragged from the library into the Header master).

import { projectFS } from '@/code/project/project-fs';

const IMPORT_RE = /import\s+[\w$]+\s+from\s+['"]@\/(components|icons)\/([^'"]+?)(?:\.tsx)?['"]/g;

/** Master files `file` imports as instances (components/ and icons/). */
export function componentImportsOf(file: string, read: (p: string) => string | null = (p) => projectFS.readFile(p)): string[] {
  const code = read(file) ?? '';
  const out: string[] = [];
  for (const m of code.matchAll(IMPORT_RE)) out.push(`${m[1]}/${m[2]}.tsx`);
  return out;
}

/**
 * True when placing an instance of `draggedFile` inside `targetFile` would
 * make `targetFile` (transitively) render itself: the dragged master IS the
 * target, or the dragged master's import graph reaches the target.
 */
export function wouldCreateComponentCycle(
  draggedFile: string,
  targetFile: string,
  read: (p: string) => string | null = (p) => projectFS.readFile(p),
): boolean {
  if (!draggedFile || !targetFile) return false;
  if (draggedFile === targetFile) return true;
  const seen = new Set<string>([draggedFile]);
  const queue = [draggedFile];
  while (queue.length > 0) {
    const cur = queue.shift()!;
    for (const dep of componentImportsOf(cur, read)) {
      if (dep === targetFile) return true;
      if (!seen.has(dep)) { seen.add(dep); queue.push(dep); }
    }
  }
  return false;
}
