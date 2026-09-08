# OG Builder / Revyme Fork

## Purpose

Orange & Gray is adapting Revyme into a self-hosted visual website platform. The intended platform provides server-backed project persistence, staging deployments, Git-backed version control, versioned Docker images, production promotion, and rollback.

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

The editor exposes one publishing capability, `PUBLISH_ENABLED`, from `src/shared/publish-flag.ts`. Revyme Cloud enables it through `CLOUD_ENABLED`; standalone self-hosted publishing enables it with the exact environment value `VITE_SELF_HOSTED_PUBLISH=true` without enabling cloud authentication, billing, marketplace, collaboration, cloud persistence, or hosted services.

In self-hosted development, same-origin `/api/*` requests are proxied by Vite to `VITE_API_URL`. Production should route `/api/*` to the control-plane service at the reverse proxy. The current editor seam expects `/api/websites/:id` and `/api/websites/:id/publish`; the control plane is intentionally not part of this repository.

Current local development values are `VITE_SELF_HOSTED_PUBLISH=true` and `VITE_API_URL=http://localhost:8090`. Node is pinned by `.nvmrc` to `22.23.2`.

## Current Branch

`chore/sync-upstream-2026-09-09` (the Orange & Gray feature branch remains `feature/self-hosted-publish-ui` at `f002dfb`, plus its separate handoff commit `7a2ccae`).

## Completed Work

1. Added the self-hosted publishing capability seam and wired publish metadata, publish actions, and the Live control to that capability while preserving cloud-only feature gates.
2. Added the self-hosted Vite API proxy and environment documentation.
3. Added `.nvmrc` for Node `22.23.2`.
4. Repaired the upstream lockfile with the missing nested `@swc/helpers@0.5.23` entry while avoiding unrelated platform metadata churn.
5. Added capability-flag tests and validated the editor, sandbox, and preview builds.

## Current Work

The sync branch fast-forwarded from `origin/main` to upstream commit `b3ed3d9` (`fix: rotated elements alignment icon fix`). No merge conflicts or manual source resolutions occurred. The only overlap with the feature is `src/editor/header/RightHeader.tsx`, where upstream added publish preflight validation. A read-only merge-tree application of the feature onto this sync branch also found no textual conflicts. Any future feature integration should preserve both that upstream preflight and the `PUBLISH_ENABLED` capability seam.

The sync branch contains one intentional 11-line lockfile correction, committed as `b8f851a`: nested `@swc/helpers@0.5.23`, still required because upstream's `next-intl` dependency resolves `@swc/core@1.15.33` with an optional `@swc/helpers>=0.5.17` peer. `npm ci` is clean with that correction. The updated handoff is committed separately as `ecf5856`.

Next recommended action: review this sync branch and approve or reject integrating it into the feature branch. Do not push, merge into `origin/main`, rebase, or merge the feature until approval.

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
- The current upstream sync overlap is `src/editor/header/RightHeader.tsx`; upstream added a publish preflight before autosave/publish. The read-only feature application is clean.

## Validation Checklist

```text
npm ci
npx tsc --noEmit
npm run test:run
npm run build:all
git diff --check
```

Also run scoped ESLint on changed source files. On this sync branch, `npm ci`, `npx tsc --noEmit`, `CI=1 npm run test` (648 files, 10,274 tests passed; 1 skipped; 3 todo), `npm run build`, and `git diff --check` passed. Scoped ESLint on `RightHeader.tsx` had zero errors and five existing hook-dependency warnings. Full repository lint remains baseline debt and was not used as a sync gate.

## Important Decisions

- Self-hosted publishing is a capability, not a cloud-mode switch, so local editing and cloud-only services remain independent.
- Git and Docker credentials must never be exposed to the browser.
- Docker deployment belongs in a separate worker or service.
- Git should represent meaningful deployment snapshots, not every visual editor mutation.
- Production promotes an approved staging revision and the exact tested image.
- Upstream compatibility is a first-class requirement.

## Last Updated

2026-09-09
