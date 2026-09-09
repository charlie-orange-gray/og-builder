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

On `feature/self-hosted-publish-ui`, the editor exposes one publishing capability, `PUBLISH_ENABLED`, from `src/shared/publish-flag.ts`. Revyme Cloud enables it through `CLOUD_ENABLED`; standalone self-hosted publishing enables it with the exact environment value `VITE_SELF_HOSTED_PUBLISH=true` without enabling cloud authentication, billing, marketplace, collaboration, cloud persistence, or hosted services.

In self-hosted development, same-origin `/api/*` requests are proxied by Vite to `VITE_API_URL`. Production should route `/api/*` to the control-plane service at the reverse proxy. The current editor seam expects `/api/websites/:id` and `/api/websites/:id/publish`; the control plane is intentionally not part of this repository.

The target architecture, not yet implemented, makes Orange & Gray infrastructure authoritative for editable projects. Each site has one independent Git repository. Publish first freezes a server project revision, materialises the complete generated site and its design assets, commits and pushes Git, and then deploys the resulting SHA. Runtime uploads remain in persistent per-site storage. Staging and production use blue/green Docker deployment, and production promotes the exact staging Git revision and image that was tested.

The feature branch's local development values are `VITE_SELF_HOSTED_PUBLISH=true` and `VITE_API_URL=http://localhost:8090`. That branch also pins Node with `.nvmrc` to `22.23.2`.

## Current Branch

`feature/self-hosted-publish-ui`, integrating synchronized `origin/main` (`11e43f6`) without rebasing.

## Completed Work

1. Added the self-hosted publishing capability seam and wired publish metadata, publish actions, and the Live control to that capability while preserving cloud-only feature gates.
2. Added the self-hosted Vite API proxy and environment documentation.
3. Added `.nvmrc` for Node `22.23.2`.
4. Repaired the upstream lockfile with the missing nested `@swc/helpers@0.5.23` entry while avoiding unrelated platform metadata churn.
5. Added capability-flag tests and validated the editor, sandbox, and preview builds.

## Current Work

PR #1 merged with a normal merge commit as `11e43f6` after explicit user approval and exact-head verification. `origin/main` contains upstream `e7b5b9f`, the required lockfile correction, and both architecture documents. A fresh upstream fetch found no newer commit.

The synchronized main is merged into the Publish feature. Only `codex_handoff.md` had an add/add conflict; this latest handoff is preserved. `RightHeader.tsx` auto-merged and retains the capability guard, mutation flush, upstream preflight and blocking feedback, autosave flush, then publish request.

Feature validation passed fresh `npm ci`, TypeScript, all three builds, diff checks against `origin/main`, and scoped ESLint (zero errors; 29 existing warnings across RightHeader and Vite). The initial full test run had one failure in the unchanged 30 ms mounting test in `sandbox-code-host.test.ts`; isolated rerun passed all 17 tests. A complete confirmation run with `--maxWorkers=4` passed all 654 files: 10,307 passed, 1 skipped, 3 todo. No test or runtime code was changed for that failure. Logs: `/private/tmp/og-phase0-tests.log`, `/private/tmp/og-phase0-confirm-tests.log`, and `/private/tmp/og-phase0-build.log`.

Next action: finish feature validation, create PR #2, and merge it if clean and mergeable as explicitly authorized. Then begin the separate control-plane persistence repository and editor adapter. No persistence, site Git publishing, Docker worker, or Debian deployment is implemented yet.

## Next Planned Milestones

1. Self-hosted publishing capability seam
2. Self-hosted project persistence backend
3. Local/server asset upload storage
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

The future control-plane repository owns persistence, authentication, the publishing API, and deployment jobs.

Each individual website repository owns generated Next.js website source and its history.

## Storage Strategy

- Editor autosaves should eventually be sent to the server.
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
- The current upstream sync overlap is `src/editor/header/RightHeader.tsx`; upstream added a publish preflight before autosave/publish. The source-level read-only feature application is clean; only the independently maintained handoff file has an add/add documentation conflict.

## Validation Checklist

```text
npm ci
npx tsc --noEmit
npm run test:run
npm run build:all
git diff --check
```

Current sync validation on 2026-09-09: `npm ci`, `npx tsc --noEmit`, `npm run test:run` (653 files; 10,303 passed, 1 skipped, 3 todo), `npm run build:all` (editor, sandbox, preview), and `git diff --check` all passed. Scoped RightHeader ESLint had zero errors and five existing hook warnings. Non-fatal output included test-environment media/canvas stubs, SDK sourcemaps, a dynamic-import warning, and large build chunks. Full repository lint remains baseline debt and was not used as a sync gate. Full test/build logs for this run are `/private/tmp/og-sync-tests.log` and `/private/tmp/og-sync-build.log`.

## Important Decisions

- Self-hosted publishing is a capability, not a cloud-mode switch, so local editing and cloud-only services remain independent.
- Git and Docker credentials must never be exposed to the browser.
- Docker deployment belongs in a separate worker or service.
- Git should represent meaningful deployment snapshots, not every visual editor mutation.
- Production promotes an approved staging revision and the exact tested image.
- Upstream compatibility is a first-class requirement.

## Last Updated

2026-09-09
