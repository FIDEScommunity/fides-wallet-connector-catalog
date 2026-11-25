export type ConnectorFunction = 'issuer' | 'verifier';
export type DeploymentModel = 'saas' | 'on_premises' | 'hybrid';
export type ConnectorStatus = 'development' | 'beta' | 'production' | 'deprecated';
export type ServiceModel = 'software_only' | 'managed_verification' | 'managed_issuance';
export type EidasRole = 'rp_intermediary' | 'eaa_provider' | 'qeaa_provider';
export type CertificateManagement = 'provider_managed' | 'customer_managed' | 'both';

export interface WalletReference {
  walletCatalogId: string;
}

export interface SourceConnector {
  id: string;
  name: string;
  description: string;
  walletRef?: WalletReference;
  logo?: string;
  website?: string;
  documentation?: string;
  repository?: string;
  playgroundUrls?: string[];
  connectorFunctions: ConnectorFunction[];
  deploymentModel: DeploymentModel;
  openSource: boolean;
  license: string;
  licenseOther?: string;
  status: ConnectorStatus;
  vcFormat: string[];
  issuanceProtocols?: string[];
  presentationProtocols?: string[];
  interoperabilityProfiles?: string[];
  credentialStatusMethods?: string[];
  walletCompatibility?: string[];
  backendIntegrations: string[];
  frontendIntegrations?: string[];
  serviceModels: ServiceModel[];
  eidasRoles?: EidasRole[];
  certificateManagement?: CertificateManagement;
  /** Stamped by the WordPress export (Community | Pro); inherited from the organization when absent. */
  catalogTier?: string;
  /** Set by the WordPress export for Community organizations with a curated full listing. */
  catalogListingDepth?: string;
}

export interface SourceConnectorCatalog {
  $schema: string;
  orgId: string;
  connectors: SourceConnector[];
  lastUpdated?: string;
}

export interface AggregatedOrganization {
  id: string;
  name: string;
  country?: string;
  website?: string;
  logoUri?: string;
  catalogTier?: string;
  catalogListingDepth?: string;
}

export interface WalletSummary {
  id: string;
  name: string;
  logo?: string;
  providerName?: string;
}

export interface AggregatedConnector extends SourceConnector {
  orgId: string;
  /** Resolved summary of walletRef (business wallet), for modal links. */
  walletReference?: WalletSummary;
  /** Resolved summaries of walletCompatibility (personal wallets), for modal links. */
  compatibleWallets?: WalletSummary[];
  /** First time the connector appeared in the catalog (drives the 30-day KPIs). */
  firstSeenAt: string;
  organization: AggregatedOrganization;
  logo: string;
  website: string;
  isEudiWalletConnector: boolean;
  catalogTier?: string;
  sourcePath: string;
  updatedAt: string;
  fetchedAt: string;
}

export interface AggregatedConnectorCatalog {
  schemaVersion: '1';
  catalogType: 'wallet-connector-catalog';
  lastUpdated: string;
  connectors: AggregatedConnector[];
  stats: {
    totalConnectors: number;
    totalOrganizations: number;
    eudiWalletConnectors: number;
    byFunction: Record<ConnectorFunction, number>;
    byDeploymentModel: Record<DeploymentModel, number>;
  };
}
