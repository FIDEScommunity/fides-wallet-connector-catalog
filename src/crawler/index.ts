import fs from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import type {
  AggregatedConnector,
  AggregatedConnectorCatalog,
  AggregatedOrganization,
  WalletSummary,
  SourceConnectorCatalog,
} from '../types/connector.js';
import {
  type OrganizationEntry,
  type WalletEntry,
  validateCrossCatalogReferences,
} from './validation.js';
import { resolveConnectorCatalogListingDepth, resolveConnectorCatalogTier } from './tier.js';

const require = createRequire(import.meta.url);
const Ajv2020 = require('ajv/dist/2020.js').default;
const addFormats = require('ajv-formats').default;
const ROOT = process.cwd();
const SOURCE_DIR = path.join(ROOT, 'community-catalogs');
const OUTPUT_PATH = path.join(ROOT, 'data', 'aggregated.json');
const PLUGIN_OUTPUT_PATH = path.join(
  ROOT,
  'wordpress-plugin',
  'fides-wallet-connector-catalog',
  'data',
  'aggregated.json',
);
const FIRST_SEEN_PATH = path.join(ROOT, 'data', 'first-seen.json');
const ORGANIZATION_PATH =
  process.env.ORGANIZATION_CATALOG_AGGREGATED_PATH ||
  path.resolve(ROOT, '..', 'organization-catalog', 'data', 'aggregated.json');
const WALLET_PATH =
  process.env.WALLET_CATALOG_AGGREGATED_PATH ||
  path.resolve(ROOT, '..', 'wallet-catalog', 'data', 'aggregated.json');

function gitDate(filePath: string): string | null {
  try {
    const relative = path.relative(ROOT, filePath).split(path.sep).join('/');
    const value = execFileSync('git', ['log', '-1', '--format=%aI', '--', relative], {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    const date = value ? new Date(value) : null;
    return date && !Number.isNaN(date.getTime()) ? date.toISOString() : null;
  } catch {
    return null;
  }
}

/** Date of the first commit that added the file, or null outside git / before the first commit. */
function gitFirstDate(filePath: string): string | null {
  try {
    const relative = path.relative(ROOT, filePath).split(path.sep).join('/');
    const lines = execFileSync('git', ['log', '--diff-filter=A', '--format=%aI', '--', relative], {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    })
      .trim()
      .split('\n')
      .filter(Boolean);
    const date = lines.length ? new Date(lines[lines.length - 1]) : null;
    return date && !Number.isNaN(date.getTime()) ? date.toISOString() : null;
  } catch {
    return null;
  }
}

function walletSummary(wallet: WalletEntry): WalletSummary {
  return {
    id: wallet.id,
    name: wallet.name || wallet.id,
    ...(wallet.logo ? { logo: wallet.logo } : {}),
    ...(wallet.provider?.name ? { providerName: wallet.provider.name } : {}),
  };
}

async function readJson<T>(filePath: string): Promise<T> {
  return JSON.parse(await fs.readFile(filePath, 'utf8')) as T;
}

function organizationProjection(organization: AggregatedOrganization): AggregatedOrganization {
  return {
    id: organization.id,
    name: organization.name,
    ...(organization.country ? { country: organization.country } : {}),
    ...(organization.website ? { website: organization.website } : {}),
    ...(organization.logoUri ? { logoUri: organization.logoUri } : {}),
    ...(organization.catalogTier ? { catalogTier: organization.catalogTier } : {}),
  };
}

async function crawl(): Promise<void> {
  const schema = await readJson<Record<string, unknown>>(
    path.join(ROOT, 'schemas', 'wallet-connector-catalog.schema.json'),
  );
  const ajv = new Ajv2020({ allErrors: true, strict: true, strictRequired: false });
  addFormats(ajv);
  const validate = ajv.compile(schema);

  const organizationData = await readJson<{
    organizations?: Array<AggregatedOrganization & OrganizationEntry>;
  }>(ORGANIZATION_PATH);
  const walletData = await readJson<{ wallets?: WalletEntry[] }>(WALLET_PATH);
  const organizationsById = new Map(
    (organizationData.organizations || []).map((organization) => [organization.id, organization]),
  );
  const walletsById = new Map((walletData.wallets || []).map((wallet) => [wallet.id, wallet]));

  const directories = (await fs.readdir(SOURCE_DIR, { withFileTypes: true }).catch(() => []))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  const connectors: AggregatedConnector[] = [];
  const seenConnectorIds = new Map<string, string>();
  const errors: string[] = [];
  const firstSeenHistory: Record<string, string> = await readJson<Record<string, string>>(
    FIRST_SEEN_PATH,
  ).catch(() => ({}));
  const fetchedAt = new Date().toISOString();

  for (const directory of directories) {
    const filePath = path.join(SOURCE_DIR, directory, 'wallet-connector-catalog.json');
    let catalog: SourceConnectorCatalog;
    try {
      catalog = await readJson<SourceConnectorCatalog>(filePath);
    } catch {
      continue;
    }

    if (!validate(catalog)) {
      errors.push(`${filePath}: ${ajv.errorsText(validate.errors, { separator: '; ' })}`);
      continue;
    }

    const organization = organizationsById.get(catalog.orgId);
    if (!organization) {
      errors.push(`${filePath}: orgId ${catalog.orgId} does not exist in Organization Catalog`);
      continue;
    }

    for (const connector of catalog.connectors) {
      const previousPath = seenConnectorIds.get(connector.id);
      if (previousPath) {
        errors.push(`${filePath}: connector id ${connector.id} is already declared in ${previousPath}`);
        continue;
      }
      seenConnectorIds.set(connector.id, filePath);

      const referenceErrors = validateCrossCatalogReferences(
        connector,
        catalog.orgId,
        organization,
        walletsById,
      );
      if (referenceErrors.length) {
        errors.push(...referenceErrors.map((error) => `${filePath}#${connector.id}: ${error}`));
        continue;
      }

      const sourcePath = path.relative(ROOT, filePath).split(path.sep).join('/');
      const updatedAt = catalog.lastUpdated || gitDate(filePath) || fetchedAt;
      const logo = connector.logo || organization.logoUri || '';
      const website = connector.website || organization.website || '';
      // Tier: explicit connector value (WordPress export) first, else inherit from the organization.
      const catalogTier = resolveConnectorCatalogTier(connector, organization);
      const catalogListingDepth = resolveConnectorCatalogListingDepth(connector, organization);
      // Keep the first observation stable across crawls so "Added last 30 days" does not reset.
      const firstSeenAt =
        firstSeenHistory[connector.id] || gitFirstDate(filePath) || catalog.lastUpdated || fetchedAt;
      firstSeenHistory[connector.id] = firstSeenAt;
      const referencedWallet = connector.walletRef ? walletsById.get(connector.walletRef.walletCatalogId) : undefined;
      const compatibleWallets = (connector.walletCompatibility || [])
        .map((walletId) => walletsById.get(walletId))
        .filter((wallet): wallet is WalletEntry => Boolean(wallet))
        .map(walletSummary);
      connectors.push({
        ...connector,
        ...(referencedWallet ? { walletReference: walletSummary(referencedWallet) } : {}),
        ...(compatibleWallets.length ? { compatibleWallets } : {}),
        firstSeenAt,
        orgId: catalog.orgId,
        organization: organizationProjection(organization),
        logo,
        website,
        isEudiWalletConnector: (connector.interoperabilityProfiles || []).includes('EUDI Wallet ARF'),
        ...(catalogTier ? { catalogTier } : {}),
        ...(catalogListingDepth ? { catalogListingDepth } : {}),
        sourcePath,
        updatedAt,
        fetchedAt,
      });
    }
  }

  if (errors.length) {
    throw new Error(`Connector catalog validation failed:\n- ${errors.join('\n- ')}`);
  }

  connectors.sort((a, b) => a.name.localeCompare(b.name));
  const output: AggregatedConnectorCatalog = {
    schemaVersion: '1',
    catalogType: 'wallet-connector-catalog',
    lastUpdated: fetchedAt,
    connectors,
    stats: {
      totalConnectors: connectors.length,
      totalOrganizations: new Set(connectors.map((connector) => connector.orgId)).size,
      eudiWalletConnectors: connectors.filter((connector) => connector.isEudiWalletConnector).length,
      byFunction: {
        issuer: connectors.filter((connector) => connector.connectorFunctions.includes('issuer')).length,
        verifier: connectors.filter((connector) => connector.connectorFunctions.includes('verifier')).length,
      },
      byDeploymentModel: {
        saas: connectors.filter((connector) => connector.deploymentModel === 'saas').length,
        on_premises: connectors.filter((connector) => connector.deploymentModel === 'on_premises').length,
        hybrid: connectors.filter((connector) => connector.deploymentModel === 'hybrid').length,
      },
    },
  };

  await fs.writeFile(FIRST_SEEN_PATH, `${JSON.stringify(firstSeenHistory, null, 2)}\n`);
  for (const outputPath of [OUTPUT_PATH, PLUGIN_OUTPUT_PATH]) {
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`);
  }
  console.log(`Aggregated ${connectors.length} connector(s) from ${directories.length} provider folder(s).`);
}

crawl().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
