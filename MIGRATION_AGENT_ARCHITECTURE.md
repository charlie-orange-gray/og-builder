# Framer-MCP → Revyme-MCP migration agent architecture

Status: design only. This document does not implement a migration agent, access
the live Framer site, create a new website, or change deployment infrastructure.

The future agent will treat Framer MCP as a source of observations and Revyme
MCP as the destination mutation boundary. It must use the supported Revyme
project and editor interfaces wherever they exist; it must not edit generated
deployment output, Docker layers, Git repositories, or runtime files.

## Current Revyme MCP surface

The inventory below is based on builder main `99909fc` and the implementation in
`src/ai/mcp/bridge-client.ts`, `src/ai/page-agent/*`, and
`src/ai/cms-agent/*`.

| Area | Supported operations | Boundary and gaps |
| --- | --- | --- |
| Project creation | Project identity is supplied by the editor/backend; the bridge can create pages, templates, and CMS scaffolds | No explicit MCP `create_project` operation. Project provisioning remains a control-plane/backend concern. |
| Pages | `getContext`, `listFiles`, `readFile`, `create_page`, `create_pages`, `create_template`; page-agent tree and node mutations | Page creation is supported; initial project bootstrap is not an MCP operation. |
| Components | Context/list/read, validated file submission, node mutations, variants and connections, marketplace share/insert, icon-set creation | `edit_file` is an escape hatch and must remain last resort. |
| Styles/design tokens | `get_design_tokens`, `managePresets` list/set/remove/set_typography, `add_preset_token`, `update_preset_token`, `update_node_styles` | `globals.css` is protected; token operations use the editor's preset mutations. |
| Text/content | `update_node_text`, structured node edits, `read_file`/`submit_files`, translations, CMS item values | Rich bespoke code may require manual review. |
| Assets | `uploadImage`/`revyme_upload_asset`, authenticated backend asset upload, `createIconSet` | Uploads require a non-local project and the editor's quota/auth boundary. |
| CMS | Collection/schema/item CRUD, field types, per-item translations, CMS index/detail page scaffolds | Use CMS ops, not raw collection JSON. Localized content stays in `_i18n` on one row. |
| Metadata/SEO | Read/write of supported project files through the oracle where allowed | No first-class SEO/meta MCP tool is currently exposed. Unsupported metadata is a manual-review item, never an unvalidated overwrite. |
| Responsive layouts | Viewport context, design tokens and responsive typography tiers; style/node mutation tools; `@canvas` viewport metadata is protected | No Framer auto-layout importer. Recreate each target viewport and preserve builder-owned viewport metadata. |
| Interactions | `add_appear`/`remove_appear`, `add_hover`/`remove_hover`, `add_loop`/`remove_loop`, variants and connections | Effects outside the supported motion/variant model require manual review. |
| Save | Bridge mutations use the normal mutation queue and/or `submitFiles`, then force autosave and await `flushSaveNow` | Save is an editor/backend operation, not a direct database write. |
| Publish | `publishListing` publishes marketplace listings only; the site Publish seam is editor/control-plane driven | No site deployment publish MCP operation. The migration agent must stop at a saved project and hand off to the existing deployment workflow. |

The bridge is intentionally a development bridge. It exposes context, reads,
asset upload, presets, translations, CMS, icon sets, marketplace helpers and
validated file submission. `submitFiles` is guarded by the same oracle and
stale-write checks as the in-editor freeform loop. Page-agent tools are thin
wrappers around the same validated mutation queue used by the human editor.

## Principles and guardrails

1. **Source of truth:** Framer MCP observations are source records. Revyme's
   project state, revision, and saved files are the destination records.
2. **Supported writes first:** Prefer structured Revyme tools, then the bridge
   file interface when a supported file edit is required. Do not write the
   generated deployment tree.
3. **Read before write:** Every file submitted must be credited by a prior
   context/read operation. Reject stale or changed source snapshots and retry
   from fresh context.
4. **Small, idempotent batches:** Each manifest step has a stable operation ID,
   input hash, destination revision, and compensating action where possible.
5. **Human control:** Ambiguity, unsupported primitives, destructive changes,
   low visual confidence, or authentication failures create a manual-review
   item and pause the affected step.
6. **No credential leakage:** Framer tokens, GitHub App keys, installation
   tokens, and deployment credentials stay in their existing server-side secret
   stores and never enter the manifest, screenshots, prompts, or generated code.

## Agent phases

### 1. Discovery and inventory

Use Framer MCP read operations to enumerate the source site without mutating it:
pages/routes, shared components, component variants, style variables, fonts,
CMS collections/items, assets, metadata, redirects, breakpoints, interactions,
and representative screenshots at every source viewport. Assign stable source
IDs and capture source revision/timestamp hashes.

The inventory records both what exists and what is unsupported. For example,
Framer-specific layout primitives, code overrides, forms, analytics scripts,
and custom interactions must be classified before any destination write.

### 2. Data-model mapping

Normalize the inventory into a canonical intermediate model. Map:

- routes and layouts to Revyme pages and route-group templates;
- shared Framer components to `components/<PascalCase>.tsx` design components;
- style variables to Revyme preset/design-token families;
- text nodes to `data-id` nodes and, where appropriate, translation keys;
- collections, fields, references, and items to Revyme CMS schema/items;
- image/file assets to authenticated Revyme asset uploads;
- breakpoints to the project's existing viewport bands;
- links and redirects to a redirect plan rather than silently changing routes.

Every mapping carries confidence, assumptions, source evidence, and a review
policy. No low-confidence mapping may be applied automatically.

### 3. Shared component migration

Migrate tokens and shared primitives before pages. Create or update one
component at a time, validate its tree and variants, and make it available to
page steps only after a successful render at all target viewports. Preserve
component boundaries instead of flattening everything into page-local markup.

Use structured component/node tools for editable design components. Use
`submit_files` only for a complete supported component file after reading the
current file and passing the oracle. Keep imports, `data-id` values, canvas
metadata, and builder-owned comments intact.

### 4. Page and template migration

Create route-group templates and pages with the supported `create_template`,
`create_page`, and CMS page operations. Populate the page tree through node
mutations where possible. Map source content to stable `data-id` values and
record the mapping in the manifest so reruns update the same nodes rather than
duplicating them.

Navigation links are resolved against the route inventory. Missing or external
targets are queued for review. A page is not considered complete until its
desktop, tablet, and mobile render checks pass.

### 5. CMS migration

Create collections, fields, references, and items through the CMS MCP tools.
Validate field IDs and reference targets before inserting items. Preserve one
item per logical record; localized values belong in `_i18n[locale][field]` via
`set_item_translation`, not duplicated locale rows or ad-hoc language fields.
Create index/detail pages through the CMS page scaffolds and then apply only
the page-specific supported mutations.

### 6. SEO and metadata

Inventory title, description, canonical URL, robots directives, Open Graph,
Twitter cards, structured data, and per-route metadata. Use a first-class
Revyme metadata interface if one is added before implementation. Until then,
read and edit only files explicitly allowed by the Revyme oracle and queue all
other metadata for manual review. Never assume that a Framer field maps to a
Next.js metadata export without checking the target project's conventions.

### 7. Asset migration

Deduplicate by source URL/content hash, download through the controlled source
connector, and upload through `revyme_upload_asset`. Record the returned asset
URL and content hash in the manifest. Keep immutable design assets in the
project/image layer; do not place migration state or runtime uploads in the
generated deployment output.

### 8. Redirects

Produce a complete old-path → new-path table, including trailing-slash,
localized, query, and removed-page cases. Detect collisions and loops before
applying anything. Redirect implementation is a separate reviewed step; a
missing redirect is never silently treated as a successful page migration.

### 9. Responsive recreation

Capture source screenshots and layout measurements for every source breakpoint.
Map them to existing Revyme viewport bands, preserving builder-owned `@canvas`
metadata. Apply style changes with node/style/token tools and use responsive
typography token tiers where appropriate. Do not rewrite or remove existing
viewport entries; additive viewport changes require explicit review.

### 10. Interaction recreation

Translate supported scroll-appear, hover, loop, variant, and connection
behaviour using the page-agent tools. Verify that every interactive target
variant has a connection and that responsive-only variants are not incorrectly
treated as interaction states. Queue unsupported Framer code overrides,
gestures, timers, or external integrations for manual implementation.

### 11. Screenshot and visual-regression loop

For each page and viewport:

1. render the Revyme preview at the matching dimensions;
2. capture a screenshot and compare it with the source using a stable viewport,
   font-loading, and asset-loading harness;
3. compute pixel/perceptual deltas plus a semantic checklist (route, text,
   links, images, CMS bindings, and interactions);
4. apply one bounded correction batch through supported interfaces;
5. re-render and retain both before/after evidence in the manifest.

Set explicit thresholds for automatic acceptance. Exceeding a threshold,
missing fonts/assets, or a changed page structure creates a manual-review item.

## Migration manifest

The manifest is the resumable contract between discovery, planning, execution,
and review. It is versioned separately from the project and contains no
secrets. A representative shape is:

```yaml
manifestVersion: 1
source:
  provider: framer-mcp
  siteId: <source-id>
  revision: <source-revision>
  inventoryHash: sha256:<hash>
destination:
  provider: revyme-mcp
  websiteId: <website-id>
  baseRevision: <project-revision>
  targetRevision: <project-revision>
steps:
  - id: component.hero
    kind: shared-component
    sourceIds: [<framer-component-id>]
    target: components/Hero.tsx
    operation: create-or-update
    inputHash: sha256:<hash>
    status: pending # pending | applied | blocked | review | verified
    confidence: 0.94
    evidence: [inventory/component-hero.json, screenshots/hero-mobile.png]
    destinationRevision: null
    visualChecks: []
    reviewItems: []
  - id: page.home
    kind: page
    sourceIds: [<framer-page-id>]
    target: app/(Body)/page.client.tsx
    dependsOn: [component.hero]
    status: pending
redirects: []
manualReview: []
```

Each applied step records the Revyme project revision, files touched, operation
IDs, source/destination hashes, screenshot references, and any rollback note.
The agent must be able to resume after a failed request without repeating a
successful upload or duplicating a page/component.

## Manual-review queue

Queue, with a reason and suggested action, at least these cases:

- no Revyme equivalent for a Framer primitive or code override;
- ambiguous component/page/CMS mapping or duplicate route;
- unsupported or protected metadata file;
- missing font, asset, external embed, form action, or analytics integration;
- redirect collision, loop, or removed route;
- visual-regression delta above threshold;
- interaction without a supported motion/variant/connection mapping;
- stale destination revision, oracle rejection, auth failure, or save failure;
- destructive operation such as deleting an existing page, collection, field, or
  asset reference.

Review records include source evidence, proposed destination change, risk,
blocking status, reviewer, decision, and the manifest step to resume. A blocked
item prevents dependent steps but does not discard already verified work.

## Execution and handoff

The agent should run in a controlled session with a project revision preflight,
bounded retries, and an append-only audit trace. It should call the supported
Revyme MCP bridge/page-agent/CMS operations, wait for autosave completion, and
re-read context after every batch. It may report that the project is ready for
the existing Publish UI/control-plane workflow, but it must not call GitHub,
Docker, Nginx, or production promotion directly.

Rollback is a project-revision or deployment decision owned by the existing
platform workflow. The migration agent's responsibility ends with a saved,
verified Revyme project plus its manifest, screenshots, and manual-review queue.

## Non-goals for this phase

- no Framer-MCP connection or live-site access;
- no migration execution;
- no new Revyme MCP tools or platform features;
- no direct edits to generated deployment output;
- no new repository, DNS, deployment, or production changes.
