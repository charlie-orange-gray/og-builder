# Framer-MCP → Revyme-MCP migration agent architecture

Status: design only. This document does not implement a migration agent, access
the live Framer site, create a new website, or change deployment infrastructure.

The future agent will treat Framer MCP as a source of observations and Revyme
MCP as the destination mutation boundary. It must use the supported Revyme
project and editor interfaces wherever they exist; it must not edit generated
deployment output, Docker layers, Git repositories, or runtime files.

## Current Revyme MCP surface

The inventory below is based on the synchronized agent implementation in
`src/ai/agent/*` (upstream `eac700d`) plus the external MCP bridge in
`src/ai/mcp/bridge-client.ts`. The native agent is the preferred extension
point; the bridge exposes the same live editor state to an external MCP client.

| Area | Supported operations | Boundary and gaps |
| --- | --- | --- |
| Project creation | Project identity/provisioning remains editor/backend-owned; native tools can create branches, pages, templates, components, CMS scaffolds, and project skills | No MCP `create_project`; provisioning remains a control-plane/backend concern. |
| Pages and nested routes | `list_pages`, `create_page`, `duplicate_page`, `rename_page`, `delete_page`, `create_template`, `assign_template`, `create_collection_pages` | Route groups preserve URL paths; route collisions and redirects still need planning/review. |
| Components and variants | `list_components`, `get_component`, `create_component`, `extract_component`, instances/props, `create_variant`, `set_variant`, visibility, connections, slots | Code components and unsupported Framer component contracts need review; `apply_file_edit` is the guarded last resort. |
| Styles/design tokens | `get_design_tokens`, `set_styles`, `set_layout`, `set_size_units`, `set_pseudo_style`, `create_token`, `set_token`, `set_dark_token`, typography presets | Writes route through the agent workspace/mutation queue; protected builder metadata remains guarded. |
| Text/content | `get_node`, `set_text`, `set_rich_text`, `set_text_on_breakpoint`, `set_attr`, `set_link`, `translate_texts`, `translate_attribute` | Bespoke code/content expressions remain oracle- and review-gated. |
| Assets and media | `find_assets`, `upload_image`, `create_icon_set`, icons, `set_background_video`, image attributes | Authenticated asset upload is supported; video hosting/licensing and unsupported media formats remain review items. |
| CMS | `cms_get_collection`, collection/field/item CRUD, references, `cms_set_item_translation`, list binding/configuration, pagination, row links, collection pages | Use CMS tools rather than raw JSON; localized content stays on one logical row. |
| Metadata/SEO | `get_seo`, `set_page_metadata`, `set_site_metadata` cover title, description, Open Graph, Twitter/X, canonical, robots, favicon, social image and requested custom head/body code | Structured data, arbitrary scripts, and policy-sensitive custom code still require review. |
| Responsive layouts | `list_viewports`, `add_viewport`, `set_viewport_width`, `remove_viewport`, viewport-scoped styles, per-breakpoint reorder/text/visibility, screenshots | Recreate source breakpoints in Revyme's viewport dialect; preserve builder-owned `@canvas` metadata. |
| Interactions and motion | `set_page_variable`, `set_page_interaction`, variants/connections, motion tools, page transitions, smooth scroll, background video | Framer-specific gestures, code overrides, timers, and external integrations require custom work or review. |
| Save and isolation | `agent.manifest`, `agent.run_start`, `agent.tool_call`, `agent.run_end`; turn checkpoints, branch isolation, oracle validation, autosave flush and Changes card | External bridge calls are attributed to the same agent run/undo boundary; no direct database writes. |
| Publish | `publishListing` remains marketplace-only; site staging/production publish remains editor/control-plane driven | Migration stops at a saved, verified project and hands off to the existing deployment workflow. |

The new native agent has a typed Zod manifest (`ALL_TOOLS`), a remote provider
turn stream, a per-run checkpoint, branch/workspace isolation, bounded leases,
structured tool results, screenshot/observation epochs, capability fixtures,
and a visual Changes card. The external bridge exposes that manifest and run
lifecycle through `agent.manifest`, `agent.run_start`, `agent.tool_call`, and
`agent.run_end`, while retaining the legacy `revyme_*` context/file/CMS tools.
All writes still pass through the editor mutation queue, oracle, stale-write
guards, and autosave boundary. This makes the native agent the preferred
migration extension point rather than a second custom mutation system.

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
