=== FIDES Wallet Connector Catalog ===
Contributors: fidescommunity
Tags: wallet, connector, oid4vci, oid4vp, eudi
Requires at least: 6.4
Requires PHP: 8.0
Stable tag: 1.2.0
License: Apache-2.0

Searchable wallet connector catalog with shared modal, SSR, SEO, sitemap, query deeplinks, and pretty detail URLs.

== Description ==

Use `[fides_wallet_connector_catalog]` to render the listing. Shared SSR and SEO require FIDES Community Tools Tiles with the catalog SSR master switch enabled.

Supported deeplinks:

* `?connector=<id>`
* `/connector/<id>/`

== Changelog ==

= 1.2.0 =
* Listing: removed the "Official listings only" quick filter; the connector-specific filters (function, deployment, service model, backend/frontend integration, eIDAS role, status) now have (i) info buttons backed by new glossary terms (requires glossary vocabulary 1.14.0 from fides-interop-profiles for the new texts; bundled fallback updated).
* Modal (needs the matching shared modal library): the Business wallet accordion is replaced by a Business Wallet entry under Key capabilities that links to the wallet record; integration options, service model, deployment, status, eIDAS roles and certificate management link to the glossary.
* New optional Pro field `media` (videos and images, same shape and limits as the Wallet Catalog): schema, crawler, validation, tier rules (stripped for Community), submission/export, update form prefill and a Media section in both forms (image upload via the shared card-image endpoint).
* Forms: compatible personal wallets use a type-ahead field with removable chips (same pattern as the Use Case Catalog forms).

= 1.1.1 =
* Community/Pro listing tiers for connectors, mirroring the Wallet Catalog: Community listings cap the description at 200 characters and cannot publish website, documentation and repository (server-side enforcement on submit and export, tier-aware locks, hints and plan badge in both forms). Official and full Community listings keep all fields. Export stamps `catalogTier` / `catalogListingDepth`.
* Crawler inherits `catalogTier` and `catalogListingDepth` from the organization when the connector has none; the JSON schema accepts both fields.
* Community updates never copy the crawler's organization logo/website fallback into the connector's own data.
* Requires the shared `fides_catalog_tier_ui_enabled` switch and `Fides_Catalog_Org_Tier` / `org-tier` REST route from `fides-community-tools-tiles`.

= 1.1.0 =
* New shortcodes `[fides_wallet_connector_submit_form]` and `[fides_wallet_connector_update_form]` (same flow and UX as the Wallet Catalog forms) with all connector schema fields, conditional fields and server-side schema/cross-catalog validation.
* Submissions use the shared tiles submission core (`wallet-connector` type, review in wp-admin, GitHub export to `data/wp-export/wallet-connector.json`). Requires `fides-community-tools-tiles` with the submission registry.
* Adds a settings page for the update-form URL and the REST endpoint `fides-catalog/v1/wallet-connector/org-context`.

= 1.0.1 =
* SSR/noscript detail output now shows human-readable labels (e.g. SD-JWT VC, REST API, Hosted UI (redirect)) matching the interactive modal; unknown codes are humanized.

= 1.0.0 =
* Initial connector listing, filtering, shared modal, SSR/SEO registry, and deeplink support.
