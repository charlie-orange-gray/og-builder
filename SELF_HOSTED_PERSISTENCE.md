# Local server persistence proof

This proof uses `SelfHostedBackend` with a separate `og-control-plane` service, real PostgreSQL, and server snapshot files. Standalone and Revyme Cloud retain their existing providers. Publishing and persistence are independent capabilities.

## Start the proof

Use Node 22.23.2. The sibling service must exist at `/Users/chaz/og-control-plane` and have its dependencies installed:

```sh
cd /Users/chaz/og-control-plane
npm ci
npm run dev:local
```

The local development launcher starts an isolated PostgreSQL process, applies migrations, and serves the API at `127.0.0.1:8090`. Its ignored `.data` directory persists across restarts. It does not install a system database service. See the service README for storage and port overrides.

In another terminal:

```sh
cd /Users/chaz/builder
npm ci
VITE_REVYME_CLOUD=false VITE_SELF_HOSTED_PERSISTENCE=true VITE_SELF_HOSTED_PUBLISH=false VITE_API_URL=http://127.0.0.1:8090 npx vite --port 4334 --strictPort
```

Start the canvas sandbox in another terminal if it is not already running:

```sh
cd /Users/chaz/builder
npx vite --config vite.sandbox.config.ts
```

Open `http://localhost:4334`, start the development session, and create a project. Draw a frame in the editor and wait for Saved. Close the browser context, open a separate browser profile, start a development session there, and open the same project from the list. Edit again and wait for Saved.

## Automated proof

```sh
cd /Users/chaz/builder
npm run test:persistence
```

The dedicated Playwright configuration starts its API on port 8091, PostgreSQL on 55433, editor on 4334, and canvas sandbox on 5174. Its database and snapshots live under the service's ignored `.data/phase1-proof-v1` directory. It uses independent browser contexts and drives actual frame creation through pointer and keyboard events. It verifies persisted project contents through the API and checks that project data was not written into browser localStorage. The second context reloads the first edit, makes another edit, and reloads again. The test records project/revision identifiers and a screenshot. Separate cases verify that a missing server project cannot open the editor or autosave, and that a stale browser can download its unsaved work without overwriting the newer server revision.

The test requires the sibling service dependencies and Playwright Chromium. It creates test projects in the local development database; it does not delete user projects or reset that database.

Validated on 2026-09-09: all three browser cases passed against real PostgreSQL 18.4. The JSON report at `test-results/persistence-report.json` includes the first/second revision evidence; screenshots show the reloaded canvas and recoverable stale-browser conflict. These generated artifacts are ignored by Git.

## Persistence contract and recovery

Loads establish a project revision. Saves include that revision, an `If-Match` header, and an idempotency key. The server serializes writes per project and rejects stale revisions with `409 Conflict`. A response lost after commit can be recovered by replaying the exact original request. A failed load keeps the editor blocked.

When a conflict is reported, autosave pauses and preserves the local project. Download the local snapshot before explicitly reloading the server version. Closing a page while a versioned save is outstanding triggers the browser's leave warning; a queued beacon is not treated as a successful save.

Uploaded design files are embedded as durable data URLs in this first snapshot proof. A dedicated asset store and deterministic publishing materialization remain subsequent work. This phase does not implement Git site publishing, Docker deployment, or Debian hosting.

## Development authentication boundary

The seeded session is for local development only. The API checks session identity, workspace membership, write permissions, and allowed request origin on the server. Production refuses the development authentication bypass. Real user authentication and Debian deployment need their own implementation and validation before this service is exposed publicly.
