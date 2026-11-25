import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveConnectorCatalogListingDepth, resolveConnectorCatalogTier } from './tier.ts';

test('explicit connector tier wins over the organization tier', () => {
  assert.equal(resolveConnectorCatalogTier({ catalogTier: 'Community' }, { catalogTier: 'Pro' }), 'Community');
  assert.equal(resolveConnectorCatalogTier({ catalogTier: ' Pro ' }, { catalogTier: 'Community' }), 'Pro');
});

test('organization tier is inherited when the connector has none', () => {
  assert.equal(resolveConnectorCatalogTier({}, { catalogTier: 'Pro' }), 'Pro');
  assert.equal(resolveConnectorCatalogTier({ catalogTier: '  ' }, { catalogTier: 'Community' }), 'Community');
});

test('missing tier stays undefined (listing badge treats it as Community unless proOrgIds links the org)', () => {
  assert.equal(resolveConnectorCatalogTier({}, {}), undefined);
  assert.equal(resolveConnectorCatalogTier({}, undefined), undefined);
});

test('listing depth follows the same precedence', () => {
  assert.equal(resolveConnectorCatalogListingDepth({ catalogListingDepth: 'full' }, {}), 'full');
  assert.equal(resolveConnectorCatalogListingDepth({}, { catalogListingDepth: 'full' }), 'full');
  assert.equal(resolveConnectorCatalogListingDepth({}, {}), undefined);
});
