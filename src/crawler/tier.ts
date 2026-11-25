/**
 * Listing tier resolution for connectors. Mirrors the Wallet Catalog crawler
 * (resolveWalletCatalogTier / resolveWalletCatalogListingDepth): an explicit value on the
 * connector (stamped by the WordPress export) wins, otherwise the organization's value is inherited.
 */

export interface OrganizationTierFields {
  catalogTier?: string;
  catalogListingDepth?: string;
}

function nonEmpty(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

export function resolveConnectorCatalogTier(
  connector: { catalogTier?: unknown },
  organization: OrganizationTierFields | undefined,
): string | undefined {
  return nonEmpty(connector.catalogTier) ?? nonEmpty(organization?.catalogTier);
}

export function resolveConnectorCatalogListingDepth(
  connector: { catalogListingDepth?: unknown },
  organization: OrganizationTierFields | undefined,
): string | undefined {
  return nonEmpty(connector.catalogListingDepth) ?? nonEmpty(organization?.catalogListingDepth);
}
