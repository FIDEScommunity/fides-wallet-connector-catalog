# Organizational wallet migration dry run

Generated from `/Users/victorvanderhulst/Projects/wallet-catalog/data/aggregated.json` at 2026-11-24T13:45:06.320Z.

This report is diagnostic only. It does not modify Wallet Catalog source data. The candidate rule is `type=organizational` and no explicit `holder` capability; classification is never inferred as a migration approval.

## Summary

- Candidates: 22
- Manually reviewed exceptions: 4
- Pending source review: 18
- Automatic migrations approved: 0

## Decisions

| Source wallet ID | Organization | Classification | Target connector ID | Uncertainty | Review | Reason |
| --- | --- | --- | --- | --- | --- | --- |
| affinidi-portal | org:affinidi | manual-review | — | high | pending | Issuer/verifier signals exist, but product boundaries and Holder behavior require source review. |
| auth0-platform | org:auth0 | manual-review | — | high | pending | Issuer/verifier signals exist, but product boundaries and Holder behavior require source review. |
| credebl-organizational-wallet | org:ayanworks | manual-review | — | high | pending | Holder is absent and available metadata is insufficient for an automatic product classification. |
| credissuer | org:ooru | manual-review | — | high | pending | Issuer/verifier signals exist, but product boundaries and Holder behavior require source review. |
| dalion-org-wallet | org:inetum | manual-review | — | high | pending | Issuer/verifier signals exist, but product boundaries and Holder behavior require source review. |
| didroom | org:forkbomb | manual-review | — | high | pending | Issuer/verifier signals exist, but product boundaries and Holder behavior require source review. |
| eudi-reference-issuer | org:eu | connector-only | eudi-reference-issuer | low | reviewed | Reference issuing backend has no Holder function and is represented in the connector catalog. |
| eudi-reference-verifier | org:eu | connector-only | eudi-reference-verifier | low | reviewed | Reference verifier backend has no Holder function and is represented in the connector catalog. |
| inji-certifier | org:mosip | manual-review | — | high | pending | Issuer/verifier signals exist, but product boundaries and Holder behavior require source review. |
| inji-verifier | org:mosip | manual-review | — | high | pending | Issuer/verifier signals exist, but product boundaries and Holder behavior require source review. |
| mattr-vii | org:mattr | manual-review | — | high | pending | Issuer/verifier signals exist, but product boundaries and Holder behavior require source review. |
| orbit-enterprise | org:northernblock | manual-review | — | high | pending | Issuer/verifier signals exist, but product boundaries and Holder behavior require source review. |
| paradym-platform | org:animo | manual-review | — | high | pending | Issuer/verifier signals exist, but product boundaries and Holder behavior require source review. |
| procivis-one | org:procivis | hybrid-one-product | procivis-one | medium | reviewed | Description identifies a business wallet that holds and presents credentials, while the same product also exposes issuer and verifier functions. |
| scytales-eu-reference-wallet | org:scytales | manual-review | — | high | pending | Issuer/verifier signals exist, but product boundaries and Holder behavior require source review. |
| sicpa-digital-trust-suite | org:sicpa | manual-review | — | high | pending | Issuer/verifier signals exist, but product boundaries and Holder behavior require source review. |
| snapkyc | org:ooru | manual-review | — | high | pending | Issuer/verifier signals exist, but product boundaries and Holder behavior require source review. |
| swiyu-generic-issuer | org:swiyu | manual-review | — | high | pending | Issuer/verifier signals exist, but product boundaries and Holder behavior require source review. |
| swiyu-generic-verifier | org:swiyu | manual-review | — | high | pending | Issuer/verifier signals exist, but product boundaries and Holder behavior require source review. |
| truvera-platform | org:docklabs | manual-review | — | high | pending | Issuer/verifier signals exist, but product boundaries and Holder behavior require source review. |
| veres-wallet | org:digitalbazaar | manual-review | — | high | pending | Issuer/verifier signals exist, but product boundaries and Holder behavior require source review. |
| yourd-business-wallet | org:yourd | wallet-only | — | low | reviewed | Description explicitly says the product issues, holds, and verifies credentials; missing holder capability is a wallet data-quality issue. |

## Migration gate

Only rows marked `reviewed` may inform a later source-data change. Connector-only removal from Wallet Catalog, Holder capability corrections, and hybrid `walletRef` records require separate reviewed changes in their source repositories.
