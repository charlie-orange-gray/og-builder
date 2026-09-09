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

`chore/sync-upstream-2026-09-09`. Upstream through `e7b5b9f` is integrated in merge commit `874eb39`; architecture documentation is committed as `0635787`. The Publish feature remains at `7a2ccae` pending integration.

## Completed Work

1. Added the self-hosted publishing capability seam and wired publish metadata, publish actions, and the Live control to that capability while preserving cloud-only feature gates.
2. Added the self-hosted Vite API proxy and environment documentation.
3. Added `.nvmrc` for Node `22.23.2`.
4. Repaired the upstream lockfile with the missing nested `@swc/helpers@0.5.23` entry while avoiding unrelated platform metadata churn.
5. Added capability-flag tests and validated the editor, sandbox, and preview builds.

## Current Work

Phase 0 is validated locally and awaiting remote merge approval. A fresh fetch on 2026-09-09 found upstream commit `e7b5b9f`, covering transformed drag/resize behavior across 23 files. It merged cleanly on the dedicated sync branch without Orange & Gray source changes. `origin/main` remains `a3ed7b5`.

The sync branch is pushed and [PR #1](https://github.com/charlie-orange-gray/og-builder/pull/1) is open and mergeable. Automatic approval review rejected merging this specific PR into the remote default branch, citing the earlier explicit approval requirement even after the latest implementation request was supplied. No remote main merge, feature merge, or rebase occurred. Resume only after approval naming PR #1; use a merge commit and verify the PR head before merging.

The only fork source divergence from `upstream/main` on the sync branch is the existing 11-line nested `@swc/helpers@0.5.23` lockfile correction (`b8f851a`). Documentation is also present. Fresh `npm ci` succeeds with that correction.

A renewed read-only merge-tree check confirms `RightHeader.tsx` combines the upstream publish preflight with `PUBLISH_ENABLED` without a textual conflict. Only `codex_handoff.md` has an expected add/add documentation conflict. Preserve the newer handoff and update its branch/state during integration. Required publish order remains: capability guard, `flushNow()`, preflight and blocking feedback, `flushSaveNow()`, publish request.

No control-plane repository, database, persistence API, asset pipeline, Git site publisher, Docker worker, or Debian deployment has been implemented. Local Docker CLI exists but its daemon socket is absent; PostgreSQL executables were not found on PATH. No credentials or host configuration were changed.

Next action: merge PR #1 after specific approval, fetch `origin`, merge updated `origin/main` into the Publish feature, resolve the documentation conflict, rerun the required validations, and integrate the feature through a second PR. The implementation request explicitly prohibits beginning Phase 1 until Phase 0 is clean.

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
