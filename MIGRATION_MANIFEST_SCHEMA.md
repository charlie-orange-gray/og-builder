# Migration manifest schema

The migration manifest is a versioned, resumable record shared by discovery,
mapping, execution, visual verification, and manual review. It contains no
credentials or access tokens. The manifest is an orchestrator artifact, not a
replacement for Revyme project persistence or deployment history.

## Canonical shape

```yaml
schemaVersion: 1
migrationId: mig_<stable-id>
source:
  platform: framer
  siteId: <source-site-id>
  sourceRevision: <source-revision-or-timestamp>
  inventoryHash: sha256:<hash>
  capturedAt: 2026-09-28T00:00:00Z
destination:
  platform: revyme
  projectId: <project-id>
  baseRevision: 0
  currentRevision: 0
  branchId: <optional-agent-branch>
startedAt: 2026-09-28T00:00:00Z
completedAt: null
status: planned # planned | running | review | blocked | verified | failed
pages:
  - id: page_<stable-id>
    sourceId: <framer-page-id>
    sourcePath: /about
    targetPath: /about
    targetFile: app/about/page.client.tsx
    dependsOn: [component_<id>, cms_<id>]
    status: pending
    visualChecks: []
    notes: []
components:
  - id: component_<stable-id>
    sourceId: <framer-component-id>
    targetFile: components/Hero.tsx
    variants: []
    status: pending
    inputHash: sha256:<hash>
    outputHash: null
assets:
  - id: asset_<stable-id>
    sourceUrl: <redacted-or-public-url>
    contentHash: sha256:<hash>
    targetAssetUrl: null
    status: pending
cms:
  collections:
    - id: cms_<stable-id>
      sourceId: <framer-collection-id>
      targetSlug: blog_posts
      fields: []
      items: []
      status: pending
seo:
  - id: seo_<stable-id>
    pageId: page_<stable-id>
    title: null
    description: null
    canonical: null
    openGraph: {}
    twitter: {}
    robots: {}
    status: pending
redirects:
  - id: redirect_<stable-id>
    from: /old-about
    to: /about
    kind: permanent
    status: review
manualReview:
  - id: review_<stable-id>
    stepId: page_<stable-id>
    category: unsupported-primitive
    severity: blocking
    reason: <specific evidence and proposed action>
    evidence: []
    decision: null
unsupported:
  - sourceId: <id>
    category: custom-code
    reason: <why no safe target exists>
operations: []
```

## Operation record

Every mutation or verification appends an operation record:

```yaml
- id: op_<stable-id>
  stepId: component_<stable-id>
  tool: create_component
  inputHash: sha256:<normalized-input>
  sourceEpoch: <Framer-observation-epoch>
  destinationRevisionBefore: 12
  destinationRevisionAfter: 13
  filesTouched: [components/Hero.tsx]
  result: applied # planned | applied | skipped | blocked | failed
  outputHash: sha256:<result>
  screenshots: [artifacts/hero/1440.png]
  retryCount: 0
  error: null
  createdAt: 2026-09-28T00:00:00Z
```

Operation IDs and normalized input hashes make retries idempotent. A resumed
run must re-read the destination revision and source observation epoch before
replaying a failed operation. If either changed, it creates a new review item
instead of overwriting newer work.

## Visual-check record

```yaml
visualChecks:
  - id: visual_<stable-id>
    pageId: page_<stable-id>
    viewport: { width: 1440, height: 900, deviceScaleFactor: 1 }
    sourceScreenshot: artifacts/source/home-1440.png
    targetScreenshot: artifacts/target/home-1440.png
    geometryScore: 0.98
    typographyScore: 0.96
    colorScore: 0.99
    imageScore: 1.0
    responsiveScore: null
    overallScore: 0.97
    status: pass # pass | retry | review
    discrepancies:
      - kind: spacing
        selectorOrNode: hero-title
        expected: 48px top offset
        actual: 56px top offset
        action: adjust via set_styles
```

Representative widths are 1440, 1024, 768, and 390 unless the source
inventory proves different breakpoints. Screenshots are deterministic: fixed
viewport, device scale, font readiness, asset readiness, and a bounded render
settling window. The score is evidence, not a promise of literal pixel parity.

## Resume and completion rules

- A step can be `verified` only after its Revyme save completed and required
  visual/semantic checks passed.
- A blocking manual-review item blocks dependent steps but not independent ones.
- `completedAt` is set only when no pending, failed, blocked, or unresolved
  review item remains.
- The manifest records Revyme project revisions and tool results, while Git,
  Docker, staging, production, and rollback lineage remain in the existing
  control-plane deployment records.
