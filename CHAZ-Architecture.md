# CHAZ Self-Hosted Revyme Architecture

## 1. Executive Summary

`og-builder` is Orange & Gray's maintainable fork of the open-source Revyme visual website builder. The goal is a Framer-like self-hosted workflow in which Revyme remains the browser frontend and visual editor while Orange & Gray infrastructure is authoritative for editable project state, collaboration state, deployment state, and operational history.

Users must be able to sign in from any supported browser, open the same project, and continue editing without project data belonging to Revyme Cloud. Browser local storage may remain available for standalone Revyme use, but it is not authoritative in self-hosted mode.

Each published website has its own independent Git repository. Every meaningful Publish materialises a complete deployable Next.js website, including its immutable design/build assets, and commits and pushes that result before deployment. The resulting Git SHA is the durable identity of the release.

Production websites may run on the same Linux server as the builder or on separate VPS/web nodes. Deployment location is a control-plane concern and is abstracted from the editor. GitHub provides durable source and version history for published website revisions. Docker runs immutable artifacts built from concrete Git SHAs.

The required release boundary is:

```text
editable Revyme project revision
    → complete generated site and design assets
    → Git commit and push
    → Git SHA
    → versioned Docker image
    → health-checked staging or production slot
```

## 2. Design Principles

- Upstream Revyme compatibility is a first-class requirement.
- Prefer adapters and isolated modules over rewrites of Revyme internals.
- Use capability interfaces instead of assuming that all server features mean Revyme Cloud.
- The browser contains no GitHub, Docker, host, database, or production credentials.
- The editor is separate from the control plane.
- The control plane is separate from privileged deployment execution.
- Generated websites are independent repositories, one repository per website.
- Every Publish creates or updates the website Git repository before deployment.
- Every deployment refers to a concrete Git SHA.
- Git history remains usable independently of the deployment server as durable source and version history.
- Containers are immutable and disposable.
- Design and build-time assets are normally versioned with the generated website.
- Mutable runtime uploads survive container replacement in persistent per-site storage.
- Staging tests the exact artifact promoted into production.
- Production supports safe rollback to a previously successful deployment.
- Meaningful deployment snapshots become Git revisions; individual editor mutations do not.
- Failure before cutover leaves the existing healthy deployment serving traffic.

## 3. Logical Platform Components

### OG Builder

Repository: https://github.com/charlie-orange-gray/og-builder.git

Responsibilities:

- visual editor
- workspace and project UI
- publishing controls
- API client
- save and deployment status UI
- selection of staging deployments for production promotion
- rollback request UI

Non-responsibilities:

- Docker execution or Docker socket access
- GitHub deployment credentials
- server shell access
- infrastructure secrets
- direct database credentials
- arbitrary deployment-node commands

### Control Plane API

Recommended future repository: `og-control-plane`.

Responsibilities:

- authentication and session integration
- users, workspaces, memberships, and roles
- project creation, listing, rename, load, and autosave
- immutable project snapshots and revision checks
- design-asset metadata where required
- deployment records and status APIs
- Publish and promotion APIs
- Git repository assignment metadata
- rollback requests
- deployment-node assignment
- authorization and audit events

The API accepts product-level intentions such as “save project revision,” “deploy this snapshot to staging,” and “promote this staging deployment.” It does not expose shell commands, raw Docker operations, or unrestricted Git operations.

### PostgreSQL

PostgreSQL stores operational and relational metadata, including:

- users
- workspaces
- workspace memberships
- projects
- project revision metadata
- deployment records
- Git repository identifiers and Git SHAs
- domains
- target deployment nodes
- runtime asset metadata where required
- audit events

Large binary website assets must not be stored directly in PostgreSQL. Initial editable project snapshot bodies may be stored as compressed filesystem objects with their metadata and hashes in PostgreSQL. PostgreSQL JSONB remains suitable for small structured settings and manifests.

### Website Design Assets

Design/build-time assets are inputs selected while authoring the site, including:

- logos
- hero images
- gallery images
- icons
- site fonts
- illustrations
- background media
- images explicitly added to the website through Revyme

These assets should normally become part of the generated website repository:

```text
site-repository/
├── app/
├── components/
├── public/
│   └── uploads/
│       ├── hero.webp
│       ├── logo.svg
│       ├── gallery/
│       └── fonts/
├── package.json
├── Dockerfile
└── ...
```

When a Revyme website is published:

1. The control plane freezes the selected editable project revision.
2. The deployment worker materialises every design asset required by that revision.
3. Assets are placed under a stable static path such as `public/uploads`.
4. Generated source and assets are committed together to the site's Git repository.
5. The Docker image built from that Git SHA contains the corresponding immutable design assets.

Reverting to an older Git revision therefore restores both the site source and the design assets for that release.

### Runtime / CMS Uploads

Runtime uploads are mutable data created after an image has been built. Examples include:

- an editor uploading CMS media after deployment
- a visitor uploading a document
- application-generated media
- other user-generated content

Runtime files must not exist only in a running container's writable layer. An initial deployment may use persistent per-site host storage:

```text
/srv/og-sites/<site-id>/uploads-runtime/
```

mounted into the container at a stable path such as:

```text
/app/public/uploads-runtime
```

Public URLs may still use `/uploads/...`, provided reverse-proxy or application routing clearly avoids collisions between immutable build assets and mutable runtime assets.

```text
BUILD/DESIGN ASSETS
    → Git-versioned
    → stored in site repository
    → included in Docker image

RUNTIME/CMS UPLOADS
    → persistent per-site storage
    → mounted into disposable containers
    → backed up separately from Docker images
```

S3-compatible storage or a CDN may be introduced later, but is not required for the first proof of concept.

### Collaboration Service

Collaboration should be phased:

1. Server-side persistent projects establish a shared authoritative source.
2. Workspace permissions allow safe shared project access without simultaneous editing.
3. Realtime collaboration adds WebSockets and a suitable CRDT or synchronization layer such as Yjs.

Realtime collaboration is not required for the first deployment proof of concept. Optimistic revision checking is required before shared editing is enabled.

### Deployment Worker

The deployment worker is privileged but tightly constrained. It is a separate process or service from the ordinary control-plane request handler.

Responsibilities:

- accept an immutable project revision and authorized deployment request
- materialise complete generated website source
- materialise the correct design/build assets
- operate only on the assigned site's repository and workspace
- create and push deployment commits
- obtain and record the Git SHA
- build images from that Git revision
- run health checks
- perform blue/green route swaps
- stop old containers after successful cutover
- update deployment state
- perform rollback

The worker treats Git as the durable deployment boundary. It must never deploy an arbitrary uncommitted working tree and attempt to create history afterwards.

```text
materialise site
    → validate output
    → Git commit
    → Git push
    → record Git SHA
    → build Docker image from that SHA
    → deploy
```

The ordinary control-plane API must not expose an unrestricted Docker socket, shell, or filesystem path to browser requests.

### Git

Each website receives one repository, for example:

- `charlie-orange-gray/chaz-photography`
- `charlie-orange-gray/chaz-music`
- `charlie-orange-gray/client-acme`
- `charlie-orange-gray/client-example`

Suggested branches:

```text
main
    = currently approved production source revision

staging
    = latest successfully requested staging source revision
```

Deployment commits represent meaningful Publish events rather than individual visual changes. Repositories contain the complete generated deployable website source, versioned design/build assets, and deployment-relevant files.

Git provides:

- source history
- immutable design-asset history
- deployment revision identity
- an independent third-party backup and version history
- rollback references
- release-to-release diffs
- independently cloneable and buildable site source

Every deployment is identified by its Git SHA. Production promotion should fast-forward `main` to the approved staging SHA wherever possible so the source revision remains identical. A merge strategy that creates a different source commit must not silently substitute that new SHA for the tested staging revision.

### Docker

Every website image is associated with a specific Git SHA, for example:

```text
client-acme:a93d51f
```

Prefer a fully qualified immutable image reference and full SHA in deployment records, for example `registry.example/og/client-acme:a93d51f...` plus its image digest.

The image contains:

- generated application source or build output
- immutable design/build assets
- required application runtime dependencies

It must not contain required mutable runtime or CMS data exclusively in its writable layer.

### Reverse Proxy

Nginx is the initial reverse proxy. It owns:

- TLS termination
- domain routing
- builder and API routing
- staging routing
- production routing
- graceful blue/green target switching

The platform should represent routing as desired state so Nginx can later be replaced by Caddy, Traefik, or another proxy without changing editor behavior.

## 4. Authoritative Project Flow

```text
Browser
    → OG Builder
    → Control Plane API
    → authoritative server project snapshot
```

The editable Revyme project must no longer live only in browser local storage. Closing one browser and signing in from another workstation must expose the same project.

Editable project state is distinct from published Git state:

```text
SERVER PROJECT SNAPSHOT
    = current editable Revyme design and project state

Publish transforms a frozen server snapshot into:

SITE GIT REPOSITORY
    = complete generated deployable Next.js website at meaningful revisions

Docker build transforms one Git revision into:

DOCKER IMAGE
    = immutable running artifact identified by that Git SHA
```

PostgreSQL and server snapshot storage are authoritative for drafts. Git is authoritative for published website source revisions. Docker is the execution artifact, not the source of truth.

## 5. Draft Workflow

```text
visual edit
    → mutation queue
    → debounced autosave
    → server project snapshot
```

Draft save behavior:

- no Git commit
- no Docker build
- no site deployment
- frequent, lightweight, revision-checked saves
- visible save status and actionable conflict/error state

Git must not accumulate thousands of commits for editor mutations. A draft becomes Git history only when a meaningful Publish freezes and materialises it.

## 6. Site Repository Creation

On the first staging Publish:

```text
identify authorized project and site
    → allocate or connect assigned GitHub repository
    → initialise repository metadata
    → freeze server project revision
    → materialise generated Next.js project
    → include required design assets
    → validate generated output
    → create initial staging commit
    → push staging branch
    → obtain and record Git SHA
    → deploy from that SHA
```

Future Publishes update the same repository. Each Revyme project references one assigned site/repository record. Repository creation must be idempotent: retries must discover and reuse the existing assignment rather than create duplicate repositories.

## 7. Staging Publish Workflow

When the user presses **Deploy Staging**:

1. Flush pending editor mutations.
2. Run Revyme publish preflight.
3. Flush autosave and verify success.
4. Freeze the current authoritative server project revision.
5. Create a deployment request referencing that immutable revision.
6. Materialise complete Next.js source into an isolated build workspace.
7. Materialise all required design/build assets into the generated site.
8. Validate paths, generated output, dependencies, and required files.
9. Update the site's staging Git working tree.
10. Commit source and versioned design assets to the staging branch.
11. Push the staging branch to GitHub.
12. Resolve and record the resulting Git SHA.
13. Build the Docker image strictly from that Git revision.
14. Tag the image with the Git SHA and record its digest.
15. Start a new inactive staging container or slot.
16. Run health checks against the new container.
17. Switch the staging route only after health checks pass.
18. Record deployment metadata and return the staging URL.

Required ordering:

```text
NO Docker deployment
    before successful Git commit + push + recorded SHA
```

Failure behavior:

- Git commit or push failure stops deployment; existing staging remains active.
- Docker build failure leaves existing staging active.
- Container startup or health failure leaves existing staging active.
- Route-switch failure preserves the existing route where possible and records the failure.
- Retrying the same deployment request must be idempotent and must not create ambiguous duplicate release records.

## 8. Production Publish Workflow

Production never rebuilds from the latest editable draft. It promotes an approved staging deployment.

```text
approved staging deployment
    → select exact staging Git SHA and image digest
    → fast-forward/promote that exact revision to main
    → verify main identifies the intended source
    → reuse the exact tested image when available
    → otherwise reproduce strictly from the same Git SHA
    → start inactive production slot
    → health check
    → atomically or gracefully switch traffic
    → mark deployment active
    → stop old container after successful cutover
```

A production deployment record always maps to:

- Git repository
- Git SHA
- Docker image tag and digest
- frozen project revision
- deployment timestamp
- target node and slot

The previous successful image remains available according to the retention policy.

## 9. Blue/Green Deployment Model

Each production site has two logical slots: `BLUE` and `GREEN`.

If `BLUE` is live:

1. `BLUE` continues serving traffic.
2. The new release is already durably stored in GitHub.
3. Build or retrieve the Git-SHA-tagged image.
4. Start it in `GREEN` with the site's persistent runtime-upload mount.
5. Health check `GREEN` directly.
6. Switch traffic to `GREEN` only after success.
7. Mark `GREEN` active and `BLUE` inactive.
8. Stop and remove the old `BLUE` container after successful cutover.
9. Retain the previous successful `BLUE` image for rollback.

The next release reverses the slots. A failed new container never replaces a healthy live container.

Containers are disposable; images are versioned artifacts. A reasonable initial image-retention policy keeps:

- the current successful image
- the previous successful image
- several additional recent successful images

Older unused images may be pruned by a separate retention job, never during the critical cutover path.

## 10. Rollback Model

Every production deployment records:

- site and project ID
- frozen project snapshot ID
- Git repository
- Git SHA
- Docker image tag and digest
- timestamp and deploying user
- previous deployment ID
- health state
- target web node and slot

Rollback performs:

```text
select previous successful deployment
    → identify exact Git SHA and image digest
    → reuse retained image when available
    → otherwise rebuild strictly from historical Git SHA
    → start release in inactive slot
    → health check
    → switch traffic
    → record rollback as a new deployment event
```

Rollback does not depend on reconstructing an old editable Revyme state. Git is the durable source for historical published revisions.

## 11. Hosting and Deployment Nodes

The builder/control plane and websites may run:

- on one Linux server
- on separate VPSs
- across multiple deployment nodes

The editor never needs to know where a site is physically hosted. A site record may contain:

- assigned deployment node
- staging and production domains
- Git repository identifier
- current staging and production Git SHAs
- active staging and production slots

The control plane authorizes and schedules deployment jobs. A constrained deployment agent on the assigned node performs local image/container/proxy operations and reports status.

## 12. Initial Single-Server Architecture

The initial proof of concept may run entirely on CHAZ's Debian server:

```text
Debian
├── OG Builder
├── Control Plane API
├── PostgreSQL
├── server project snapshots
├── design-asset source storage
├── runtime upload storage
├── deployment worker
├── Docker
├── Nginx
├── CHAZ photography site
└── CHAZ music-business site
```

GitHub remains external and stores each website repository and published version history. Every published revision therefore has an off-server source copy even if the Debian server is lost.

## 13. Agency Multi-VPS Architecture

```text
Control Plane VPS
├── OG Builder
├── Control Plane API
├── PostgreSQL
├── authentication
├── workspace/collaboration services
└── deployment controller

Web Node 1
├── constrained deployment agent
├── site containers
└── per-site persistent runtime uploads

Web Node 2
├── constrained deployment agent
├── site containers
└── per-site persistent runtime uploads

Web Node N
├── constrained deployment agent
├── site containers
└── per-site persistent runtime uploads
```

The deployment database maps each site to its assigned node. Publishing behavior from the editor remains identical regardless of site location. GitHub remains the durable source and version history across all nodes.

## 14. Personal Proof-of-Concept Environment

The first real-world validation uses:

- CHAZ's Debian server
- CHAZ photography website
- CHAZ music-business website

Photography proof:

```text
Revyme edit
    → server autosave
    → staging Publish
    → GitHub repository update
    → recorded Git SHA
    → Docker staging deployment
    → staging URL approval
    → production promotion
    → production site
    → second Publish
    → blue/green swap
    → successful rollback
```

Repeat the same flow with the music-business website. Do not optimize prematurely for 70–80 sites before these two sites work end to end.

## 15. Agency Target

The future target is approximately 70–80 managed websites. Before agency rollout, require:

- authentication
- workspace permissions
- backups and restore testing
- monitoring and alerting
- deployment queues
- build and deployment isolation
- audit logs
- domain and TLS automation
- container resource limits
- off-host backups and disaster recovery
- multi-node support
- security review
- runtime upload backup strategy
- GitHub organization and repository policy
- container and image retention policy

## 16. Storage Layout

Recommended initial Linux layout:

```text
/srv/og-platform/
├── projects/
│   └── <project-id>/
│       ├── snapshots/
│       └── assets/
├── build-workspaces/
├── deployment-cache/
└── backups/

/srv/og-sites/
├── photography/
│   └── uploads-runtime/
├── music/
│   └── uploads-runtime/
├── site-a/
│   └── uploads-runtime/
└── ...
```

`/srv/og-platform/projects` stores editable server-side Revyme project snapshots and source design assets if filesystem materialisation is used.

Generated website repositories contain immutable design assets:

```text
site-repo/
└── public/
    └── uploads/
        └── immutable design assets
```

`/srv/og-sites/<site>/uploads-runtime` stores mutable runtime uploads. Do not duplicate immutable design assets into persistent runtime storage without a clear requirement, and never keep mutable runtime data solely in disposable container layers.

Build workspaces must use validated identifiers and dedicated directories. They are temporary and may be removed after the associated Git commit, image, and deployment record are durable.

## 17. Repository Layout

### `og-builder`

Modified Revyme frontend responsible for:

- visual editing
- self-hosted capability integration
- project and workspace frontend
- publishing and deployment UI
- API clients

### Future `og-control-plane`

Responsible for:

- project persistence
- authentication and workspaces
- immutable project snapshots
- Git orchestration
- deployment orchestration
- deployment records
- node assignment
- rollback requests

The privileged deployment worker may begin in this repository as a separately deployed package/process, but its runtime identity and permissions remain separate from the API.

### Future `og-site-template`

A shared Next.js deployment baseline may be introduced if useful. It may contain:

- standard Dockerfile
- health endpoint conventions
- production configuration
- common dependency baseline

Do not force generated Revyme sites into this template if Revyme's generated structure is already the better deployable baseline.

### Individual Website Repositories

Examples: `chaz-photography`, `chaz-music`, and `client-acme`.

Each repository contains:

- generated Next.js source
- site-specific source and configuration
- immutable design/build assets
- deployment-relevant files
- meaningful deployment history

Each repository must be independently cloneable and buildable without access to transient deployment workspaces.

## 18. Security Boundaries

- The browser never receives GitHub deployment credentials.
- The browser never receives Docker or deployment-node access.
- The builder never receives unrestricted shell access.
- The deployment worker runs under a constrained service identity.
- The Docker socket is never exposed to the browser or an untrusted/general API route.
- Secrets are never committed to repositories or embedded in generated site source.
- Site builds run in isolated, resource-limited environments.
- Project names, IDs, paths, repository identifiers, branch names, domains, and image tags are validated against traversal and injection.
- Git operations use an allowlisted organization/repository assignment from the database, not browser-provided filesystem or remote URLs.
- Published containers run with minimal privileges, read-only roots where practical, dropped capabilities, and explicit writable mounts.
- Project and editor permissions are checked server-side on every read and write.
- Mutable uploads are isolated per site and backed up independently.
- Deployment workers operate only on assigned site paths, repositories, and nodes.
- Control-plane-to-agent requests are authenticated, scoped, replay-resistant, and auditable.
- Logs and API errors must not expose tokens, credentials, environment secrets, or signed URLs unnecessarily.

## 19. Upstream Revyme Strategy

Upstream repository: https://github.com/revyme-web/builder.git

```text
upstream/main
    = Revyme source of improvements

origin/main
    = stable Orange & Gray fork baseline

feature/*
    = Orange & Gray feature development

chore/sync-upstream-YYYY-MM-DD
    = isolated upstream integration branches
```

Fetch and assess upstream before substantial new development. Never merge upstream directly into an active feature branch without an isolated sync and validation step.

Orange & Gray additions should remain behind:

- backend adapters
- capability interfaces
- new modules
- API clients
- contained UI seams

Avoid canvas, parser, JSX/runtime, responsive-layout, mutation, code-generation, and CMS internal changes unless a narrowly demonstrated requirement cannot be met at an existing boundary.

## 20. Current Implementation Status

Implemented:

- `feature/self-hosted-publish-ui` contains a self-hosted publishing capability seam.
- `PUBLISH_ENABLED` permits self-hosted Publish controls without enabling Revyme Cloud authentication, billing, marketplace, collaboration, persistence, or hosted services.
- Self-hosted Vite development can proxy same-origin `/api/*` requests to `VITE_API_URL`.
- The feature includes `.nvmrc` for Node `22.23.2`.
- The minimal nested `@swc/helpers@0.5.23` lockfile correction is validated.
- `chore/sync-upstream-2026-09-09` integrates Revyme upstream through `b3ed3d9`.
- Upstream publish preflight and the self-hosted capability seam auto-merge cleanly in `RightHeader.tsx`.
- Sync validation passed `npm ci`, TypeScript, 10,274 tests, the editor production build, `git diff --check`, and scoped `RightHeader.tsx` lint with zero errors.

Not implemented:

- production authentication and workspace administration
- per-site Git repository orchestration
- Docker build or deployment
- staging/production promotion
- blue/green routing
- deployment history or rollback
- realtime collaboration

Current upstream integration is local only and has not been pushed or merged into `origin/main`.

The local Phase 1/2 implementation provides authoritative self-hosted project persistence, content-addressed design assets, frozen revision manifests, and deterministic temporary website-tree materialization in `og-control-plane`. Phase 3 now adds a minimal Publish API that freezes and materializes an exact staging revision, records `sites`, `deployments`, and `deployment_events`, and ends at `ready-for-git`. It does not create Git repositories, commit/push sites, or run Docker.

## 21. Implementation Roadmap

### Phase 0 — Maintainable Upstream-Compatible Fork

Maintain capability seams, backend boundaries, validation, and routine upstream synchronization.

### Phase 1 — Server Project Persistence

Persist complete editable Revyme projects on Orange & Gray infrastructure and prove cross-browser continuity.

### Phase 2 — Design Asset Materialisation and Runtime Upload Strategy

Store source design assets durably, freeze exact project revisions, materialise immutable assets into generated sites, and establish separate persistent runtime upload paths. The local proof uses project-scoped content-addressed objects and deterministic temporary trees; runtime/CMS upload APIs remain future work.

### Phase 3 — Minimal Publish API

Freeze a project revision and create an auditable deployment request without yet exposing infrastructure credentials to the editor. The local implementation accepts the expected saved revision, derives authorization from the session, reuses a stable site record and idempotent deployment request, materializes the frozen tree, records its deterministic manifest hash, and ends at `ready-for-git`; it never reports a deployment as live.

### Phase 4 — Per-Site Git Repository Creation/Integration

Assign or create one independent repository per website.

### Phase 5 — Git Staging Publish

```text
project revision
    → generated Next.js site
    → design assets
    → staging Git commit
    → GitHub push
    → Git SHA
```

### Phase 6 — Docker Staging

```text
Git SHA
    → Docker image
    → new staging container
    → health check
    → staging route swap
```

### Phase 7 — Production Promotion

```text
approved staging SHA and image
    → main
    → inactive production slot
    → health check
    → blue/green production swap
```

### Phase 8 — Deployment History and Rollback

Track successful and failed deployments and allow safe rollback by recorded Git SHA and image.

### Phase 9 — Authentication and Workspaces

Enforce user, workspace, membership, and project roles server-side.

### Phase 10 — Realtime Collaboration

Add WebSockets and CRDT/synchronization only after persistence and authorization are stable.

### Phase 11 — Monitoring, Backups, and Agency Hardening

Add queues, observability, backup/restore, resource limits, multi-node support, and security controls.

### Phase 12 — Optional Integrations

Add CMS, analytics, experimentation, AI, and MCP integrations only when the core platform is reliable.

## 22. Explicit Non-Goals for Initial Proof of Concept

The initial proof does not require:

- multi-region infrastructure
- Kubernetes
- realtime collaboration
- external CDN
- object storage
- automated billing
- public multi-tenant SaaS
- 80-site capacity testing

The first proof prioritises:

- server persistence
- Git-backed publishing
- Docker deployment
- blue/green safety
- rollback
- two real personal websites

## 23. Architecture Decisions

### ADR-001 — Maintain a Thin Revyme Fork

**Decision:** Keep Orange & Gray changes at adapters, capability gates, API clients, and isolated UI seams.

**Rationale:** Revyme continues to improve upstream; minimizing internal divergence reduces sync risk.

**Consequence:** Some integrations require small compatibility layers rather than the shortest one-off edit.

### ADR-002 — Use a Separate Control Plane

**Decision:** Put persistence, authorization, publishing, and deployment orchestration in `og-control-plane`, not `og-builder`.

**Rationale:** Infrastructure authority and credentials do not belong in a browser application.

**Consequence:** Editor features depend on a versioned API contract and explicit capability configuration.

### ADR-003 — Server Is the Editable-Project Source of Truth

**Decision:** In self-hosted mode, Orange & Gray server snapshots are authoritative for editable projects.

**Rationale:** Projects must survive browser closure and be available from another machine.

**Consequence:** Autosave requires durable writes, revision checks, error handling, and server authorization.

### ADR-004 — One Independent Git Repository per Published Website

**Decision:** Each website has its own repository.

**Rationale:** Each site needs independent history, cloning, access policy, deployment identity, and rollback.

**Consequence:** The control plane manages repository assignment and idempotent creation per site.

### ADR-005 — Publish Commits and Pushes Git Before Deployment

**Decision:** No deployment proceeds until the generated site is committed, pushed, and identified by a Git SHA.

**Rationale:** Git is the durable release boundary and independent source history.

**Consequence:** Git failure stops the release while the existing deployment remains active.

### ADR-006 — Git Records Meaningful Deployment Snapshots

**Decision:** Draft editor mutations are not Git commits; staging Publishes are.

**Rationale:** Human-usable release history is more valuable than mutation noise.

**Consequence:** Draft history and collaboration revisions remain in server project storage, separate from site Git history.

### ADR-007 — Version Design Assets with Generated Websites

**Decision:** Materialise immutable design/build assets into the site repository and image.

**Rationale:** A historical source revision must render with its corresponding assets.

**Consequence:** Publish needs deterministic asset collection, hashing, and path mapping.

### ADR-008 — Persist Mutable Runtime Uploads Outside Containers

**Decision:** Store runtime/CMS uploads on persistent per-site storage or a future object store.

**Rationale:** Disposable container replacement must not destroy mutable content.

**Consequence:** Runtime uploads require separate backup, isolation, and serving rules from build assets.

### ADR-009 — Use Immutable Git-SHA-Tagged Docker Images

**Decision:** Build images from concrete Git SHAs and record tags and digests.

**Rationale:** Deployment identity and reproducibility require an immutable source-to-image mapping.

**Consequence:** Never reuse a mutable tag as the sole deployment reference.

### ADR-010 — Use Blue/Green Deployment

**Decision:** Start and health check a new slot before switching traffic.

**Rationale:** A failed release must not replace a healthy live site.

**Consequence:** Each site needs slot state, health checks, proxy switching, and cleanup logic.

### ADR-011 — Promote the Exact Tested Staging Artifact

**Decision:** Production uses the approved staging SHA and preferably the identical image digest.

**Rationale:** Regenerating from a newer draft invalidates staging approval.

**Consequence:** Promotion APIs reference deployment IDs, not “latest project.”

### ADR-012 — Retain Previous Successful Images

**Decision:** Keep the previous successful image and several recent successful images.

**Rationale:** Fast rollback should not depend on a rebuild.

**Consequence:** A deliberate retention and pruning policy is required.

### ADR-013 — Support Single-VPS and Multi-VPS Deployment

**Decision:** Keep the same logical control-plane/deployment-node model for one server and many nodes.

**Rationale:** The proof of concept should evolve without changing editor behavior or release identity.

**Consequence:** Even the initial worker should use explicit site/node assignments rather than global assumptions.

### ADR-014 — Validate on Two Personal Websites First

**Decision:** Prove the complete workflow on CHAZ photography and music-business sites before agency rollout.

**Rationale:** Two real sites expose practical persistence, asset, domain, deployment, and rollback issues early.

**Consequence:** Agency-scale optimization waits until both proofs pass end to end.

## 24. Self-Hosted Project Persistence Design

### Repository and Runtime

Use a future repository named `og-control-plane`.

Recommended initial stack:

- Node.js 22 LTS and TypeScript
- Hono on the Node runtime for a small HTTP layer compatible with Revyme's current API style
- Zod or equivalent schemas at every request boundary
- PostgreSQL with explicit SQL migrations and a lightweight typed query layer
- structured JSON logging and request IDs
- OpenAPI generated from the validated contract
- a separate worker process/package for future deployment jobs

Hono minimizes impedance with Revyme's existing cloud-shaped API without importing Revyme Cloud behavior. Fastify would also be viable, but using one small TypeScript runtime and preserving current wire conventions reduces initial integration cost.

### Initial API Contract

All identifiers are opaque UUIDs or similarly strong server-generated IDs. All writes require an authenticated session or an explicit development-only server mode.

```text
POST /api/projects
Request:  { workspaceId, name }
Response: { projectId, workspaceId, name, revision: 0, createdAt }

GET /api/projects?workspaceId=<id>
Response: { projects: ProjectSummary[] }

GET /api/projects/:projectId
Response: {
  projectId,
  workspaceId,
  name,
  revision,
  snapshot: ProjectData,
  contentHash,
  updatedAt
}

PUT /api/projects/:projectId
Headers:  If-Match: "<revision>"
Request:  {
  baseRevision,
  idempotencyKey,
  snapshot: ProjectData
}
Response: {
  projectId,
  revision,
  contentHash,
  savedAt
}

PATCH /api/projects/:projectId
Request:  { name, baseRevision? }
Response: { projectId, name, revision, updatedAt }

POST /api/projects/:projectId/frozen-revisions
Request:  { expectedRevision, reason: "staging-publish" }
Response: { snapshotId, revision, contentHash, createdAt }
```

The frozen-revision endpoint is implemented in the local Phase 2 proof. It freezes an already saved project revision and records the exact asset manifest; it does not generate Git or Docker state. Materialization produces an isolated complete tree and deterministic manifest hash without mutating the editable snapshot.

Phase 3 adds `POST /api/projects/:projectId/publish` and the compatibility alias
`POST /api/websites/:projectId/publish`. The request contains
`{expectedRevision, environment:"staging"}` and may include an
`Idempotency-Key`. The control plane derives the workspace and role from the
session, creates or reuses a stable site, freezes the exact revision, runs
deterministic materialization, and records a deployment plus ordered events.
Successful preparation returns the deployment ID, frozen revision ID,
project revision, and materialization hash with status `ready-for-git`.
`GET /api/deployments/:deploymentId` retrieves the status for an authorized
workspace member. This boundary intentionally performs no Git, Docker, or
production operation and never claims the site is live.

For a low-risk editor migration, `SelfHostedBackend` may initially expose compatibility calls under `/api/websites/:id` if that avoids UI changes. The canonical control-plane domain model should still call these records projects/sites internally rather than inheriting Revyme Cloud billing or hosting assumptions.

### Initial PostgreSQL Tables

`users`:

- `id`
- `email`
- `display_name`
- `status`
- timestamps

`workspaces`:

- `id`
- `name`
- timestamps

`workspace_memberships`:

- `workspace_id`
- `user_id`
- `role` (`owner`, `editor`, `viewer` initially)
- timestamps
- unique `(workspace_id, user_id)`

`projects`:

- `id`
- `workspace_id`
- `name`
- `format`
- `current_revision`
- `current_snapshot_id`
- `created_by`
- timestamps
- optional soft-delete timestamp

`project_snapshots`:

- `id`
- `project_id`
- monotonic `revision`
- `parent_revision`
- `content_hash`
- `storage_key`
- `byte_size`
- `format`
- `reason` (`autosave`, `manual-save`, `publish-freeze`, `migration`)
- `created_by`
- `created_at`
- unique `(project_id, revision)`
- unique `(project_id, content_hash)` where deduplication is appropriate

`project_assets`:

- `id`
- `project_id`
- `content_hash`
- `storage_key`
- original filename
- MIME type
- byte size
- logical/public path where applicable
- immutable/design versus runtime classification
- timestamps

`audit_events`:

- `id`
- actor ID
- workspace and project IDs where applicable
- event type
- small structured metadata
- timestamp

Site and deployment tables are introduced in the Publish model below. Large snapshot bodies and binary assets live in filesystem/object storage; PostgreSQL stores their identity, ownership, hashes, and locations.

### Server Filesystem Layout

```text
/srv/og-platform/projects/<project-id>/
├── snapshots/
│   ├── 00000001-<sha256>.json.gz
│   ├── 00000002-<sha256>.json.gz
│   └── ...
└── assets/
    └── objects/
        └── <sha256>
```

Snapshot and asset writes use a server-created temporary file in the same filesystem, validate size and hash, fsync where required, and atomically rename into the content-addressed location. Browser-provided filenames never determine server paths.

The initial Node.js 22 implementation uses its stable built-in gzip codec (`.json.gz`) instead of the originally proposed Zstandard extension. Compression is a storage detail; content identity is computed from the canonical uncompressed project payload. A later codec change must preserve existing snapshot readability and hashes.

### Project Snapshot Format

The editor currently persists `ProjectData` with `format`, `files`, and optional settings. Keep that payload compatible and place it inside a server envelope:

```json
{
  "schemaVersion": 1,
  "projectId": "uuid",
  "revision": 42,
  "parentRevision": 41,
  "createdAt": "ISO-8601",
  "createdBy": "user-id",
  "contentHash": "sha256:...",
  "project": {
    "format": "revyme-v1",
    "files": {
      "app/page.tsx": "...",
      "app/globals.css": "..."
    },
    "settings": {}
  },
  "designAssets": [
    {
      "assetId": "uuid",
      "contentHash": "sha256:...",
      "logicalPath": "public/uploads/hero.webp"
    }
  ]
}
```

Canonical hashing uses a documented deterministic representation: sorted file paths, exact UTF-8 file contents, normalized manifest ordering, and an explicit schema version. The envelope metadata is not included in the content hash unless specified by the hashing version.

### Save and Load Semantics

Load:

1. Authenticate the caller.
2. Authorize workspace/project read access.
3. Load the current project row and snapshot metadata.
4. Read and verify the snapshot object hash.
5. Return `ProjectData`, current revision, and content hash.
6. `SelfHostedBackend` loads the files into the existing in-memory `ProjectFS` through the normal `ProjectLoader` path.

Save:

1. Autosave flushes the current `ProjectFS` into the existing `ProjectData` shape.
2. `SelfHostedBackend` sends the full snapshot plus `baseRevision` and an idempotency key.
3. The server validates authorization, project format, file paths, limits, and snapshot schema.
4. The server computes the deterministic content hash.
5. If the content is unchanged, it returns the current revision without creating noise.
6. Otherwise it writes the snapshot object and transactionally inserts a revision and advances `projects.current_revision` only when the expected base revision still matches.
7. The editor records the returned revision and shows saved status.

The first proof may use complete snapshots rather than mutation deltas. This fits the existing backend interface and gives deterministic recovery. Delta storage can be considered later only after correctness and size measurements justify it.

### Concurrency and Version Checks

Use optimistic concurrency:

- every load returns `revision`
- every save supplies `baseRevision` and `If-Match`
- the database advances only when `current_revision = baseRevision`
- stale saves return `409 Conflict` with the current server revision and content hash
- idempotency keys make retries of the same payload safe

Do not silently use last-write-wins across browsers. Before realtime collaboration, a stale client should pause autosave, preserve its local snapshot, and ask the user to reload or create a recoverable conflict copy. Realtime CRDT collaboration may later replace this coarse conflict workflow.

### Authentication Placeholders

The proof may use an explicit server-only development authentication mode with one seeded user and workspace. It must be impossible to enable accidentally in production.

The API contract should still use a session abstraction from day one:

- secure, HTTP-only session cookie
- server-derived actor ID
- workspace membership checks
- CSRF protection appropriate to deployment topology
- no trust in browser-supplied user or workspace ownership headers

Authentication implementation may be deferred, but authorization call sites and ownership columns should not be.

### `SelfHostedBackend` Integration

Do not mutate or rename `LocalBackend`. Add `SelfHostedBackend` beside it, implementing the existing `ProjectBackend` interface so the established `ProjectLoader`, `ProjectFS`, and autosave paths remain the integration boundary.

The first adapter can preserve the current interface signatures. Internally, `SelfHostedBackend` records the revision and ETag returned by `loadProject`, supplies them on `saveProject`, and replaces its cached value only after a successful save. Its public `saveProject(): Promise<void>` resolves after the new server revision has been accepted. A stale write throws a typed conflict error carrying the current server revision and content hash; the autosave coordinator can then stop retries, preserve the unsaved local snapshot, and present recovery choices.

Project creation/listing and deployment operations should use separate, typed control-plane clients rather than expanding `ProjectBackend` into an all-purpose platform interface. If the editor later needs revision details during ordinary editing, introduce a small versioned-persistence capability rather than adding self-hosted environment checks to consumers.

The eventual selection should be capability/provider-based:

```text
Revyme Cloud capability
    → RevymeBackend

self-hosted persistence capability
    → SelfHostedBackend

neither capability
    → LocalBackend
```

Resolve that provider once at startup from validated configuration. Existing Revyme Cloud selection retains precedence for existing cloud deployments; an invalid combination should be diagnosed at startup rather than allowing scattered components to interpret flags differently. Publish availability and project persistence are separate capabilities: enabling a Publish button must not implicitly replace the persistence provider.

`LocalBackend` keeps localStorage and single-user standalone behavior. `RevymeBackend` keeps existing Revyme Cloud routes and behavior. `SelfHostedBackend` maps the same `loadProject`, `saveProject`, rename, role, workspace, and asset methods to Orange & Gray APIs. It may initially return safe proof-of-concept defaults only where a capability is intentionally unavailable, but must not impersonate Revyme Cloud billing, credits, marketplace, or hosted services.

Autosave should depend on backend capabilities rather than raw environment checks. In particular, unload-safe saving should move behind an adapter method or transport capability so cloud and self-hosted backends can each provide their correct beacon/keepalive behavior while local mode remains synchronous. This is a narrow backend-boundary change, not a canvas, mutation, parser, or runtime rewrite.

### Persistence Proof of Concept

The first phase passes only when it demonstrates:

1. Create a project on the server.
2. Open and edit it in Revyme.
3. Observe successful autosave to Linux/server storage.
4. Close the browser.
5. Open a separate browser profile or another machine.
6. Authenticate through the placeholder/session boundary.
7. Load the same server project.
8. Continue editing and save a new revision.

This phase contains no Git repository creation, Git commits, Docker builds, or deployment.

### Persistence Test Strategy

Unit tests:

- snapshot schema validation and path rejection
- deterministic content hashing
- unchanged-save deduplication
- optimistic revision success and conflict paths
- idempotency-key replay
- workspace authorization
- atomic snapshot storage adapter
- `SelfHostedBackend` wire mapping and error behavior

Integration tests:

- API plus PostgreSQL plus temporary filesystem
- project create/save/load across distinct sessions
- concurrent stale save returns `409` without data loss
- interrupted write never advances the project row
- missing/corrupt snapshot object is detected
- design-asset manifest remains associated with the revision

Editor tests:

- backend selection truth table
- standalone still selects `LocalBackend`
- cloud still selects `RevymeBackend`
- self-hosted mode selects `SelfHostedBackend` only
- autosave status and retry behavior
- load into existing `ProjectLoader`/`ProjectFS` path
- conflict UI preserves unsaved local work

End-to-end test:

- create, edit, autosave, close, reopen from a second browser context, load, and continue editing

### Future Publish Determinism

Although persistence does not implement publishing, each snapshot must contain or reference everything later required to deterministically materialise:

- complete `ProjectData.files`
- the snapshot format and hashing version
- immutable design-asset identities and hashes
- project/site linkage
- repository assignment metadata through the site record
- the exact frozen snapshot ID used for Publish

Editable project snapshots remain distinct from generated website Git commits. A Publish record links the two without treating either as a replacement for the other.

## 25. Publish and Deployment Metadata Model

### Minimum Website Metadata

The future control plane needs a `sites` record containing or referencing:

- project ID
- workspace ID
- site name
- GitHub repository identifier (`owner/repository` or provider installation plus repository ID)
- staging branch, initially `staging`
- production branch, initially `main`
- current staging Git SHA
- current production Git SHA
- staging domain
- production domain
- target deployment node
- active production slot (`BLUE` or `GREEN`)
- active staging slot if staging also uses blue/green
- current Docker image tag and digest
- previous successful Docker image tag and digest
- validated runtime upload path
- staging and production deployment timestamps

Avoid storing GitHub tokens in this row. Store only a reference to a server-side installation/secret identity.

### Recommended Tables

`sites`:

- `id`
- `project_id` unique
- `workspace_id`
- `name`
- `git_repository_id`
- `staging_branch`
- `production_branch`
- `staging_domain`
- `production_domain`
- `deployment_node_id`
- `current_staging_deployment_id`
- `current_production_deployment_id`
- `active_staging_slot` nullable
- `active_production_slot`
- `runtime_upload_path`
- timestamps

`git_repositories`:

- `id`
- provider
- provider repository ID
- owner/organization
- repository name
- default branch
- server-side credential/installation reference
- created/connected timestamps

`deployment_nodes`:

- `id`
- stable name
- agent endpoint or queue identity
- status and last heartbeat
- capability metadata
- timestamps

`deployments`:

- `id`
- `site_id`
- `environment` (`staging`, `production`)
- `action` (`deploy`, `promote`, `rollback`)
- frozen `project_snapshot_id`
- Git repository ID
- Git SHA
- Git branch
- Docker image tag
- Docker image digest
- target node ID
- target slot (`BLUE`, `GREEN`, or staging slot)
- status (`queued`, `materialising`, `pushing`, `building`, `starting`, `healthy`, `switching`, `active`, `failed`, `superseded`)
- previous deployment ID
- requested by user ID
- request, start, health, activation, failure, and finish timestamps
- failure stage and sanitized error summary

`deployment_events`:

- `id`
- deployment ID
- sequence number
- event type
- small structured metadata
- timestamp

`domains` may be separate when one site can have aliases or domain-verification/TLS state.

### PostgreSQL Versus Git

PostgreSQL contains operational platform metadata:

- identity and authorization
- editable project revision metadata
- site-to-repository assignment
- branches and domains
- deployment intent and status
- Git SHAs and image digests
- node and slot assignments
- timestamps, health results, audit events, and rollback links

Git contains the actual published website artifact source:

- generated Next.js source
- immutable design/build assets
- dependency manifests and lockfiles
- Dockerfile and deployment-relevant build files
- meaningful release history

Git does not contain:

- platform session data
- database credentials
- GitHub credentials
- deployment-node secrets
- mutable runtime uploads
- transient build logs

PostgreSQL does not replace Git as published source history, and Git does not replace PostgreSQL as operational deployment state.

### Required Cross-Layer Identity

Every successful staging or production deployment must be traceable through:

```text
workspace_id
    → project_id
    → project_snapshot_id + revision + content_hash
    → site_id + git_repository_id
    → git_sha
    → docker_image_tag + docker_image_digest
    → deployment_id + environment + node + slot
```

This chain is the basis for reproducibility, audit, promotion, and rollback.
