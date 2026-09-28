# Framer → Revyme migration capability matrix

This is a readiness matrix for the synchronized upstream agent (`eac700d`).
It describes what a future migration orchestrator may automate through the
Revyme native agent/MCP interfaces. It does not claim Framer parity or authorize
access to a real site.

Legend:

- **NATIVE** — a Revyme tool and validated write path exist.
- **TRANSLATABLE** — the concept maps to supported Revyme primitives, but the
  orchestrator must transform source data and verify the result.
- **CUSTOM IMPLEMENTATION REQUIRED** — platform-specific code or an explicit
  adapter is needed before automatic migration.
- **MANUAL REVIEW REQUIRED** — an operator must approve the mapping or content.
- **UNSUPPORTED** — no safe destination contract exists yet.

| Source capability | Status | Revyme evidence / intended handling | Boundary |
| --- | --- | --- | --- |
| Pages | NATIVE | `list_pages`, `create_page`, `duplicate_page`, `rename_page`, `delete_page` | Home-page deletion is refused; destructive changes require explicit approval. |
| Nested routes / route groups | TRANSLATABLE | `create_template`, `assign_template`, route-group page paths | Framer nesting and URL semantics must be mapped; redirects are a separate plan. |
| Shared components | NATIVE | `list_components`, `create_component`, `extract_component`, instances and props | Code components may need a custom contract. |
| Component variants | NATIVE | `create_variant`, `set_variant`, `set_variant_visibility`, `add_connection`, `remove_connection` | Unsupported state axes or interactions enter review. |
| Breakpoints | NATIVE | `list_viewports`, `add_viewport`, `set_viewport_width`, `remove_viewport` | Preserve builder-owned viewport metadata; never delete the primary band. |
| Design tokens | NATIVE | `get_design_tokens`, `create_token`, `set_token`, `set_dark_token`, typography presets | Token naming/value conversion remains a mapping step. |
| Fonts | TRANSLATABLE | `set_font`, typography tools, generated font imports | Licensing, unavailable families, and local-font delivery require review. |
| Responsive typography | NATIVE | viewport-scoped `set_styles`, typography presets, `set_text_on_breakpoint` | Validate at representative widths. |
| Images | NATIVE | `find_assets`, `upload_image`, `set_attr`, image tools | Preserve source/content hashes and alt text in the manifest. |
| Video | TRANSLATABLE | `set_background_video`, media attributes | Hosting, autoplay, codec, poster, licensing, and accessibility need review. |
| Background media | TRANSLATABLE | background image/style tools and `set_background_video` | Framer-specific media effects may require a custom adapter. |
| CMS collections | NATIVE | `cms_create_collection`, `cms_add_field`, item CRUD, collection pages | Use CMS operations, never direct JSON replacement. |
| CMS references | NATIVE | reference/multi-reference fields and CMS list binding tools | Validate target collections and unresolved references. |
| Forms | NATIVE | `add_form_field`, `add_submit_button`, `set_form_destination`, form-state tools | Delivery providers, consent, spam policy, and field semantics require review. |
| SEO titles | NATIVE | `set_page_metadata`, `set_site_metadata`, `get_seo` | Preserve per-route copy; do not blindly copy site defaults. |
| Meta descriptions | NATIVE | `set_page_metadata` / `set_site_metadata` | Validate length, uniqueness, and language. |
| Canonical URLs | NATIVE | `set_page_metadata.canonical` | Domain and redirect assumptions must be reviewed. |
| Open Graph metadata | NATIVE | `set_page_metadata` / `set_site_metadata` `og_*` fields | Confirm image dimensions, accessibility, and asset ownership. |
| Twitter/X metadata | NATIVE | `set_page_metadata` `twitter_*` fields | Verify card type and fallback image behavior. |
| Structured data | MANUAL REVIEW REQUIRED | No dedicated structured-data tool; guarded file edit may be considered | Schema correctness and policy are too site-specific for blind translation. |
| Alt text | NATIVE | `set_attr` on image nodes and content mapping | Missing or decorative-image intent requires review. |
| Redirects | CUSTOM IMPLEMENTATION REQUIRED | Produce a reviewed redirect manifest for the control plane | No current native redirect mutation tool; do not silently rewrite paths. |
| Animations | TRANSLATABLE | motion tools, presets, `set_motion`, `set_motion_preset`, page transitions | Map only supported properties/timing; compare screenshots and behavior. |
| Scroll effects | TRANSLATABLE | motion/appear/viewport tools and `verify_effect` | Framer-specific effects may need custom implementation. |
| Interactions | TRANSLATABLE | page variables/interactions, variants/connections, links, overlays | Complex gestures, timers, and external actions require review. |
| Custom code | MANUAL REVIEW REQUIRED | `apply_file_edit` / overrides are guarded escape hatches | Never import arbitrary source code without oracle and security review. |
| Embeds | MANUAL REVIEW REQUIRED | May be represented as approved code/plugin/iframe work | Provider, sandbox, CSP, and privacy implications need review. |
| Analytics | MANUAL REVIEW REQUIRED | `set_site_metadata.custom_code_head/body` can carry explicitly approved code | Never invent or silently add tracking scripts. |
| Cookies / consent | CUSTOM IMPLEMENTATION REQUIRED | Requires an approved runtime/plugin and consent policy | Not a safe automatic metadata translation. |
| Localization | NATIVE | `set_locales`, `translate_texts`, `translate_attribute`, CMS item translations, language switcher | Keep one CMS row per logical item and record locale mappings. |
| Custom domains | CUSTOM IMPLEMENTATION REQUIRED | Deployment/control-plane/domain workflow, outside editor MCP | DNS and production configuration are explicitly out of scope here. |

## Decision rules

The orchestrator must refuse to mark a step `verified` when its status is
`MANUAL REVIEW REQUIRED`, `CUSTOM IMPLEMENTATION REQUIRED`, or `UNSUPPORTED`.
It may continue independent steps, but all dependent pages remain blocked. A
visual score cannot override a missing security, accessibility, redirect, or
data-integrity decision.

The native agent's `submit_plan`, `check_project`, `verify_effect`, and
`get_screenshot` tools are evidence and review aids; they do not grant
permission to bypass the oracle, branch isolation, autosave, or deployment
boundaries.
