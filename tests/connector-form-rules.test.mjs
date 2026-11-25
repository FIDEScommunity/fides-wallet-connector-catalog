import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const Rules = require('../wordpress-plugin/fides-wallet-connector-catalog/assets/connector-form-rules.js');

const baseState = () => ({
  orgId: 'acme',
  connectorFunctions: ['issuer'],
  serviceModels: ['software_only'],
  interoperabilityProfiles: [],
  eidasRoles: [],
  license: 'MIT',
  licenseOther: '',
  issuanceProtocols: ['OpenID4VCI'],
  presentationProtocols: [],
  vcFormat: ['sd_jwt_vc'],
  backendIntegrations: ['rest_api'],
  deploymentModel: 'saas',
  status: 'production',
  walletRef: '',
});

test('protocolGroups follows the selected functions', () => {
  assert.deepEqual(Rules.protocolGroups(['issuer']), { issuance: true, presentation: false });
  assert.deepEqual(Rules.protocolGroups(['verifier']), { issuance: false, presentation: true });
  assert.deepEqual(Rules.protocolGroups(['issuer', 'verifier']), { issuance: true, presentation: true });
  assert.deepEqual(Rules.protocolGroups([]), { issuance: false, presentation: false });
});

test('license other is only editable for the other license; openSource is derived', () => {
  assert.equal(Rules.licenseOtherApplies('other'), true);
  assert.equal(Rules.licenseOtherApplies('MIT'), false);
  assert.equal(Rules.deriveOpenSource('MIT', ''), true);
  assert.equal(Rules.deriveOpenSource('proprietary', ''), false);
});

test('a valid issuer state has no errors', () => {
  assert.deepEqual(Rules.validateState(baseState(), { wallets: [], orgHasQeaa: false }), []);
});

test('required fields and conditional protocols are reported', () => {
  const state = { ...baseState(), issuanceProtocols: [], vcFormat: [], connectorFunctions: ['issuer', 'verifier'] };
  const fields = Rules.validateState(state, {}).map((e) => e.field);
  assert.ok(fields.includes('issuanceProtocols'));
  assert.ok(fields.includes('presentationProtocols'));
  assert.ok(fields.includes('vcFormat'));
});

test('license other requires a value', () => {
  const errors = Rules.validateState({ ...baseState(), license: 'other' }, {});
  assert.ok(errors.some((e) => e.field === 'licenseOther'));
});

test('eIDAS role availability follows functions, service models, profiles and QEAA', () => {
  const none = Rules.eidasRoleAvailability(baseState(), false);
  assert.equal(none.rp_intermediary.visible, false);
  assert.equal(none.eaa_provider.visible, true);
  assert.equal(none.eaa_provider.enabled, false);
  assert.ok(none.eaa_provider.missing.length > 0);

  const issuer = { ...baseState(), serviceModels: ['managed_issuance'] };
  assert.equal(Rules.eidasRoleAvailability(issuer, false).eaa_provider.enabled, true);
  assert.equal(Rules.eidasRoleAvailability(issuer, false).qeaa_provider.enabled, false);
  assert.equal(Rules.eidasRoleAvailability(issuer, true).qeaa_provider.enabled, true);

  const verifier = {
    ...baseState(),
    connectorFunctions: ['verifier'],
    serviceModels: ['managed_verification'],
    interoperabilityProfiles: ['EUDI Wallet ARF'],
  };
  assert.equal(Rules.eidasRoleAvailability(verifier, false).rp_intermediary.enabled, true);
  assert.equal(Rules.eidasSectionVisible(baseState()), true);
  assert.equal(Rules.eidasSectionVisible({ ...baseState(), connectorFunctions: [] }), false);
});

test('pruneEidasRoles drops roles that are no longer allowed', () => {
  const state = { ...baseState(), serviceModels: ['software_only'], eidasRoles: ['eaa_provider', 'rp_intermediary'] };
  assert.deepEqual(Rules.pruneEidasRoles(state, false), []);
  const ok = { ...state, serviceModels: ['managed_issuance'] };
  assert.deepEqual(Rules.pruneEidasRoles(ok, false), ['eaa_provider']);
});

test('wallet pickers: business wallets per org, personal wallets for compatibility', () => {
  const wallets = [
    { id: 'a', type: 'organizational', orgId: 'acme' },
    { id: 'b', type: 'organizational', orgId: 'other' },
    { id: 'c', type: 'personal', orgId: 'alice' },
  ];
  assert.deepEqual(Rules.organizationalWalletsForOrg(wallets, 'acme').map((w) => w.id), ['a']);
  assert.deepEqual(Rules.personalWallets(wallets).map((w) => w.id), ['c']);
});

test('walletRef must be a business wallet of the same org', () => {
  const wallets = [
    { id: 'a', type: 'organizational', orgId: 'acme' },
    { id: 'b', type: 'organizational', orgId: 'other' },
    { id: 'c', type: 'personal', orgId: 'alice' },
  ];
  const run = (walletRef) =>
    Rules.validateState({ ...baseState(), walletRef }, { wallets }).filter((e) => e.field === 'walletRef');
  assert.equal(run('a').length, 0);
  assert.equal(run('b').length, 1);
  assert.equal(run('c').length, 1);
  assert.equal(run('zzz').length, 1);
});
