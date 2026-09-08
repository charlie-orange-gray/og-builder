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

`feature/self-hosted-publish-ui`

## Completed Work

1. Added the self-hosted publishing capability seam and wired publish metadata, publish actions, and the Live control to that capability while preserving cloud-only feature gates.
2. Added the self-hosted Vite API proxy and environment documentation.
3. Added `.nvmrc` for Node `22.23.2`.
4. Repaired the upstream lockfile with the missing nested `@swc/helpers@0.5.23` entry while avoiding unrelated platform metadata churn.
5. Added capability-flag tests and validated the editor, sandbox, and preview builds.

## Current Work

The current task is an upstream synchronization audit and handoff maintenance. The fetched `upstream/main` is six commits and 168 changed files ahead of `origin/main`; the feature branch is one commit ahead of `origin/main` and six commits behind `upstream/main`. No sync branch has been created and no merge, rebase, commit, or push is authorized yet. The only overlapping file is `src/editor/header/RightHeader.tsx`, where upstream added publish preflight validation. A read-only `git merge-tree` check found no textual conflicts. Any future sync should preserve both that upstream preflight and the `PUBLISH_ENABLED` capability seam.

Next recommended action: after review, create a dedicated `chore/sync-upstream-2026-09-09` branch and merge `upstream/main` there, then run the full validation checklist before considering that branch for integration.

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
- The current upstream sync overlap is `src/editor/header/RightHeader.tsx`; upstream added a publish preflight before autosave/publish.

## Validation Checklist

```text
npm ci
npx tsc --noEmit
npm run test:run
npm run build:all
git diff --check
```

Also run scoped ESLint on changed source files. The last completed validation passed all of the above except full `npm run lint`, which remains blocked by baseline repository errors; scoped lint had zero errors.

## Important Decisions

- Self-hosted publishing is a capability, not a cloud-mode switch, so local editing and cloud-only services remain independent.
- Git and Docker credentials must never be exposed to the browser.
- Docker deployment belongs in a separate worker or service.
- Git should represent meaningful deployment snapshots, not every visual editor mutation.
- Production promotes an approved staging revision and the exact tested image.
- Upstream compatibility is a first-class requirement.

## Last Updated

2026-09-09
