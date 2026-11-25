import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  buildImportPlan,
  emptyState,
  loadCommittedExportPayload,
  foldOtherOrgCatalogsIntoSlug,
  mergeConnectorIntoCatalog,
  type WpExportEntry,
} from '../scripts/import-wp-submissions.ts';

test('loadCommittedExportPayload returns null when the file is absent', async () => {
  const missing = path.join(os.tmpdir(), `fides-missing-${Date.now()}.json`);
  assert.equal(await loadCommittedExportPayload(missing), null);
});

test('loadCommittedExportPayload parses a committed export file', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'fides-export-'));
  const file = path.join(dir, 'wallet-connector.json');
  const payload = {
    schemaVersion: '1.0.0',
    catalogType: 'wallet-connector',
    generatedAt: new Date().toISOString(),
    entries: [
      {
        itemId: 'example-connector',
        slug: 'fides',
        filename: 'wallet-connector-catalog.json',
        source: 'wordpress',
        document: {
          orgId: 'org:fides',
          connectors: [{ id: 'example-connector', name: 'Example' }],
        },
      },
    ],
  };
  await fs.writeFile(file, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  const loaded = await loadCommittedExportPayload(file);
  assert.equal(loaded?.entries.length, 1);
  assert.equal(loaded?.entries[0].slug, 'fides');
  await fs.rm(dir, { recursive: true, force: true });
});

test('loadCommittedExportPayload throws a clear error on malformed JSON', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'fides-export-bad-'));
  const file = path.join(dir, 'wallet-connector.json');
  await fs.writeFile(file, '{ not json', 'utf8');
  await assert.rejects(loadCommittedExportPayload(file), /Invalid committed export/);
  await fs.rm(dir, { recursive: true, force: true });
});

test('mergeConnectorIntoCatalog appends and updates by connector id', () => {
  const entryA: WpExportEntry = {
    itemId: 'example-connector',
    slug: 'animo',
    filename: 'wallet-connector-catalog.json',
    source: 'wordpress',
    document: {
      orgId: 'org:animo',
      connectors: [{ id: 'example-connector', name: 'Example', type: 'personal', status: 'beta' }],
    },
  };
  {
    // The merged doc must carry the real last-modification date from the export
    // document (submission updated_at), not a fresh "now" stamp.
    const realDate = '2026-01-15T09:30:00+00:00';
    const dated = mergeConnectorIntoCatalog(null, {
      ...entryA,
      document: { ...entryA.document, lastUpdated: realDate },
    });
    assert.equal(dated.lastUpdated, realDate);
  }
  const entryB: WpExportEntry = {
    itemId: 'example-connector',
    slug: 'animo',
    filename: 'wallet-connector-catalog.json',
    source: 'wordpress',
    document: {
      orgId: 'org:animo',
      connectors: [{ id: 'example-connector', name: 'Example v2', type: 'personal', status: 'production' }],
    },
  };
  const other: WpExportEntry = {
    itemId: 'other-connector',
    slug: 'animo',
    filename: 'wallet-connector-catalog.json',
    source: 'wordpress',
    document: {
      orgId: 'org:animo',
      connectors: [{ id: 'other-connector', name: 'Other', type: 'organizational', status: 'production' }],
    },
  };

  let doc = mergeConnectorIntoCatalog(null, entryA);
  assert.equal(doc.connectors?.length, 1);
  assert.equal(doc.connectors?.[0]?.name, 'Example');

  doc = mergeConnectorIntoCatalog(doc, other);
  assert.equal(doc.connectors?.length, 2);

  doc = mergeConnectorIntoCatalog(doc, entryB);
  assert.equal(doc.connectors?.length, 2);
  assert.equal(doc.connectors?.find((w) => w.id === 'example-connector')?.name, 'Example v2');
});

test('buildImportPlan groups by slug and plans prune', () => {
  const entries: WpExportEntry[] = [
    {
      itemId: 'w1',
      slug: 'animo',
      filename: 'wallet-connector-catalog.json',
      source: 'wordpress',
      document: { orgId: 'org:animo', connectors: [{ id: 'w1', name: 'W1', type: 'personal', status: 'production' }] },
    },
  ];
  const previous = emptyState();
  previous.managedConnectors = [{ slug: 'oldco', connectorId: 'legacy-connector' }];
  const plan = buildImportPlan(entries, previous);
  assert.equal(plan.groups.length, 1);
  assert.equal(plan.groups[0]?.slug, 'animo');
  assert.equal(plan.prune.length, 1);
});

test('export-to-community pipeline merges create then update for same connector id', () => {
  const createExport: WpExportEntry = {
    itemId: 'pipeline-connector',
    slug: 'acme',
    filename: 'wallet-connector-catalog.json',
    source: 'wordpress',
    publishedAt: '2026-06-22T10:00:00.000Z',
    document: {
      orgId: 'org:acme',
      connectors: [{
        id: 'pipeline-connector',
        name: 'Pipeline Connector',
        type: 'personal',
        status: 'beta',
        description: 'Initial submission',
      }],
    },
  };
  const updateExport: WpExportEntry = {
    itemId: 'pipeline-connector',
    slug: 'acme',
    filename: 'wallet-connector-catalog.json',
    source: 'wordpress',
    publishedAt: '2026-06-23T12:00:00.000Z',
    document: {
      orgId: 'org:acme',
      connectors: [{
        id: 'pipeline-connector',
        name: 'Pipeline Connector',
        type: 'personal',
        status: 'production',
        description: 'After moderation update',
      }],
    },
  };

  const plan = buildImportPlan([createExport, updateExport], emptyState());
  assert.equal(plan.groups.length, 1);
  assert.equal(plan.groups[0]?.entries.length, 2);
  assert.equal(plan.skipped.length, 0);

  let doc = null as ReturnType<typeof mergeConnectorIntoCatalog> | null;
  for (const entry of plan.groups[0]!.entries) {
    doc = mergeConnectorIntoCatalog(doc, entry);
  }

  assert.equal(doc?.orgId, 'org:acme');
  assert.equal(doc?.connectors?.length, 1);
  const connector = doc?.connectors?.[0];
  assert.equal(connector?.id, 'pipeline-connector');
  assert.equal(connector?.status, 'production');
  assert.equal(connector?.description, 'After moderation update');
  assert.ok(doc?.lastUpdated);
});

test('connectorFromEntry prefers embedded connector id over itemId metadata', () => {
  const entry: WpExportEntry = {
    itemId: 'meta-id',
    slug: 'acme',
    filename: 'wallet-connector-catalog.json',
    source: 'wordpress',
    document: {
      orgId: 'org:acme',
      connectors: [{ id: 'embedded-id', name: 'Embedded', type: 'personal', status: 'production' }],
    },
  };
  const connector = mergeConnectorIntoCatalog(null, entry).connectors?.[0];
  assert.equal(connector?.id, 'embedded-id');
});

test('foldOtherOrgCatalogsIntoSlug merges siblings and removes the duplicate folder', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'fides-fold-'));
  await fs.mkdir(path.join(dir, 'CHE'), { recursive: true });
  await fs.mkdir(path.join(dir, 'swiyu'), { recursive: true });
  await fs.writeFile(
    path.join(dir, 'CHE', 'wallet-connector-catalog.json'),
    `${JSON.stringify({
      orgId: 'org:swiyu',
      lastUpdated: '2026-01-10T12:00:00Z',
      connectors: [
        { id: 'swiyu-connector', name: 'Old SWIYU Connector' },
        { id: 'swiyu-generic-issuer', name: 'SWIYU Generic Issuer' },
      ],
    }, null, 2)}\n`,
    'utf8',
  );
  await fs.writeFile(
    path.join(dir, 'swiyu', 'wallet-connector-catalog.json'),
    `${JSON.stringify({
      orgId: 'org:swiyu',
      lastUpdated: '2026-08-28T08:43:13+00:00',
      connectors: [{ id: 'swiyu-connector', name: 'swiyu Connector' }],
    }, null, 2)}\n`,
    'utf8',
  );

  const folded = await foldOtherOrgCatalogsIntoSlug('swiyu', 'org:swiyu', dir);
  assert.equal(folded.length, 1);
  assert.equal(folded[0]!.toLowerCase(), 'che');

  const merged = JSON.parse(await fs.readFile(path.join(dir, 'swiyu', 'wallet-connector-catalog.json'), 'utf8'));
  assert.equal(merged.connectors.length, 2);
  assert.equal(merged.connectors[0].name, 'swiyu Connector');
  assert.equal(merged.connectors[1].id, 'swiyu-generic-issuer');
  await assert.rejects(fs.access(path.join(dir, folded[0]!)), /ENOENT/);
  await fs.rm(dir, { recursive: true, force: true });
});
