/**
 * smooth-scroll-ops.ts — project-level read/write for Smooth Scroll (Lenis).
 *
 * The active page's route picks its entry in `app/smooth-scroll.ts`; every
 * page has its own. The first write scaffolds the controller and mounts
 * `<SmoothScroll />` in the root layout. Pure map logic lives in
 * smooth-scroll-config.ts; the runtime source in smooth-scroll-gen.ts.
 */

import { trace } from '@/shared/debug-trace';
import { projectFS } from './project-fs';
import { modifyProjectFile } from './modify-file';
import { routeForPage } from './page-effects-ops';
import {
  parseSmoothScroll, serializeSmoothScroll, setSmoothScrollInMap, setSmoothScrollForRoutesInMap, removeSmoothScrollFromMap,
  ownSmoothScroll, resolveSmoothScroll, type SmoothScrollConfig,
} from './smooth-scroll-config';
import {
  ensureSmoothScrollScaffold, ensureSmoothScrollInLayout, SMOOTH_SCROLL_DATA_PATH,
} from '../generation/smooth-scroll-gen';
import { ensureLayoutFile } from '../generation/metadata-gen';

function readMap() {
  return parseSmoothScroll(projectFS.readFile(SMOOTH_SCROLL_DATA_PATH));
}

/** What the panel shows for this page: the config authored here, and the one in effect. */
export function getSmoothScrollForPage(pageFile: string): { own: SmoothScrollConfig | null; effective: SmoothScrollConfig | null; route: string } {
  const route = routeForPage(pageFile);
  const map = readMap();
  return { own: ownSmoothScroll(map, route), effective: resolveSmoothScroll(map, route), route };
}

function ensureRuntime(): void {
  ensureSmoothScrollScaffold();
  if (!projectFS.exists('app/layout.tsx')) projectFS.writeFile('app/layout.tsx', ensureLayoutFile());
  // Only touch the root layout when the mount is missing: a no-op rewrite on
  // every setting change re-rendered the whole layout chain per slider tick.
  if (!(projectFS.readFile('app/layout.tsx') ?? '').includes('<SmoothScroll')) {
    modifyProjectFile('app/layout.tsx', (code) => ensureSmoothScrollInLayout(code));
  }
}

/** Write the data module only when its content actually changes. */
function writeMap(next: (code: string) => string): void {
  const before = projectFS.readFile(SMOOTH_SCROLL_DATA_PATH) ?? '';
  if (next(before) === before) return;
  modifyProjectFile(SMOOTH_SCROLL_DATA_PATH, next);
}

/** Author the config on this page. */
export function setSmoothScrollForPage(pageFile: string, cfg: SmoothScrollConfig): void {
  ensureRuntime();
  const route = routeForPage(pageFile);
  writeMap((code) => serializeSmoothScroll(setSmoothScrollInMap(parseSmoothScroll(code), route, cfg)));
  trace.action('smooth-scroll-ops:set', { pageFile, route, enabled: cfg.enabled, intensity: cfg.intensity });
}

/** The same config on several pages, in one write (a site import: every imported page). */
export function setSmoothScrollForPages(pageFiles: string[], cfg: SmoothScrollConfig): void {
  if (!pageFiles.length) return;
  ensureRuntime();
  const routes = [...new Set(pageFiles.map(routeForPage))];
  writeMap((code) => serializeSmoothScroll(setSmoothScrollForRoutesInMap(parseSmoothScroll(code), routes, cfg)));
  trace.action('smooth-scroll-ops:set-pages', { routes: routes.length, intensity: cfg.intensity });
}

/** Remove this page's config (the page scrolls natively). */
export function removeSmoothScrollForPage(pageFile: string): void {
  if (!projectFS.exists(SMOOTH_SCROLL_DATA_PATH)) return;
  const route = routeForPage(pageFile);
  modifyProjectFile(SMOOTH_SCROLL_DATA_PATH, (code) => serializeSmoothScroll(removeSmoothScrollFromMap(parseSmoothScroll(code), route)));
  trace.action('smooth-scroll-ops:remove', { pageFile, route });
}

export { readMap as readSmoothScrollMap };
