/**
 * Provider Client Factory
 *
 * Factory for creating cloud provider clients based on provider type.
 * Each provider has its own client implementation that handles SDK integration.
 */

import { CloudProviderClient } from './CloudProviderClient';
import { OrionError, ErrorCode } from '../../../errors';
import { AwsProviderClient } from './AwsProviderClient';
import { GcpProviderClient } from './GcpProviderClient';
import { AzureProviderClient } from './AzureProviderClient';
import { AliCloudProviderClient } from './AliCloudProviderClient';
import { PrivateCloudProviderClient } from './PrivateCloudProviderClient';
import { createLogger } from '../../../utils/logger';

const logger = createLogger('provider-client-factory');

export class ProviderClientFactory {
  private static clients: Map<string, CloudProviderClient> = new Map();

  /**
   * Get or create a provider client for the given provider type
   */
  static getClient(provider: string): CloudProviderClient {
    const normalizedProvider = provider.toLowerCase();

    if (this.clients.has(normalizedProvider)) {
      return this.clients.get(normalizedProvider)!;
    }

    let client: CloudProviderClient;

    switch (normalizedProvider) {
      case 'aws':
        client = new AwsProviderClient();
        break;
      case 'gcp':
        client = new GcpProviderClient();
        break;
      case 'azure':
        client = new AzureProviderClient();
        break;
      case 'alicloud':
        client = new AliCloudProviderClient();
        break;
      case 'private':
        client = new PrivateCloudProviderClient();
        break;
      default:
        throw new OrionError(`Unsupported cloud provider: ${provider}`, ErrorCode.INTERNAL_ERROR);
    }

    this.clients.set(normalizedProvider, client);
    logger.info({ provider: normalizedProvider }, '[ProviderClientFactory] Created provider client');
    return client;
  }

  /**
   * Get all supported provider names
   */
  static getSupportedProviders(): string[] {
    return ['aws', 'gcp', 'azure', 'alicloud', 'private'];
  }

  /**
   * Check if a provider is supported
   */
  static isSupported(provider: string): boolean {
    return this.getSupportedProviders().includes(provider.toLowerCase());
  }

  /**
   * Clear all cached clients (useful for testing)
   */
  static clearCache(): void {
    this.clients.clear();
  }
}
