import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { SourceConnector } from '../types/connector.js';
import {
  organizationHasQeaa,
  validateCrossCatalogReferences,
  type OrganizationEntry,
  type WalletEntry,
} from './validation.js';

const baseConnector: SourceConnector = {
  id: 'test-connector',
  name: 'Test Connector',
  description: 'Test connector used to exercise cross-catalog validation.',
  connectorFunctions: ['issuer', 'verifier'],
  deploymentModel: 'saas',
  openSource: false,
  license: 'proprietary',
  status: 'production',
  vcFormat: ['sd_jwt_vc'],
  issuanceProtocols: ['OpenID4VCI'],
  presentationProtocols: ['OpenID4VP'],
  backendIntegrations: ['rest_api'],
  serviceModels: ['managed_issuance', 'managed_verification'],
};

const wallets = new Map<string, WalletEntry>([
  ['business-wallet', { id: 'business-wallet', type: 'organizational', orgId: 'org:test' }],
  ['personal-wallet', { id: 'personal-wallet', type: 'personal', orgId: 'org:other' }],
]);

describe('cross-catalog validation', () => {
  it('accepts same-organization business references and personal compatibility', () => {
    const errors = validateCrossCatalogReferences(
      {
        ...baseConnector,
        walletRef: { walletCatalogId: 'business-wallet' },
        walletCompatibility: ['personal-wallet'],
      },
      'org:test',
      { id: 'org:test' },
      wallets,
    );
    assert.deepEqual(errors, []);
  });

  it('rejects wrong wallet types and organizations', () => {
    const errors = validateCrossCatalogReferences(
      {
        ...baseConnector,
        walletRef: { walletCatalogId: 'personal-wallet' },
        walletCompatibility: ['business-wallet'],
      },
      'org:test',
      { id: 'org:test' },
      wallets,
    );
    assert.deepEqual(errors, [
      'walletRef personal-wallet must reference an organizational wallet',
      'walletRef personal-wallet belongs to org:other, not org:test',
      'walletCompatibility business-wallet must reference a personal wallet',
    ]);
  });

  it('requires supported QTSP evidence for the QEAA provider role', () => {
    const organization: OrganizationEntry = {
      id: 'org:test',
      certifications: [
        { code: 'qtsp', details: { trustServices: [{ code: 'QEAA' }] } },
      ],
    };
    assert.equal(organizationHasQeaa(organization), true);
    assert.deepEqual(
      validateCrossCatalogReferences(
        { ...baseConnector, eidasRoles: ['qeaa_provider'] },
        organization.id,
        organization,
        wallets,
      ),
      [],
    );
    assert.deepEqual(
      validateCrossCatalogReferences(
        { ...baseConnector, eidasRoles: ['qeaa_provider'] },
        'org:missing-evidence',
        { id: 'org:missing-evidence' },
        wallets,
      ),
      ['org:missing-evidence must have a QTSP certification with the QEAA trust service'],
    );
  });
});
