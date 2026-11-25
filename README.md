# FIDES Wallet Connector Catalog

Catalog of issuer and verifier connector products that integrate applications with digital wallets.

## Commands

```bash
npm install
npm run validate
npm test
npm run crawl
npm run migration-report
npm run build
```

The crawler validates source JSON against the v1 schema and checks Organization Catalog and Wallet Catalog references before writing the aggregate and WordPress snapshot.

See [the contract](docs/CONTRACT.md) for product-boundary and reference rules.

## GitHub Actions configuration

The `wp-submissions-sync` workflow needs this repository configuration (not stored in the repo):

- Actions variable `WP_EXPORT_URL`: WordPress export endpoint URL.
- Actions secret `WP_INVALIDATE_SECRET`: shared secret for the WordPress export/invalidate endpoints.
