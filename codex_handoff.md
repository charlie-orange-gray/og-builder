# OG Builder / Revyme Fork

## Purpose

Orange & Gray is adapting Revyme into a self-hosted visual website platform. The intended platform provides server-backed project persistence, staging deployments, Git-backed version control, versioned Docker images, production promotion, and rollback.

The authoritative long-term platform design is [CHAZ-Architecture.md](./CHAZ-Architecture.md). This file is the concise current-state engineering handoff and should not duplicate that specification.

## Upstream Repository

https://github.com/revyme-web/builder.git

`upstream/main` remains the source for Revyme improvements. It should be integrated regularly through a dedicated sync branch rather than merged directly into an active feature branch.

## Fork Repository

https://github.com/charlie-orange-gray/og-builder.git

## Fork Philosophy

- Prefer adapters over rewrites.
- Prefer capability flags over cloud-specific assumptions.
- Keep persistence, publishing, deployment, and credentials in separate backend services.
- Keep Orange & Gray changes small and isolated in feature branches.
- Avoid modifying upstream-owned canvas, parser, runtime, responsive-layout, mutation, code-generation, and CMS internals unless necessary.

## Current Architecture

Stable `origin/main` exposes the publishing capability `PUBLISH_ENABLED` from `src/shared/publish-flag.ts`. Revyme Cloud enables it through `CLOUD_ENABLED`; self-hosted publishing enables it with the exact environment value `VITE_SELF_HOSTED_PUBLISH=true` without enabling cloud services. The upstream publish preflight remains intact.

In self-hosted development, same-origin `/api/*` requests are proxied by Vite to `VITE_API_URL`. Production should route `/api/*` to the control-plane service at the reverse proxy. The current editor seam expects `/api/websites/:id` and `/api/websites/:id/publish`; the control plane is intentionally not part of this repository.

The Phase 1 branch selects persistence once through `backendCapabilities`: Cloud → `RevymeBackend`; exact `VITE_SELF_HOSTED_PERSISTENCE=true` → `SelfHostedBackend`; otherwise → `LocalBackend`. Publishing and persistence are independent. The new adapter stores full editable `ProjectData` through the separate `/Users/chaz/og-control-plane` service. PostgreSQL owns identity, permissions, revision metadata, and idempotency receipts; durable immutable snapshot files contain project contents/settings. Browser project localStorage is not the self-hosted source of truth.

Git publishing and Docker remain unimplemented. Their required order is still frozen server revision → complete generated site/design assets → Git commit/push → exact SHA/image → staging health check → approved production promotion. Runtime uploads must remain outside disposable containers.

The ignored `.env.local` still contains the original Publish flag and API URL; it was not silently switched to persistence. See [SELF_HOSTED_PERSISTENCE.md](./SELF_HOSTED_PERSISTENCE.md) for explicit proof commands with publishing disabled. Both repositories pin Node `22.23.2`.

## Current Branch

`feature/self-hosted-project-persistence`, created from stable `origin/main` at `84181a3`.

## Completed Work

1. Added the self-hosted publishing capability seam and wired publish metadata, publish actions, and the Live control to that capability while preserving cloud-only feature gates.
2. Added the self-hosted Vite API proxy and environment documentation.
3. Added `.nvmrc` for Node `22.23.2`.
4. Repaired the upstream lockfile with the missing nested `@swc/helpers@0.5.23` entry while avoiding unrelated platform metadata churn.
5. Added capability-flag tests and validated the editor, sandbox, and preview builds.
6. Completed Phase 0 through normal merge commits for PRs #1 and #2, preserving published feature history.
7. Implemented the local Phase 1 persistence proof: project create/list/load/rename/autosave, revision conflicts, idempotent retries, load-failure protection, read-only access, and downloadable conflict recovery.
8. Added PostgreSQL migrations, atomic compressed snapshot storage, API/session boundaries, real database tests, and an independent-browser editor proof.
9. Added Phase 2 content-addressed design assets, exact frozen revisions, embedded-data-URL migration at freeze time, and deterministic website-tree materialization in the control plane.

## Current Work

PR #1 merged with a normal merge commit as `11e43f6` after explicit user approval and exact-head verification. `origin/main` contains upstream `e7b5b9f`, the required lockfile correction, and both architecture documents. A fresh upstream fetch found no newer commit.

The synchronized main is merged into the Publish feature. Only `codex_handoff.md` had an add/add conflict; this latest handoff is preserved. `RightHeader.tsx` auto-merged and retains the capability guard, mutation flush, upstream preflight and blocking feedback, autosave flush, then publish request.

Feature validation passed fresh `npm ci`, TypeScript, all three builds, diff checks against `origin/main`, and scoped ESLint (zero errors; 29 existing warnings across RightHeader and Vite). The initial full test run had one failure in the unchanged 30 ms mounting test in `sandbox-code-host.test.ts`; isolated rerun passed all 17 tests. A complete confirmation run with `--maxWorkers=4` passed all 654 files: 10,307 passed, 1 skipped, 3 todo. No test or runtime code was changed for that failure. Logs: `/private/tmp/og-phase0-tests.log`, `/private/tmp/og-phase0-confirm-tests.log`, and `/private/tmp/og-phase0-build.log`.

Phase 0 is complete. [PR #2](https://github.com/charlie-orange-gray/og-builder/pull/2) merged with a normal merge commit as `84181a3` after successful confirmation validation and mergeability verification. `origin/main` contains both the latest validated upstream baseline (`e7b5b9f`) and the Publish capability feature (`74a3981`). Published feature history was not rebased. A fresh fetch at the start of persistence work found no newer upstream commit.

Phase 1 and the first Phase 2 asset/materialization proof are implemented and validated on `feature/self-hosted-project-persistence`; this branch has not been merged into stable main. `/Users/chaz/og-control-plane` is a separate local Git repository with no remote configured. These changes are kept local for review; no new website repository, Git publishing pipeline, Docker operation, or Debian deployment was performed.

Local implementation commits: editor adapter `795c2c5`; control-plane initial commit `f327b9a`. Phase 0 completion was recorded separately as `7e8ea40`. The final fetch reports `origin/main=84181a3` and `upstream/main=3ef52b6`.

Phase 2 commits are `3e8e2b3` and `7f700f1` in the builder and `1ae553c` in the control plane. The control-plane repository has no remote configured. Publishing the builder feature branch and opening its PR was requested, but the current environment rejected the external push because the available publication approval was scoped to the earlier Phase 0 integration; no Phase 1/2 source was pushed.

After Phase 2 work began, upstream advanced from `e7b5b9f` to `3ef52b6` through four upstream commits. The isolated `chore/sync-upstream-2026-09-10` branch was created from `origin/main` and merged upstream as `7f5d31f` with no textual conflicts. Its upstream-only validation passed TypeScript, all three builds, 671 test files (10,449 passed, 1 skipped, 3 todo), and `git diff --check`. The upstream overlap is broad and upstream-owned, including `ProjectLoader.tsx`, canvas, parser, mutation, generator, and CMS files; it was not merged into this feature branch.

The API implements `POST/GET /api/projects`, `GET/PUT/PATCH /api/projects/:projectId`, project-scoped asset register/list/metadata/bytes routes, `POST /api/projects/:projectId/frozen-revisions`, `POST /api/frozen-revisions/:id/materialize`, `POST /api/dev/session`, `GET /api/session`, `/healthz`, and `/readyz`. Its SQL migrations create users, workspaces, workspace memberships, projects, immutable project snapshots, content-addressed project assets, frozen revisions/manifests, audit events, sessions, and save receipts. Migration replay is checksummed and serialized.

Saves send a base revision, matching `If-Match`, and an idempotency key. Stale saves return 409, pause autosave, and preserve the local copy. Files are written/fsynced/renamed before database references commit. Settings survive load/save/recovery. Snapshot compression is gzip using stable Node 22 support; the actual architecture decision is recorded in `CHAZ-Architecture.md`. No protected canvas/parser/runtime/mutation/generator/CMS internals were changed.

The local browser proof uses real PostgreSQL 18.4 and durable data in the service's ignored `.data/phase1-proof-v1`. It creates a project through the UI, draws through actual pointer/keyboard input, closes the first browser context, reloads in a fresh context, edits/saves again, and reloads both frames. Further cases prove failed-load blocking and stale-browser recovery without overwriting the newer server revision. The control-plane integration suite now also proves asset deduplication/byte retrieval, stale freeze rejection, embedded SVG data-URL migration, and two independent materializations with identical manifest/file contents. No product workaround was used.

Final proof project: `d71de69c-e859-4498-bb2d-1cf6131927c8`, revision 1 → 2 across independent browser contexts. The retained JSON report is `test-results/persistence-report.json`; the screenshot shows both frames reloaded with acknowledged Saved status.

Next recommended action: review the two local repositories and publish the combined Phase 1/2 PR only after approval. The next implementation dependency is a minimal Publish API that references a frozen revision, before any site Git repository or Docker work. Production authentication, database backup/restore, Debian access/configuration, and deployment operations remain unvalidated.

## Next Planned Milestones

1. Self-hosted publishing capability seam — complete on stable main
2. Self-hosted project persistence backend — local proof complete; review pending
3. Content-addressed design asset storage and frozen materialization — local proof complete; review pending
4. Minimal publish API
5. Git staging deployment
6. Docker staging deployment
7. Production promotion
8. Deployment history and rollback
9. Authentication
10. Workspaces and user roles
11. Agency hardening
12. Optional CMS/analytics/A-B/AI/MCP integrations

## Deployment Architecture

```text
Revyme visual editor
    ↓
Orange & Gray API/control plane
    ↓
server project snapshot
    ↓
Git staging branch
    ↓
versioned Docker image
    ↓
staging URL
    ↓
approval
    ↓
exact same Git revision / Docker image
    ↓
main / production
    ↓
production URL
```

Production must promote the exact tested staging revision and image rather than regenerate from a newer draft.

## Repository Responsibilities

`og-builder` is the visual editor fork only.

`og-control-plane` owns implemented persistence/session boundaries and will own the publishing API. Privileged deployment jobs must remain in a separate worker/process.

Each individual website repository owns generated Next.js website source and its history.

## Storage Strategy

- Self-hosted editor autosaves now go to the server; standalone and Cloud keep their existing providers.
- Full immutable snapshots use canonical SHA-256 identity and `.json.gz` storage. New uploads use project-scoped content-addressed asset objects; eligible legacy data URLs migrate when a revision is frozen.
- Frozen revisions point to the exact snapshot ID/revision and an immutable asset manifest. Materialization rewrites only the isolated output tree, never the mutable editor snapshot.
- Runtime uploads must not depend on a container writable layer.
- Persistent uploads should use server storage or bind mounts.
- Static design assets may be baked into versioned site builds.
- External CDN/object storage can be added later but is not required initially.

## Upstream Sync Procedure

1. Inspect `git status`, the current branch, and both remotes.
2. Run `git fetch upstream --prune` and `git fetch origin --prune`.
3. Compare `origin/main` and `upstream/main` for ahead/behind counts, changed files, and overlap with Orange & Gray files.
4. Do not merge `upstream/main` directly into an active feature branch.
5. If syncing is needed, create `chore/sync-upstream-YYYY-MM-DD` and merge `upstream/main` there.
6. Resolve conflicts conservatively, preferring upstream behavior while preserving capability seams.
7. Before recommending the sync, run `npm ci`, `npx tsc --noEmit`, `npm run test:run`, `npm run build:all`, `git diff --check`, and scoped ESLint on changed TypeScript/TSX files.
8. Do not merge or push sync changes without approval.

## Known Upstream Issues

- The upstream `package-lock.json` was missing `@swc/helpers@0.5.23`; the fork carries only the minimal nested lockfile correction.
- Full-repository lint currently contains unrelated existing failures. Do not call these regressions from Orange & Gray changes unless changed files introduce new failures.
- The Phase 0 `RightHeader.tsx` overlap integrated cleanly. The handoff add/add conflict was resolved using the latest correct state; no conflict remains.
- A baseline 30 ms sandbox mounting test flaked in the first Phase 0 full run, then passed isolated and full confirmation runs. No protected runtime/test code was changed to mask it.

## Validation Checklist

```text
npm ci
npx tsc --noEmit
npm run test:run
npm run build:all
git diff --check
```

Phase 1 validation on 2026-09-09:

- Editor: fresh `npm ci`, TypeScript, all three builds, and diff checks passed. Full `npm run test:run -- --maxWorkers=4`: 658 files, 10,342 passed, 1 skipped, 3 todo. Scoped ESLint: zero errors, 42 existing warnings in touched upstream files; new modules/tests clean.
- Editor: fresh `npm ci`, TypeScript, all three builds, and diff checks passed. Full `npm run test:run -- --maxWorkers=4`: 659 files, 10,343 passed, 1 skipped, 3 todo. The added self-hosted asset-client test passed. Scoped ESLint on changed client files: zero errors and no rule findings; the normal module-type notice remains.
- Service: fresh `npm ci` (zero reported vulnerabilities), TypeScript, build, 21 tests against real PostgreSQL, and whitespace checks passed. Tests include concurrency, dedupe, receipt replay, storage failures/corruption, authorization, frozen revision idempotency/immutability, asset dedupe/byte retrieval, embedded data-URL migration, and two repeated materializations with matching manifests.
- Browser: `npm run test:persistence` passed all three real-editor cases against the migrated service schema. Evidence and screenshots are under ignored `test-results/`; logs are `/private/tmp/og-phase2-browser.log`. Editor test/build logs are `/private/tmp/og-phase1-tests.log` and `/private/tmp/og-phase1-build.log`.
- Existing warnings: media/canvas test stubs, SDK sourcemaps, dynamic imports, large build chunks, and Node's ESLint module-type notice. Browser runs also show the existing layout-no-children bootstrap trace; the deliberate missing-project case logs its expected 404. No unresolved validation failure remains.
- The service pins its dependency graph and uses `.npmrc` `legacy-peer-deps=true` to work around npm 10's optional-peer resolver crash. This disables all peer resolution; the installed runtime graph is explicitly pinned and tested.

## Important Decisions

- Self-hosted publishing is a capability, not a cloud-mode switch, so local editing and cloud-only services remain independent.
- Git and Docker credentials must never be exposed to the browser.
- Docker deployment belongs in a separate worker or service.
- Git should represent meaningful deployment snapshots, not every visual editor mutation.
- Production promotes an approved staging revision and the exact tested image.
- Upstream compatibility is a first-class requirement.
- Development sessions are local-proof only. The server checks identity, workspace role and allowed Origin, and rejects development bypass/sessions in production. Do not expose this service publicly before real authentication and operational hardening.
- Asset logical paths are allowlisted under `public/uploads`; server object paths use hashes and never use browser filenames. Materialization output is temporary and has no Git, Docker, shell, or runtime-upload authority.

## Last Updated

2026-09-10
