#!/usr/bin/env tsx
/**
 * Import published WordPress connector submissions into community-catalogs/.
 *
 * Merges one connector object per export entry into the provider's wallet-connector-catalog.json
 * (grouped by org slug). Preserves sibling connectors in the same file.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(process.cwd());
const COMMUNITY_DIR = path.join(ROOT, 'community-catalogs');
const STATE_PATH = path.join(ROOT, 'data/wp-submission-state.json');
// Committed export file (primary source): WordPress writes this via the GitHub
// Contents API; its push triggers the sync workflow, which reads the file
// locally — no ~65 KB repository_dispatch cap and no WAF-blocked HTTP pull.
const WP_EXPORT_FILE = process.env.FIDES_WP_EXPORT_FILE
  ? path.resolve(ROOT, process.env.FIDES_WP_EXPORT_FILE)
  : path.join(ROOT, 'data/wp-export/wallet-connector.json');
const MARKER_FILENAME = '.wordpress-source';
const COMMUNITY_FILENAME = 'wallet-connector-catalog.json';
const SECRET_HEADER = 'X-FIDES-Catalog-Secret';
const USER_AGENT = 'FIDES-Catalog-Automation/1.0';

function wpExportBlockHint(body: string, status: number): string | null {
  if (body.includes('sgcaptcha') || body.includes('.well-known/captcha')) {
    return [
      `SiteGround Anti-Bot AI blocked this request (HTTP ${status}).`,
      'GitHub Actions cannot solve the captcha challenge.',
      'Fix: enable GitHub push sync in WP Settings → FIDES Catalog SEO (PAT with repo + workflow scope),',
      'or ask SiteGround support to disable Anti-Bot AI for /wp-json/fides-catalog/.',
    ].join(' ');
  }
  return null;
}

export type WpExportEntry = {
  itemId: string;
  slug: string;
  filename: string;
  source: string;
  document: Record<string, unknown>;
  publishedAt?: string | null;
  updatedAt?: string | null;
};

export type WpExportPayload = {
  schemaVersion: string;
  catalogType: string;
  generatedAt: string;
  entries: WpExportEntry[];
};

export type ManagedConnector = {
  slug: string;
  connectorId: string;
};

export type WpSubmissionState = {
  schemaVersion: '1.0.0';
  catalogType: string;
  lastImportAt: string | null;
  managedConnectors: ManagedConnector[];
};

type ConnectorRecord = Record<string, unknown> & { id?: string };

type ConnectorCatalogDoc = {
  $schema?: string;
  orgId?: string;
  connectors?: ConnectorRecord[];
  lastUpdated?: string;
};

type SlugGroup = {
  slug: string;
  entries: WpExportEntry[];
};

type ImportPlan = {
  groups: SlugGroup[];
  prune: ManagedConnector[];
  skipped: Array<{ slug: string; reason: string }>;
};

function parseArgs(argv: string[]) {
  const apply = argv.includes('--apply');
  const wpUrl =
    (() => {
      const idx = argv.indexOf('--wp-url');
      if (idx >= 0 && argv[idx + 1]) return argv[idx + 1];
      return (
        process.env.FIDES_WP_EXPORT_URL
        ?? 'http://utrecht-demo.local/wp-json/fides-catalog/v1/export/wallet-connector'
      );
    })();
  const secret =
    (() => {
      const idx = argv.indexOf('--secret');
      if (idx >= 0 && argv[idx + 1]) return argv[idx + 1];
      return process.env.FIDES_CATALOG_SECRET ?? process.env.WP_INVALIDATE_SECRET ?? '';
    })();
  return { apply, wpUrl, secret };
}

function isSafeSlug(slug: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/i.test(slug);
}

export function emptyState(catalogType = 'wallet-connector'): WpSubmissionState {
  return {
    schemaVersion: '1.0.0',
    catalogType,
    lastImportAt: null,
    managedConnectors: [],
  };
}

export async function readState(): Promise<WpSubmissionState> {
  try {
    const raw = await fs.readFile(STATE_PATH, 'utf8');
    const parsed = JSON.parse(raw) as WpSubmissionState;
    if (!parsed || !Array.isArray(parsed.managedConnectors)) {
      return emptyState();
    }
    return parsed;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      return emptyState();
    }
    throw err;
  }
}

export function connectorFromEntry(entry: WpExportEntry): ConnectorRecord | null {
  const connectors = entry.document.connectors;
  if (!Array.isArray(connectors) || !connectors.length) return null;
  const connector = connectors[0];
  if (!connector || typeof connector !== 'object') return null;
  const id = String((connector as ConnectorRecord).id || entry.itemId || '').trim();
  if (!id) return null;
  return { ...(connector as ConnectorRecord), id };
}

export function mergeConnectorIntoCatalog(
  base: ConnectorCatalogDoc | null,
  entry: WpExportEntry,
): ConnectorCatalogDoc {
  const connector = connectorFromEntry(entry);
  if (!connector) {
    throw new Error(`Export entry ${entry.itemId} has no connector object.`);
  }
  const orgId = String(entry.document.orgId || '').trim();
  const connectors = Array.isArray(base?.connectors) ? [...base.connectors] : [];
  const idx = connectors.findIndex((w) => String(w.id || '') === String(connector.id));
  if (idx >= 0) {
    connectors[idx] = { ...connectors[idx], ...connector };
  } else {
    connectors.push(connector);
  }
  // Use the real last-modification time WordPress puts on the export document
  // (submission updated_at) so lastUpdated reflects the actual last change and
  // stays stable across pushes, instead of stamping "now" on every import.
  const entryLastUpdated =
    typeof entry.document.lastUpdated === 'string' ? entry.document.lastUpdated.trim() : '';
  return {
    $schema: 'https://fides.community/schemas/wallet-connector-catalog/v1',
    orgId: orgId || base?.orgId,
    connectors,
    lastUpdated: entryLastUpdated || base?.lastUpdated || new Date().toISOString(),
  };
}

export function buildImportPlan(entries: WpExportEntry[], previous: WpSubmissionState): ImportPlan {
  const plan: ImportPlan = { groups: [], prune: [], skipped: [] };
  const groupMap = new Map<string, WpExportEntry[]>();
  const currentManaged = new Map<string, ManagedConnector>();

  for (const entry of entries) {
    const slug = entry.slug.trim();
    const connectorId = entry.itemId.trim();
    if (!slug || !connectorId || entry.filename !== COMMUNITY_FILENAME) {
      plan.skipped.push({ slug: slug || '(missing)', reason: 'invalid entry metadata' });
      continue;
    }
    if (!isSafeSlug(slug)) {
      plan.skipped.push({ slug, reason: 'unsafe slug' });
      continue;
    }
    if (!connectorFromEntry(entry)) {
      plan.skipped.push({ slug, reason: `missing connector in document (${connectorId})` });
      continue;
    }
    const list = groupMap.get(slug) ?? [];
    list.push(entry);
    groupMap.set(slug, list);
    currentManaged.set(`${slug}:${connectorId}`, { slug, connectorId });
  }

  for (const [, list] of groupMap) {
    plan.groups.push({ slug: list[0]!.slug, entries: list });
  }

  for (const managed of previous.managedConnectors) {
    const key = `${managed.slug}:${managed.connectorId}`;
    if (!currentManaged.has(key)) {
      plan.prune.push(managed);
    }
  }

  return plan;
}

export async function fetchWpExport(wpUrl: string, secret: string): Promise<WpExportPayload> {
  if (!secret.trim()) {
    throw new Error('Missing catalog secret. Set FIDES_CATALOG_SECRET or WP_INVALIDATE_SECRET.');
  }
  const response = await fetch(wpUrl, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      [SECRET_HEADER]: secret,
      'User-Agent': USER_AGENT,
    },
    signal: AbortSignal.timeout(60_000),
  });
  const contentType = response.headers.get('content-type') ?? '';
  const body = await response.text();
  const blockHint = wpExportBlockHint(body, response.status);
  if (blockHint) {
    throw new Error(`${blockHint} Body starts with: ${body.slice(0, 160).replace(/\s+/g, ' ')}`);
  }
  if (!response.ok) {
    throw new Error(
      `WP export failed (HTTP ${response.status}, ${contentType}): ${body.slice(0, 300)}`,
    );
  }
  if (!contentType.includes('json')) {
    throw new Error(
      `WP export returned non-JSON (HTTP ${response.status}, ${contentType}). `
      + `Body starts with: ${body.slice(0, 200).replace(/\s+/g, ' ')}`,
    );
  }
  let payload: WpExportPayload;
  try {
    payload = JSON.parse(body) as WpExportPayload;
  } catch {
    throw new Error(
      `WP export JSON parse failed (HTTP ${response.status}). Body starts with: ${body.slice(0, 200).replace(/\s+/g, ' ')}`,
    );
  }
  if (!payload?.entries) throw new Error('WP export response is missing entries array.');
  return payload;
}

export function loadInlineExportPayload(): WpExportPayload | null {
  const inline = process.env.FIDES_WP_EXPORT_JSON?.trim();
  if (!inline) return null;
  try {
    const payload = JSON.parse(inline) as WpExportPayload;
    if (!payload?.entries || !Array.isArray(payload.entries)) {
      throw new Error('export_json is missing entries array.');
    }
    return payload;
  } catch (err) {
    throw new Error(
      `Invalid FIDES_WP_EXPORT_JSON: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

export async function loadCommittedExportPayload(
  filePath: string = WP_EXPORT_FILE,
): Promise<WpExportPayload | null> {
  let raw: string;
  try {
    raw = await fs.readFile(filePath, 'utf8');
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      return null;
    }
    throw err;
  }
  try {
    const payload = JSON.parse(raw) as WpExportPayload;
    if (!payload?.entries || !Array.isArray(payload.entries)) {
      throw new Error('committed export is missing entries array.');
    }
    return payload;
  } catch (err) {
    throw new Error(
      `Invalid committed export ${path.relative(ROOT, filePath)}: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

export async function loadExportPayload(wpUrl: string, secret: string): Promise<WpExportPayload> {
  const inline = loadInlineExportPayload();
  if (inline) {
    console.log('Using inline export payload (WordPress push sync).');
    return inline;
  }

  // Primary: the export file WordPress committed via the Contents API.
  const committed = await loadCommittedExportPayload();
  if (committed) {
    console.log(`Using committed WordPress export ${path.relative(ROOT, WP_EXPORT_FILE)}.`);
    return committed;
  }

  const event = process.env.GITHUB_EVENT_NAME?.trim();
  if (event === 'repository_dispatch') {
    throw new Error(
      'Missing FIDES_WP_EXPORT_JSON on repository_dispatch. '
      + 'Enable GitHub push sync in WP Settings → FIDES Catalog SEO, or run recovery via workflow_dispatch.',
    );
  }

  console.log(
    event === 'workflow_dispatch'
      ? 'Recovery sync: pulling export via HTTP (manual workflow).'
      : 'Pulling export via HTTP.',
  );
  return fetchWpExport(wpUrl, secret);
}

async function readCatalogAt(
  slug: string,
  communityDir: string = COMMUNITY_DIR,
): Promise<ConnectorCatalogDoc | null> {
  const filePath = path.join(communityDir, slug, COMMUNITY_FILENAME);
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf8')) as ConnectorCatalogDoc;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw err;
  }
}

async function listProviderSlugs(communityDir: string = COMMUNITY_DIR): Promise<string[]> {
  try {
    const entries = await fs.readdir(communityDir, { withFileTypes: true });
    return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw err;
  }
}

/**
 * WordPress uses the org slug (e.g. `swiyu`) as the community-catalogs folder.
 * Older GitHub listings sometimes live under a different folder with the same
 * orgId (e.g. ISO code `CHE`). After writing the WP catalog, fold leftover
 * sibling connectors into the WP folder and remove the duplicate directory so
 * the crawler cannot keep serving the stale copy.
 */
export async function foldOtherOrgCatalogsIntoSlug(
  targetSlug: string,
  orgId: string,
  communityDir: string = COMMUNITY_DIR,
): Promise<string[]> {
  const trimmedOrgId = orgId.trim();
  if (!trimmedOrgId) return [];

  const targetPath = path.join(communityDir, targetSlug, COMMUNITY_FILENAME);
  const target = await readCatalogAt(targetSlug, communityDir);
  if (!target) return [];

  const targetIds = new Set((target.connectors ?? []).map((connector) => String(connector.id || '')));
  const extras: ConnectorRecord[] = [];
  const folded: string[] = [];
  const targetResolved = await fs.realpath(path.join(communityDir, targetSlug)).catch(() => '');

  for (const slug of await listProviderSlugs(communityDir)) {
    if (slug === targetSlug) continue;
    const otherDir = path.join(communityDir, slug);
    const otherResolved = await fs.realpath(otherDir).catch(() => '');
    if (targetResolved && otherResolved && targetResolved === otherResolved) continue;

    const other = await readCatalogAt(slug, communityDir);
    if (!other) continue;
    if (String(other.orgId || '').trim() !== trimmedOrgId) continue;

    for (const connector of other.connectors ?? []) {
      const id = String(connector.id || '');
      if (!id || targetIds.has(id)) continue;
      targetIds.add(id);
      extras.push(connector);
    }
    folded.push(slug);
  }

  if (!folded.length) return [];

  if (extras.length) {
    const merged: ConnectorCatalogDoc = {
      ...target,
      connectors: [...(target.connectors ?? []), ...extras],
    };
    await fs.writeFile(targetPath, `${JSON.stringify(merged, null, 2)}\n`, 'utf8');
  }

  for (const slug of folded) {
    await fs.rm(path.join(communityDir, slug), { recursive: true, force: true });
  }
  return folded;
}

async function markerExists(
  slug: string,
  communityDir: string = COMMUNITY_DIR,
): Promise<boolean> {
  try {
    await fs.access(path.join(communityDir, slug, MARKER_FILENAME));
    return true;
  } catch {
    return false;
  }
}

async function readMarker(
  slug: string,
  communityDir: string = COMMUNITY_DIR,
): Promise<{ connectors?: Record<string, unknown> } | null> {
  try {
    const raw = await fs.readFile(path.join(communityDir, slug, MARKER_FILENAME), 'utf8');
    return JSON.parse(raw) as { connectors?: Record<string, unknown> };
  } catch {
    return null;
  }
}

function removeConnectorFromCatalog(doc: ConnectorCatalogDoc, connectorId: string): ConnectorCatalogDoc {
  const connectors = (doc.connectors ?? []).filter((w) => String(w.id || '') !== connectorId);
  return { ...doc, connectors, lastUpdated: new Date().toISOString() };
}

export async function applyImportPlan(
  plan: ImportPlan,
  apply: boolean,
  catalogType = 'wallet-connector',
  communityDir: string = COMMUNITY_DIR,
): Promise<WpSubmissionState> {
  const managedConnectors: ManagedConnector[] = [];

  for (const group of plan.groups) {
    let doc = await readCatalogAt(group.slug, communityDir);
    for (const entry of group.entries) {
      doc = mergeConnectorIntoCatalog(doc, entry);
      managedConnectors.push({ slug: group.slug, connectorId: entry.itemId });
    }

    const dir = path.join(communityDir, group.slug);
    const catalogPath = path.join(dir, COMMUNITY_FILENAME);
    const markerPath = path.join(dir, MARKER_FILENAME);
    const marker = {
      source: 'wordpress',
      slug: group.slug,
      connectors: Object.fromEntries(
        group.entries.map((e) => [e.itemId, { itemId: e.itemId, publishedAt: e.publishedAt ?? null }]),
      ),
      importedAt: new Date().toISOString(),
    };

    if (apply) {
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(catalogPath, `${JSON.stringify(doc, null, 2)}\n`, 'utf8');
      const existingMarker = (await readMarker(group.slug, communityDir)) ?? {};
      const mergedConnectors = { ...(existingMarker.connectors ?? {}), ...marker.connectors };
      await fs.writeFile(
        markerPath,
        `${JSON.stringify({ ...marker, connectors: mergedConnectors }, null, 2)}\n`,
        'utf8',
      );
      const orgId = String(doc?.orgId || group.entries[0]?.document?.orgId || '').trim();
      const folded = await foldOtherOrgCatalogsIntoSlug(group.slug, orgId, communityDir);
      for (const slug of folded) {
        console.log(`FOLD  ${slug} → ${group.slug} (duplicate orgId ${orgId})`);
      }
    }
    console.log(`${apply ? 'WRITE' : 'DRY '} ${group.slug} (${group.entries.length} connector(s))`);
  }

  for (const managed of plan.prune) {
    const hasMarker = await markerExists(managed.slug, communityDir);
    if (!hasMarker) {
      console.log(`SKIP  prune ${managed.slug}/${managed.connectorId} — not WP-managed`);
      continue;
    }
    const doc = await readCatalogAt(managed.slug, communityDir);
    if (!doc) continue;
    const next = removeConnectorFromCatalog(doc, managed.connectorId);
    const dir = path.join(communityDir, managed.slug);
    if (apply) {
      if ((next.connectors ?? []).length === 0) {
        await fs.rm(dir, { recursive: true, force: true });
        console.log(`PRUNE ${managed.slug} (empty after removing ${managed.connectorId})`);
      } else {
        await fs.writeFile(
          path.join(dir, COMMUNITY_FILENAME),
          `${JSON.stringify(next, null, 2)}\n`,
          'utf8',
        );
        const marker = await readMarker(managed.slug, communityDir);
        if (marker?.connectors && managed.connectorId in marker.connectors) {
          delete marker.connectors[managed.connectorId];
          await fs.writeFile(
            path.join(dir, MARKER_FILENAME),
            `${JSON.stringify(marker, null, 2)}\n`,
            'utf8',
          );
        }
        console.log(`UPDATE ${managed.slug} — removed connector ${managed.connectorId}`);
      }
    } else {
      console.log(`DRY  prune connector ${managed.connectorId} from ${managed.slug}`);
    }
  }

  for (const skipped of plan.skipped) {
    console.log(`SKIP  ${skipped.slug} — ${skipped.reason}`);
  }

  const unique = new Map<string, ManagedConnector>();
  for (const m of managedConnectors) unique.set(`${m.slug}:${m.connectorId}`, m);

  return {
    schemaVersion: '1.0.0',
    catalogType,
    lastImportAt: apply ? new Date().toISOString() : null,
    managedConnectors: apply ? [...unique.values()].sort((a, b) => a.slug.localeCompare(b.slug)) : [...unique.values()],
  };
}

async function main() {
  const { apply, wpUrl, secret } = parseArgs(process.argv.slice(2));
  console.log(`WP export: ${wpUrl}`);
  console.log(`Mode: ${apply ? 'apply' : 'dry-run (pass --apply to write)'}`);

  const previous = await readState();
  const payload = await loadExportPayload(wpUrl, secret);
  const plan = buildImportPlan(payload.entries, previous);

  console.log(`Export entries: ${payload.entries.length}`);
  console.log(`Would write: ${plan.groups.length} provider file(s), prune: ${plan.prune.length} connector(s)`);

  const nextState = await applyImportPlan(plan, apply, payload.catalogType || 'wallet-connector');
  if (apply) {
    await fs.mkdir(path.dirname(STATE_PATH), { recursive: true });
    await fs.writeFile(STATE_PATH, `${JSON.stringify(nextState, null, 2)}\n`, 'utf8');
    console.log(`State updated: ${path.relative(ROOT, STATE_PATH)}`);
  }
}

const isMain = process.argv[1]
  ? fileURLToPath(import.meta.url) === path.resolve(process.argv[1])
  : false;
if (isMain) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
