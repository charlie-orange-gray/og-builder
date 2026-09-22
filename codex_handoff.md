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

The control plane now has server-side Git and Docker staging provider seams. Local development creates/reuses a per-site bare repository, publishes the exact materialized tree to `staging`, verifies the commit SHA, builds an immutable full-SHA image when enabled, starts a blue/green candidate, checks `/healthz`, and switches the staging route only after health passes. A controlled Nginx provider now validates generated host routes, runs `nginx -t`, reloads atomically, and restores the previous route on failure. The GitHub App provider is implemented and credential-gated; production promotion remains proven on the local/GitHub-compatible provider boundary. Runtime uploads remain outside disposable containers.

The ignored `.env.local` still contains the original Publish flag and API URL; it was not silently switched to persistence. See [SELF_HOSTED_PERSISTENCE.md](./SELF_HOSTED_PERSISTENCE.md) for explicit proof commands with publishing disabled. Both repositories pin Node `22.23.2`.

## Current Branch

Builder documentation branch `docs/github-provider-handoff-2026-09-22`, based on
the production-proof handoff commit `b7cef43`. The isolated upstream sync branch
`chore/sync-upstream-2026-09-22` was validated without changes because
`origin/main` already contains `upstream/main`.

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

Phase 1, Phase 2, and the Phase 3/4 local Git staging proof are implemented and validated. They were published in PR #4 and merged into `origin/main` as `8d07dc9`; the feature branch remains available with its published history. `/Users/chaz/og-control-plane` is a separate private GitHub repository and its `main` is published at `abfd04b`.

Local implementation commits: editor adapter `795c2c5`; control-plane initial commit `f327b9a`. Phase 0 completion was recorded separately as `7e8ea40`. The final fetch reports `origin/main=84181a3` and `upstream/main=3ef52b6`.

The Phase 2 implementation commits are `3e8e2b3` in the builder and `1ae553c` in the control plane; builder documentation/publication-gate commits are `7f700f1` and `4ec2c44`. The control-plane repository has no remote configured. Publishing the builder feature branch and opening its PR was requested, but the current environment rejected the external push because the available publication approval was scoped to the earlier Phase 0 integration; no Phase 1/2 source was pushed.

After Phase 2 work began, upstream advanced from `e7b5b9f` to `3ef52b6` through four upstream commits. The isolated `chore/sync-upstream-2026-09-10` branch was created from `origin/main` and merged upstream as `7f5d31f` with no textual conflicts. Its upstream-only validation passed TypeScript, all three builds, 671 test files (10,449 passed, 1 skipped, 3 todo), and `git diff --check`. The upstream overlap is broad and upstream-owned, including `ProjectLoader.tsx`, canvas, parser, mutation, generator, and CMS files; it was not merged into this feature branch.

The API implements `POST/GET /api/projects`, `GET/PUT/PATCH /api/projects/:projectId`, project-scoped asset register/list/metadata/bytes routes, `POST /api/projects/:projectId/frozen-revisions`, `POST /api/frozen-revisions/:id/materialize`, `POST /api/projects/:projectId/publish` plus the editor-compatible `/api/websites/:projectId/publish` alias, `GET /api/deployments/:deploymentId`, `GET /api/websites/:projectId`, `POST /api/dev/session`, `GET /api/session`, `/healthz`, and `/readyz`. Its SQL migrations create users, workspaces, workspace memberships, projects, immutable project snapshots, content-addressed project assets, frozen revisions/manifests, sites, deployments, deployment events, audit events, sessions, and save receipts. Migration replay is checksummed and serialized.

Saves send a base revision, matching `If-Match`, and an idempotency key. Stale saves return 409, pause autosave, and preserve the local copy. Files are written/fsynced/renamed before database references commit. Settings survive load/save/recovery. Snapshot compression is gzip using stable Node 22 support; the actual architecture decision is recorded in `CHAZ-Architecture.md`. No protected canvas/parser/runtime/mutation/generator/CMS internals were changed.

The local browser proof uses real PostgreSQL 18.4 and durable data in the service's ignored `.data/phase1-proof-v1`. It creates a project through the UI, draws through actual pointer/keyboard input, closes the first browser context, reloads in a fresh context, edits/saves again, and reloads both frames. Further cases prove failed-load blocking and stale-browser recovery without overwriting the newer server revision. The control-plane integration suite now also proves asset deduplication/byte retrieval, stale freeze rejection, embedded SVG data-URL migration, and two independent materializations with identical manifest/file contents. No product workaround was used.

Final proof project: `d71de69c-e859-4498-bb2d-1cf6131927c8`, revision 1 → 2 across independent browser contexts. The retained JSON report is `test-results/persistence-report.json`; the screenshot shows both frames reloaded with acknowledged Saved status.

Phase 3/4 is implemented locally. Self-hosted Publish flushes mutations and the exact saved revision, runs the upstream preflight, calls the control-plane publish endpoint, and reports `Staging source published` with deployment ID, revision, repository, branch, and verified SHA. The control plane derives authorization from the session, creates/reuses a stable site and repository assignment, freezes and materializes the exact revision, serializes per-site publication, pushes the configured provider's `staging` branch, records ordered deployment events, and ends at `ready-for-build`. Migration `004_git_repositories.sql` stores provider, owner, provider repository ID, and stable branch assignment.

The server-side GitHub provider is merged into control-plane `main` via PR #26
at `b6ba4178defa69bca6c94aa42aecccfd85bb2d49`. PR #27 added the expiring user
token Device Flow/refresh lifecycle and merged at
`2e750bcfa8ca68e04f6393ff9ac8eb8e73efa0bd`; it uses short-lived installation
tokens for repository data operations and a server-side App user token only
for personal-repository creation. Token state is atomically replaced with
restrictive permissions, and installation/user identity checks run before
repository creation. The local provider remains unchanged and is still the
development default. The App is registered under `chazzajoe-mac` with App ID
`5032895` and Installation ID `163764761`; the Client ID and PEM path still
need server-side configuration. No personal proof repository has been created.

The validated Phase 3/4 commits are builder `6170aba` and control plane `886e5db`. They add the builder Git response contract and `ready-for-build` UI, migration `004_git_repositories.sql`, the server-side `GitProvider`/local bare-repository implementation, per-site assignment, SHA verification, concurrency serialization, and the Git publication runbooks. Both repositories are clean after these local commits.

Validation completed on Node `22.23.2` / npm `10.9.8`: builder `npm ci`, TypeScript, full test suite (659 files; 10,345 passed, 1 skipped, 3 todo), all three builds, targeted ESLint (zero errors; five existing RightHeader hook warnings), and diff checks passed. Full builder lint remains a pre-existing baseline failure (63 errors and 2,446 warnings across unrelated files). Control plane `npm ci`, TypeScript, 25 PostgreSQL-backed tests, build, and diff checks passed. The control-plane tests include exact SHA clone verification, immutable asset inclusion, idempotent retry, concurrent same-site publish serialization, stale revision rejection, viewer authorization, and sanitized materialization failure.

The validated staging-worker commits are builder `1c13e61` and control plane `8007244` (following `99b7185`). A fresh fetch confirms `origin/main=84181a3`, `upstream/main=3ef52b6`, with the feature 15 commits ahead of origin and 13/4 origin/upstream divergence; upstream changes overlap only the already-integrated `src/ProjectLoader.tsx` in this feature diff. No sync branch was merged into the feature. The control plane now has migration `005_docker_staging.sql`, `DeploymentWorker`, `DockerProvider`, local and controlled `NginxRoutingProvider` seams, exact-SHA checkout, SHA-tagged image metadata, blue/green staging slots, direct health checks, read-only containers with optional per-site runtime-upload mounts, route preservation on candidate failure, verified image/candidate reuse on retry, idempotent active replay, and an opt-in `POST /api/deployments/:id/staging` flow. Builder capability `stagingDeployment` drives `Deploy staging` UI and an `Open staging` link without affecting Cloud or standalone behavior.

Validation for this worker pass: control plane TypeScript, 29 tests passed and 1 Docker integration test skipped, build, and diff checks passed; the Docker integration file is skipped because the local Docker daemon is unavailable. Builder TypeScript, 659 test files (10,346 passed, 1 skipped, 3 todo), all three builds, browser persistence proof (3 passed with elevated IPC permission), scoped ESLint (zero errors, five existing warnings), and diff checks passed. Full builder lint remains baseline-failing. At that point the worker still injected only deterministic build-context scaffolding; the follow-up contract implementation supersedes that behavior and now materializes the complete pinned site tree before validation.

The implementation commits remain `9f8b2ad` in the builder and `8007244` in the control plane, followed by the focused Debian/Nginx commits (`000583d`, `24eebc1`, `abfd04b`). Both repositories are clean and published. The generated-site contract is now implemented locally in control-plane commit `09ccb0f` on branch `feat/site-build-contract-2026-09-16`; its publication is pending explicit remote approval. Next recommended action: review and publish that branch, then obtain the Debian host/Tailscale or SSH target and run the documented staging proof with Docker/Nginx, recording the two-release and failed-candidate evidence. The local Docker daemon is unavailable, and the current worker remains in-process for this private proof; split Docker authority into an `og-deployer` process before public production. Do not implement production promotion in this phase.

## Final Publication State — 2026-09-16

- `origin/main`: `8d07dc952d1140e2c4917aa3eb144966f5af1128` (PR #4 merge commit).
- `upstream/main`: `3ef52b6ef73c4519dec5f603da8c8bb31a0f637f`; it is fully contained in `origin/main`.
- Upstream sync PR: #3, merged as `ae1e616`.
- Feature PR: #4, merged as `8d07dc9`; no rebase was performed.
- Control-plane repository: [charlie-orange-gray/og-control-plane](https://github.com/charlie-orange-gray/og-control-plane), `main` at `abfd04b681490e908cf7962913a08d6a9c38941b`.
- Builder validation: TypeScript passed; 676 test files, 10,488 passed, 1 skipped, 3 todo; all builds passed; persistence proof 3 passed; scoped ESLint 0 errors and 47 warnings; diff checks passed.
- Control-plane validation for contract commit `5ef78a6`: Node `22.23.2`, `npm ci`, typecheck, full test suite (36 passed, 1 skipped Docker integration), build, and diff checks passed. Scoped ESLint was attempted but the repository has no ESLint configuration; no lint result is claimed.
- No real Debian Docker/Nginx proof has run. The generated-site package/build contract is validated locally (contract `nextjs-node22-v1`, template `site-v1`): a fresh clone of the recorded staging SHA runs `npm ci`, `npm run build`, `npm run start`, returns `/healthz` 200, renders the generated page, and serves a committed design asset. Local proof identities: deployment `4a544a34-bb5c-42d6-b92e-44baa76352a1`, project revision `1`, frozen revision `31fe21a1-cb50-4db2-a10e-a50570933fcc`, materialization `sha256:cfc2f08fa6508e77f69fd621e2fdde5e9613098db67daa937c15d48f648553d5`, Git commit `9b1bf6de1d578f7411606264fec9d21fc62cb3c5`, Git tree `7f3e621acf7270c31b498ea42da02dade603f7ec7`. The separate `og-deployer` authority, production promotion, rollback, authentication, and agency hardening remain blockers. Control-plane feature commit `09ccb0f` is local on `feat/site-build-contract-2026-09-16` and has not been pushed.
- Exact next phase: run the Debian staging proof (including two successful releases and a failed candidate) before implementing production promotion or rollback.

## Next Planned Milestones

1. Self-hosted publishing capability seam — complete on stable main
2. Self-hosted project persistence backend — local proof complete; review pending
3. Content-addressed design asset storage and frozen materialization — local proof complete; review pending
4. Minimal publish API — local proof complete; review/publication pending
5. Git staging deployment — local provider proof complete; GitHub provider and token refresh merged, pending server-side App credentials and proof repository
6. Docker staging deployment — local provider/injectable proof complete; controlled Nginx seam and Debian runbook prepared; Debian Docker/Nginx proof pending
7. Production promotion
8. Deployment history and rollback
9. Authentication
10. Workspaces and user roles
11. Agency hardening
12. Optional CMS/analytics/A-B/AI/MCP integrations

## Debian staging host inventory — 2026-09-16

Read-only SSH inventory succeeded via `chaz-debian` (`192.168.7.24`, Tailscale `100.70.105.18`). The host is Debian 13.6 (kernel 6.12.105), x86-64, 24 CPUs, 31 GiB RAM, with 804 GiB free on `/`. Docker Engine `29.8.0` is active and already serves unrelated household/work services; no Docker resources were changed. Nginx is active and enabled, but the SSH account has no non-interactive sudo authorization (a password is required), so Nginx validation or reload was not attempted.

The original Revyme PoC is positively identified: `/var/www/revyme-builder`, owner `revyme`, Git `main` at `a3ed7b5` tracking `revyme-web/builder`, with an uncommitted `package-lock.json` change. PM2 v7.0.4 runs `canvas-poc` on `*:3333`, `canvas-sandbox` on `127.0.0.1:15174`, and `canvas-preview` on `127.0.0.1:15175`; all three endpoints returned HTTP 200. No `revyme`, `3333`, `15174`, or `15175` references were found in readable Nginx site/config paths (only the default site is enabled). The `revyme` user and project have therefore been retained; stopping PM2, archiving the project, and any Nginx change require an approved sudo-capable session and must wait until the new platform is published and ready.

The generated-site contract and production deployment path are now merged into `og-control-plane/main`. The exact deployed control-plane SHA is `f15946319f4b8f8c4022535d312a32b5e8b85730`; the builder production controls are merged at `a9306529f00b04b9ac873200ffad75af1df4ea7c`. The Debian proof used only the temporary hostname `nginx-helper-release-a.production.100.70.105.18.nip.io`, dedicated production ports `42000–42999`, and the existing OG service boundary. Production P1, P2 blue/green, rollback, and failed candidate C have completed; real customer production promotion remains out of scope.

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
- Production API/control-plane validation: `npm ci`, typecheck, `npm test` (53 passed, 2 skipped), build, and `git diff --check` passed on each focused merge branch. Debian deployed `f159463`; P1 and P2 passed health checks, rollback passed, and candidate C failed health without changing the active production route. The runtime upload survived P1 → P2 → rollback; the P2 image remained retained.
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

## GitHub App Authentication State

On 2026-09-22 the merged `og-control-plane/main` at `2e750bc` was deployed and
the Debian control plane was configured for the authorized GitHub
App installation (`5032895` / `163764761`) and owner `chazzajoe-mac`. The PEM is
at `/etc/og-control-plane/secrets/github-app-private-key.pem` with ownership
`root:og-platform`, mode `0640`; the secrets directory is `0750`. The user-token
state is server-side at `/var/lib/og-control-plane/github-user-token.json`,
owned by `og-control-plane:og-control-plane`, mode `0600`, and is refreshed by
the merged `GitHubUserTokenStore` implementation. The parent configuration
directory grants `og-deployer` only a traverse (`--x`) ACL so its existing
`og-platform` group access can reach the PEM without exposing the environment
file. GitHub installation verification passed for owner, contents-write
permission, and authenticated user `chazzajoe-mac`; both OG services are active
and `/healthz` and `/readyz` pass. No personal proof repository has been
created; the next step is a server-side identity-gated proof operation.

## Last Updated

2026-09-22
