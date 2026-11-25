import type { SourceConnector } from '../types/connector.js';

export interface WalletEntry {
  id: string;
  type: 'personal' | 'organizational';
  orgId: string;
  name?: string;
  logo?: string;
  provider?: { name?: string };
}

export interface OrganizationEntry {
  id: string;
  certifications?: Array<{
    code?: string;
    details?: { trustServices?: Array<{ code?: string }> };
  }>;
}

export function organizationHasQeaa(entry: OrganizationEntry): boolean {
  return (entry.certifications || []).some((certification) =>
    certification.code === 'qtsp' &&
    (certification.details?.trustServices || []).some((service) => service.code === 'QEAA')
  );
}

export function validateCrossCatalogReferences(
  connector: SourceConnector,
  orgId: string,
  organization: OrganizationEntry,
  walletsById: Map<string, WalletEntry>
): string[] {
  const errors: string[] = [];

  if (connector.walletRef) {
    const wallet = walletsById.get(connector.walletRef.walletCatalogId);
    if (!wallet) {
      errors.push(`walletRef ${connector.walletRef.walletCatalogId} does not exist`);
    } else {
      if (wallet.type !== 'organizational') {
        errors.push(`walletRef ${wallet.id} must reference an organizational wallet`);
      }
      if (wallet.orgId !== orgId) {
        errors.push(`walletRef ${wallet.id} belongs to ${wallet.orgId}, not ${orgId}`);
      }
    }
  }

  for (const walletId of connector.walletCompatibility || []) {
    const wallet = walletsById.get(walletId);
    if (!wallet) {
      errors.push(`walletCompatibility ${walletId} does not exist`);
    } else if (wallet.type !== 'personal') {
      errors.push(`walletCompatibility ${walletId} must reference a personal wallet`);
    }
  }

  if (connector.eidasRoles?.includes('qeaa_provider') && !organizationHasQeaa(organization)) {
    errors.push(`${orgId} must have a QTSP certification with the QEAA trust service`);
  }

  return errors;
}
