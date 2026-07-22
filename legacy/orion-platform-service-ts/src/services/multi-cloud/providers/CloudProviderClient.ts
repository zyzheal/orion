/**
 * Cloud Provider Client Interface
 *
 * Defines the contract for all cloud provider SDK integrations.
 * Each provider (AWS, GCP, Azure, AliCloud, Private) implements this interface.
 */

export interface ProviderResource {
  id: string;
  name: string;
  type: string;
  region: string;
  status: string;
  tags: Record<string, string>;
  spec: Record<string, any>;
  monthlyCost?: number;
}

export interface ProviderSyncResult {
  discovered: number;
  created: number;
  updated: number;
  deleted: number;
  skipped: number;
  errors: Array<{ resourceId?: string; message: string; code?: string }>;
}

export interface ProviderHealthStatus {
  healthy: boolean;
  latencyMs: number;
  apiVersion?: string;
  details: Record<string, any>;
}

export interface ProviderCostEntry {
  service: string;
  cost: number;
  currency: string;
  region: string;
}

export interface CredentialValidationResult {
  valid: boolean;
  accountId?: string;
  message: string;
  details?: Record<string, any>;
}

export interface RetryConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
}

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
};

/**
 * Cloud Provider Client - unified interface for cloud provider SDK operations
 */
export interface CloudProviderClient {
  /**
   * Provider name (aws, gcp, azure, alicloud, private)
   */
  readonly provider: string;

  /**
   * Initialize client with credentials for a specific account/region
   */
  initialize(credentials: Record<string, string>, region: string): Promise<void>;

  /**
   * Validate credentials are valid and have necessary permissions
   */
  validateCredentials(): Promise<CredentialValidationResult>;

  /**
   * Check health of the provider API endpoint
   */
  checkHealth(): Promise<ProviderHealthStatus>;

  /**
   * Discover all resources of supported types in the given region
   */
  discoverResources(resourceTypes?: string[]): Promise<ProviderResource[]>;

  /**
   * Get cost summary for a time period
   */
  getCostSummary(month?: string): Promise<{ totalCost: number; currency: string; breakdown: ProviderCostEntry[] }>;

  /**
   * Get resource details by provider resource ID
   */
  getResource(providerResourceId: string): Promise<ProviderResource | null>;

  /**
   * Close any open connections / cleanup
   */
  close?(): Promise<void>;
}
