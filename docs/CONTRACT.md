# Wallet Connector Catalog contract

The Wallet Connector Catalog describes products that integrate relying-party and issuer backends with wallets. It is a role/integration projection, not a replacement for the Wallet Catalog.

## Product boundary

- Keep products with Holder functionality in Wallet Catalog.
- Put products without Holder functionality that issue or verify through wallet protocols in this catalog.
- Represent one hybrid product in both catalogs and set `walletRef.walletCatalogId` on its connector record.
- Model separate products from one provider independently; sharing an `orgId` does not imply that they are the same product.
- Never migrate solely because an organizational wallet lacks the `holder` capability. Treat that as an audit candidate.

## References

- `orgId` must exist in Organization Catalog.
- `walletRef.walletCatalogId` must identify an organizational wallet with the same `orgId`.
- `walletCompatibility` may contain only IDs of personal wallets.
- Connector IDs are globally unique.
- `qeaa_provider` requires Organization Catalog QTSP evidence containing the `QEAA` trust-service code.

The crawler enforces these rules before writing `data/aggregated.json`.

## Taxonomies

Shared wallet taxonomies retain their canonical field names and values: `vcFormat`, `issuanceProtocols`, `presentationProtocols`, `interoperabilityProfiles`, `credentialStatusMethods`, `deploymentModel`, `openSource`, `license`, and `status`.

Connector-specific fields are:

- `connectorFunctions`: `issuer`, `verifier`
- `backendIntegrations`: `oidc_oauth2`, `saml2`, `rest_api`, `webhooks`, `server_sdk`, `other`
- `frontendIntegrations`: `hosted_ui_redirect`, `headless_api`, `frontend_sdk`, `web_component`, `other`
- `serviceModels`: `software_only`, `managed_verification`, `managed_issuance`
- `certificateManagement`: `provider_managed`, `customer_managed`, `both`
- `eidasRoles`: `rp_intermediary`, `eaa_provider`, `qeaa_provider`

“EUDI Wallet Connector” is derived from `interoperabilityProfiles` containing `EUDI Wallet ARF`; it is not stored as a source boolean.
