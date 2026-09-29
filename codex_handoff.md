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

The ignored `.env.local` used for local self-hosted development contains the
explicit persistence and Publish flags plus the local API URL. Production
builder builds must source the same non-secret Vite flags from a server-side
deployment configuration outside the checkout. See
[SELF_HOSTED_PERSISTENCE.md](./SELF_HOSTED_PERSISTENCE.md) for explicit proof
commands. Both repositories pin Node `22.23.2`.

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

On 2026-09-23 the merged `og-control-plane/main` at `c52c631e6f43e50f68cb2c8037163bbc9af60c92` was deployed and
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
and `/healthz` and `/readyz` pass. The one approved proof repository is now
`chazzajoe-mac/og-site-proof` (private, provider repository ID `1382438507`),
and no other personal repository was created.

## GitHub-backed staging and rollback proof — 2026-09-23

Builder `origin/main` is `9912e2ceedc61ff1327b10a8c0ac97c54db0d8c1`; the
deployed control-plane `main` is `c52c631e6f43e50f68cb2c8037163bbc9af60c92`.

The proof repository was initialized once with bootstrap commit
`ca757e2076213b69a2173253e5e8305a659fdd7d`; the `staging` ref was created at
that commit. The stable database assignment is site
`0f66113e-4108-4602-ae9f-f685aa0b685c` → internal repository assignment
`d050227e-9914-414b-a68a-f62dd0e80342` → `chazzajoe-mac/og-site-proof`.

Release A used project revision `2`, frozen revision
`b95853fc-0b8d-4e6d-a2ea-66d106d807e5`, materialisation hash
`sha256:997d979b3e780cbd5601bc9eb336b03b2eb7668bc3b38a1bbda8431dbd02c980`, Git tree
`772ef0d490e51bc1139cb7bf8ccafef88dcbf368`, Git commit
`70336d7bc3d07181a9337b55af7afb1ba56c1f33`, and image digest
`og-site-proof@sha256:a0a609c46bda6a1b5436ed610d4ad1f722c9fb23bf19049be46b05bd93415849`.
It reached staging blue, then production blue, and was retained for rollback.

Release B used project revision `3`, frozen revision
`ac90151b-32c8-4483-9517-fd3df6c64be3`, materialisation hash
`sha256:4ae1d1d01dd0e4ff504a2b265c3f1c9f2e4996703a456e5ce7a9d1aa9e542f26`,
Git commit `3f4f5d4dfec42f36fb44fcaab52b2a82d064f2e3`, Git tree
`35115c11c158bf3a9bd854a826e57ad02fb59978`, and image digest
`og-site-proof@sha256:f47fd194975c9bf73eced98f5a3db549490abb789f8ff6a283ea033a2f810b97`.
It staged on green while A remained live, then promoted to production green.
GitHub `main` and `staging` now both point to B; B has A as its parent, with no
force push.

The rollback is deployment `5f2b8b04-5c3f-4b65-b497-4f465fa65b94`, derived
server-side from historical A deployment `0309e17b-07ee-4f2a-9916-9f232f2d32c8`.
It reused A's exact image and Git SHA, became production blue, and left GitHub
`main` unchanged at B. The active staging URL is
`http://og-site-proof.100.70.105.18.nip.io` (green/B); the active production
URL is `http://og-site-proof.production.100.70.105.18.nip.io` (blue/A).

The runtime upload `github-proof.txt` was written through the active website
container and read successfully from both B staging and rolled-back A
production containers. The per-site bind mount is the only writable mount;
containers run as UID/GID `10001:10001`, have no Docker socket, and retain the
read-only image layer. `og-staging` remains `internal=true`; `og-ingress` is a
separate managed non-internal network. Failed candidates were cleaned without
changing the active route.

During proof setup, the control-plane unit was corrected with a narrow
no-Docker environment override so staging jobs queue to `og-deployer`, and the
Nginx helper received only `/var/log/nginx` in its existing `ReadWritePaths`
allowlist. The invalid stale OG staging fragment that blocked `nginx -t` was
moved aside and removed after validation. No unrelated containers, networks,
databases, firewall/VPN/systemd services, or production promotion were changed.

## Upstream AI-agent synchronization — 2026-09-28

The migration architecture was published in builder PR #12 and merged with a
normal merge commit. The resulting builder `origin/main` is
`e67ede939eee85c7dd7be08ef32b41f77529ff86`; the documentation commit is
`f0f784c46712a9b609e15621e98e722027e5a4b5`.

The isolated branch `chore/sync-upstream-2026-09-28` was created from that main,
merged with `upstream/main` `eac700dd8abecccb4fa798150a9e9ea0858f31c6`, and
published as builder PR #13. PR #13 merged normally; the resulting builder
`origin/main` is `701fd5f629fdec53af8a9d64690149775b5dc84d`. The merge itself
had no textual conflicts. The upstream rewrite is broad: it
adds the typed `src/ai/agent` tool manifest, per-run checkpoints, branch-aware
workspace isolation, capability fixtures, observation/screenshot verification,
semantic page/component/CMS/layout/SEO/media tools, and the agent editor UI.
The external MCP bridge now delegates run lifecycle and native tool manifests
through `src/ai/agent/bridge-tools.ts` while retaining the legacy `revyme_*`
context/file/CMS bridge.

The sync branch preserves the Orange & Gray persistence backend, versioned
autosave, `PUBLISH_ENABLED`, self-hosted staging/production controls, GitHub
publishing contract, Vite API seam, architecture/handoff documents, and the
existing Cloud/standalone selection. One compatibility repair was required:
`src/backend/autosave.ts` imports `PROJECT_FORMAT` while using the fork's
versioned persistence path. The current working tree also contains the updated
`MIGRATION_AGENT_ARCHITECTURE.md`,
`FRAMER_REVYME_CAPABILITY_MATRIX.md`, and
`MIGRATION_MANIFEST_SCHEMA.md`; these remain documentation/readiness artifacts,
not a migration implementation.

Sync validation on Node `22.23.2` / npm `10.9.8`:

- `npm ci` passed (npm reported existing audit findings: 48 vulnerabilities).
- `npx tsc --noEmit` passed.
- `npm run test:run -- --maxWorkers=4` passed: 816 files, 12,362 passed,
  34 skipped, 5 todo.
- `npm run build:all` passed for the main, sandbox, and preview builds. Existing
  warnings include large chunks, direct `eval` in the code-component runtime,
  ineffective dynamic imports, and the existing Node module-type notice.
- `npm run test:persistence` passed with elevated local IPC permission: 3
  browser tests passed. The non-elevated attempt failed before startup because
  the sandbox denied the Playwright/tsx IPC socket; no product failure was
  observed.
- `git diff --check` passed. Scoped ESLint on the manually repaired
  `src/backend/autosave.ts` reported 0 errors and 4 pre-existing `any` warnings.

The synchronized branch is now merged into `main`. The control-plane main
remains `c52c631e6f43e50f68cb2c8037163bbc9af60c92`, and the latest
`upstream/main` remains contained in builder main. The self-hosted
publish/persistence contracts were rechecked against the new ProjectFS
branching and autosave behavior. Do not start a real Framer migration until a
separate implementation plan and review are approved.

## Self-hosted dashboard — 2026-09-29

- Self-hosted dashboard: **IMPLEMENTED** (`/dashboard`), with server-backed
  project list, create, open, workspace context, revision, and update time.
- Self-hosted server project list/create/open: **IMPLEMENTED** through the
  existing `SelfHostedClient` and control-plane project APIs. Browser
  localStorage is not authoritative in this mode.
- Editor → dashboard and dashboard → exact `/builder/<project-id>` navigation:
  **IMPLEMENTED**. Existing Cloud and standalone/local routing remains
  unchanged.
- Real authentication: **NOT IMPLEMENTED**. The current development session
  is a local proof mechanism and must not be presented as secure multi-user
  authentication.
- Workspace invitations: **NOT IMPLEMENTED**.
- Multi-user permission enforcement: **NOT IMPLEMENTED** as a product
  workflow; server-side project role checks remain the authority for existing
  persistence APIs.
- The ignored `.env.local` enables `VITE_SELF_HOSTED_PERSISTENCE=true` for
  local development and is not committed. Debian production builds must
  provide `VITE_SELF_HOSTED_PERSISTENCE=true` and
  `VITE_PUBLISH_ENABLED=true` through explicit non-secret build configuration
  outside Git.

## Temporary Debian persistence proof — 2026-09-29

- Exposure audit: the builder vhost listens on all local addresses, but the
  host has only RFC1918 LAN (`192.168.7.24`) and Tailscale (`100.70.105.18`)
  addresses; no public/global address or public route was present. LAN and
  Tailscale host-header checks returned 200. The default vhost also answers
  unrelated Host headers on the trusted LAN, so this is not a public-auth
  boundary.
- A timestamped root-only backup was created at
  `/srv/og-platform/archive/dev-auth-proof-20260929-140715/control-plane.env.bak`
  (`root:og-control-plane`, mode `0600`). For the proof only,
  `/etc/og-control-plane/control-plane.env` used `NODE_ENV=development` and
  `OG_DEV_AUTH=true`; only `og-control-plane` was restarted. The exact backup
  was restored afterward, the config mode returned to `0640`, and the service
  is now `NODE_ENV=production`, `OG_DEV_AUTH=false`.
- Disposable server project created through the dashboard/editor:
  `SELF-HOSTED-PERSISTENCE-PROOF-20260929`, id
  `6000ee39-cfa5-4643-9fe6-c1d0b7d168cc`. The editor created a Text layer,
  autosaved `Server-backed persistence proof`, and a hard refresh loaded that
  saved layer from the server-backed project. Server metadata recorded current
  revision `4`, workspace `00000000-0000-4000-8000-000000000002`, content hash
  `sha256:c852ceed7fc137ac93e400f267b31b1abd2748a81277a305245435e2c1598aaf`,
  object hash `sha256:9a1b526f00354efadfbcc85fb0cc3e71a2d0f9f8f2b5e92726407859fcffb429`,
  and snapshot storage under
  `/srv/og-platform/projects/6000ee39-cfa5-4643-9fe6-c1d0b7d168cc/`.
  Snapshot contents were not displayed. No project-delete API exists, so this
  disposable project remains and is marked for later cleanup.
- Post-restore regression: `/healthz` 200, `/readyz` 200, `/api/session` 401,
  `/api/dev/session` 404. Builder and dashboard returned 200; proof staging
  and production health routes returned 200. `og-control-plane`, `og-deployer`,
  `og-nginx-helper`, and Nginx remained active. `og-staging` remained
  `internal=true`; `og-ingress` remained dedicated and non-internal. The
  control-plane service still has no Docker group; `og-deployer` remains the
  Docker authority. GitHub private-key metadata remained `root:og-platform`
  mode `0640`; contents were never displayed.
- The embedded browser cannot provide `crypto.randomUUID` over the plain HTTP
  nip.io origin, so the browser proof used the same Debian vhost/backend via a
  temporary localhost SSH/Host-header tunnel and the existing local sandbox
  bundle. Those loopback processes were stopped after the proof; no Debian
  builder, Nginx, deployer, database, network, or unrelated service was
  changed.
- This proof demonstrates server-side persistence only. It does not establish
  real authentication, invitations, or production multi-user security.
- Repository note: local `main`/`origin/main` is `cade6e649731fffa00aab8063243e4bb71644ee1`,
  while current `upstream/main` is `cc20148194fccb7d6a7fe99d82d7d2e961de3fee`.
  The latest upstream commit is not yet contained in builder main; no upstream
  synchronization was performed during this proof.

## Latest upstream sync attempt — 2026-09-29

- A focused branch, `chore/sync-upstream-2026-09-29`, was created from the
  current `origin/main` (`cdaaaee9acc8a0ad5f4ce0dee3880521d4a27531`) and
  merged with `upstream/main` at `cc20148194fccb7d6a7fe99d82d7d2e961de3fee`.
  The merge had no conflicts. The branch currently ends at merge commit
  `285edac` plus the focused lint cleanup `7e187bb`; it was merged into
  `main` by builder PR #17 as merge commit `9109586c2969f959157219a18747194542ced2c1`.
- No self-hosted persistence, dashboard, publish-capability, Cloud, or
  standalone files were changed by the upstream merge. The lint cleanup only
  removed dead imports and changed one never-reassigned local binding in
  upstream-touched files.
- Validation: `npm ci` passed; `npx tsc --noEmit` passed; `npm run build:all`
  passed; `git diff --check` passed; scoped ESLint for all upstream-touched
  TypeScript/TSX/JS files passed with zero errors. The full repository lint
  still reports the existing baseline errors outside this sync surface.
- `VITE_SELF_HOSTED_PERSISTENCE=false VITE_SELF_HOSTED_PUBLISH=false
  npm run test:run` passed: 823 files, 12,421 passed, 34 skipped, 5 todo.
  Running the same suite without the override under the intentional local
  self-hosted `.env.local` causes 13 autosave guard failures because those
  standalone unit tests do not boot a server project; no product source was
  changed to mask that environment distinction.
- Recommended next action after the merged sync is to review the focused
  production-auth branches below before any deployment.

## Production authentication design — 2026-09-29

- The narrow production path is GitHub App Device Flow, kept entirely on the
  control plane. The server verifies the configured GitHub login, maps the
  immutable provider subject to the existing `users` table and configured
  workspace, then discards the GitHub tokens. The browser receives only the
  HTTP-only `og_session` cookie.
- Control-plane implementation branch:
  `feat/production-github-device-auth-2026-09-29`. It adds migration 008 for
  provider/subject identity columns, server-polled login, user-session
  creation/revocation, production config, API documentation, and focused
  tests. Builder implementation is on the same-named branch and adds the
  GitHub login/poll UI, logout, client methods, and focused tests. Neither
  branch has been published yet.
- Required non-secret production configuration is
  `OG_AUTH_GITHUB_LOGIN` and `OG_AUTH_WORKSPACE_ID`, alongside the existing
  server-side `GITHUB_CLIENT_ID`. `OG_DEV_AUTH` remains false in production;
  Docker, GitHub private keys, deployer, and Nginx credentials remain
  server-side.
- Validation so far: builder TypeScript passed; focused builder auth tests
  passed (13); full builder tests passed in standalone test mode (823 files,
  12,424 passed, 34 skipped, 5 todo); builder `build:all` passed. Control
  plane typecheck, build, and tests passed (8 files, 61 passed, 2 skipped).
- Do not deploy or create `chazzajoe-mac/chaz-photography` until both auth PRs
  are reviewed/merged and production configuration is explicitly verified.

## Last Updated

2026-09-29

## Workspace dashboard and HTTPS follow-up — 2026-09-29

- Local feature branches `feature/self-hosted-workspace-dashboard` now contain
  control-plane commit `150a4d2` and builder commit `6d8518d` (both unpushed).
- Production GitHub login now resolves users by immutable provider subject and
  derives workspace access from `workspace_memberships`. New users are not
  silently attached to a configured bootstrap workspace; they can create their
  first workspace explicitly. Workspace selection updates the authenticated
  database session after server-side membership verification.
- The self-hosted dashboard now provides a Revyme-styled workspace selector,
  workspace-scoped project list/create/open flow, and first-workspace setup.
- Control-plane validation passed: typecheck, build, and 65 tests (2 skipped).
  Builder typecheck, build:all, and the nine focused dashboard tests passed.
  The full builder suite remains environment-sensitive: 818 files pass and 13
  existing autosave/MCP harness tests fail when run with the local
  self-hosted environment enabled.
- DNS diagnosis remains authoritative `NXDOMAIN` for
  `revyme.chazmedia.co.uk` at both Cloudflare nameservers, despite the record
  being visible in the Cloudflare UI. The TLS/Nginx path is therefore stopped;
  no certificate, Nginx, service, or Debian deployment changes were made.
- Do not push, merge, deploy, or enable HTTPS until the authoritative DNS
  answer exists and the feature branches are reviewed.

## Open-source hostname and identity audit — 2026-09-29

- No literal `revyme.chazmedia.co.uk` or `chazmedia.co.uk` references exist in
  the builder/control-plane source or active Debian Nginx configuration. The
  editor origin, Nginx `server_name`, TLS paths, API origin allowlist, and
  site base domains remain installation configuration.
- Removed product-level Orange & Gray/CHAZ coupling from the self-hosted UI,
  development identity labels, Git commit author defaults, and GitHub owner /
  authentication fallbacks. GitHub installations now require explicit
  `OG_GIT_OWNER`, `GITHUB_ALLOWED_OWNERS`, and `OG_AUTH_GITHUB_LOGIN` values.
- Proof runbooks and architecture/handoff notes retain clearly labelled
  Orange & Gray/CHAZ examples as deployment history; they are not runtime
  defaults. Internal Docker labels and systemd unit names remain stable
  deployment namespaces so existing Debian resources are not disturbed.
- Genericity changes are local and not deployed; the live Debian hostname and
  server-side identity configuration were left unchanged.

## Workspace dashboard Phase 0 completion — 2026-09-29

- Control-plane PR #33 merged with normal merge commit
  `7c9966e9fe80d34d3ba0abb6bd689640cdb55860`; builder PR #20 merged with
  normal merge commit `2326c96ab7d59e55f1641d65b43bbed1822bbed0`.
- Current `origin/main`: control plane `7c9966e9fe80d34d3ba0abb6bd689640cdb55860`,
  builder `2326c96ab7d59e55f1641d65b43bbed1822bbed0`. Current
  `upstream/main` is `cc20148194fccb7d6a7fe99d82d7d2e961de3fee` and is an
  ancestor of builder main.
- Control-plane validation after the authorization edge test: typecheck,
  build, and 66 tests passed (2 skipped); `git diff --check` passed. Builder
  typecheck, nine focused dashboard tests, build:all, scoped ESLint, and
  `git diff --check` passed.
- Full builder tests were run identically on origin/main and the feature
  branch with the repository's current environment. Both produced the same
  13 failures (12 autosave/MCP server-project guard failures plus one
  autosave timer assertion), with identical test names and first error
  messages; this is an environment-sensitive baseline, not a dashboard
  regression.
- Migration 009 only makes `sessions.workspace_id` nullable. It changes no
  existing project, snapshot, index, default, or data rows. Existing sessions
  retain their workspace; sessions without one use explicit first-workspace
  provisioning. Rollback requires a forward migration/backup restore after
  resolving null sessions, not a blind `SET NOT NULL`.
- Authentication identity and Git publishing remain separate: GitHub provider
  subject identifies the user, memberships authorize workspaces, and the
  server-side `OG_GIT_OWNER`/`GITHUB_ALLOWED_OWNERS` configuration controls
  repository publishing. No Debian deployment, migration, TLS, Nginx, DNS, or
  proof-site state was changed.
- Recommended next action is the separately prepared Debian sequence: database
  backup, control-plane update/migration/restart, health/readiness verification,
  then atomic builder dist update. HTTPS remains blocked until authoritative
  DNS returns the configured editor hostname.

## Debian workspace dashboard deployment — 2026-09-29

- Deployed control-plane main `7c9966e9fe80d34d3ba0abb6bd689640cdb55860` and
  builder main `310f13e7fc813802fc787cc2d4bef0fec4eea47e` from immutable local
  bundles. Server-only environment files were preserved; temporary bundles were
  removed after checkout.
- Control-plane `npm ci`, typecheck, test, and build passed on Debian. The
  migration runner applied migration 009; schema migration count is 9 and
  there are currently 0 sessions with a null workspace. A timestamped backup
  was created under `/srv/og-platform/backups/workspace-dashboard-20260929T180443Z/`.
- Only `og-control-plane` was restarted. `og-deployer`, `og-nginx-helper`, and
  Nginx remained active. `/healthz` and `/readyz` return 200; unauthenticated
  workspace/session routes correctly return 401.
- Builder dependencies and `build:all` passed. The static `dist` was replaced
  with a retained rollback directory `dist-previous-20260929T180806Z`.
  Builder root and `/dashboard` return 200.
- Existing proof staging and production routes both return 200. `og-staging`
  remains `internal=true`; `og-ingress` remains the dedicated non-internal
  ingress network. `og-control-plane` has no Docker group; `og-deployer`
  retains Docker authority and the `og-nginx` helper boundary.
- The observed Docker container set remained unchanged, including unrelated
  services. DNS, TLS, Nginx configuration, production promotion, and the
  `chaz-photography` site were not changed.
