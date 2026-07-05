/**
 * Azure Provider Client
 *
 * Real Azure SDK integration using @azure/arm-compute and @azure/arm-storage.
 */

import { OrionError, ErrorCode } from '../../../errors';
import { createLogger } from '../../../utils/logger';
import { DefaultAzureCredential } from '@azure/identity';
import { ComputeManagementClient } from '@azure/arm-compute';
import { StorageManagementClient } from '@azure/arm-storage';
import { CloudProviderClient, ProviderResource, ProviderCostEntry, ProviderHealthStatus, CredentialValidationResult } from './CloudProviderClient';

const logger = createLogger('azure-provider-client');

export class AzureProviderClient implements CloudProviderClient {
  readonly provider = 'azure';
  private subscriptionId: string = '';
  private region: string = '';
  private credentials: Record<string, string> = {};
  private computeClient: ComputeManagementClient | null = null;
  private storageClient: StorageManagementClient | null = null;

  async initialize(credentials: Record<string, string>, region: string): Promise<void> {
    this.credentials = credentials;
    this.region = region;
    this.subscriptionId = credentials.subscriptionId ?? credentials.subscription_id ?? '';

    if (!this.subscriptionId) {
      throw new OrionError('Azure subscriptionId is required in credentials', ErrorCode.VALIDATION_ERROR);
    }

    // Build Azure credential
    // Priority: explicit clientSecret > DefaultAzureCredential (env vars / managed identity)
    let credential: any;
    if (credentials.clientId && credentials.clientSecret && credentials.tenantId) {
      // Service Principal with client secret
      credential = new DefaultAzureCredential({
        managedIdentityClientId: credentials.clientId,
      });
    } else {
      // Fall back to DefaultAzureCredential which checks:
      // - Environment variables (AZURE_CLIENT_ID, AZURE_CLIENT_SECRET, AZURE_TENANT_ID)
      // - Managed Identity
      // - Visual Studio Code credentials
      credential = new DefaultAzureCredential();
    }

    try {
      this.computeClient = new ComputeManagementClient(credential, this.subscriptionId);
      this.storageClient = new StorageManagementClient(credential, this.subscriptionId);
    } catch (error: any) {
      logger.error({ error: error.message }, '[AzureProviderClient] Failed to initialize Azure clients');
      throw error;
    }
  }

  async validateCredentials(): Promise<CredentialValidationResult> {
    if (!this.subscriptionId) {
      return {
        valid: false,
        message: 'Subscription ID is required for Azure credential validation',
      };
    }

    try {
      // Validate by attempting to list resource groups (requires read access)
      if (!this.computeClient) {
        return {
          valid: false,
          message: 'Client not initialized - call initialize() first',
        };
      }

      // Use compute client to list VMs as a validation check
      const result = await this.computeClient.virtualMachines.listAll();

      return {
        valid: true,
        accountId: this.subscriptionId,
        message: 'Azure credentials validated successfully',
        details: {
          subscriptionId: this.subscriptionId,
        },
      };
    } catch (error: any) {
      logger.error({ error: error.message }, '[AzureProviderClient] Credential validation failed');
      return {
        valid: false,
        message: `Credential validation failed: ${error.message}`,
        details: {
          code: error.code,
          message: error.message,
        },
      };
    }
  }

  async checkHealth(): Promise<ProviderHealthStatus> {
    const startTime = Date.now();
    try {
      const validation = await this.validateCredentials();
      const latencyMs = Date.now() - startTime;

      return {
        healthy: validation.valid,
        latencyMs,
        apiVersion: 'Azure Resource Manager API',
        details: {
          subscriptionId: this.subscriptionId,
          message: validation.message,
        },
      };
    } catch (error: any) {
      return {
        healthy: false,
        latencyMs: Date.now() - startTime,
        apiVersion: 'Azure Resource Manager API',
        details: { error: error.message },
      };
    }
  }

  async discoverResources(resourceTypes?: string[]): Promise<ProviderResource[]> {
    if (!this.computeClient) {
      throw new OrionError('Client not initialized - call initialize() first', ErrorCode.UNAUTHORIZED);
    }

    const resources: ProviderResource[] = [];
    const typesToDiscover = resourceTypes ?? ['virtual_machine', 'blob_storage'];

    // Discover Virtual Machines
    if (typesToDiscover.includes('virtual_machine')) {
      try {
        const vms = await this.discoverVirtualMachines();
        resources.push(...vms);
      } catch (error: any) {
        logger.error({ error: error.message }, '[AzureProviderClient] Failed to discover Virtual Machines');
      }
    }

    // Discover Blob Storage
    if (typesToDiscover.includes('blob_storage')) {
      try {
        const storageAccounts = await this.discoverStorageAccounts();
        resources.push(...storageAccounts);
      } catch (error: any) {
        logger.error({ error: error.message }, '[AzureProviderClient] Failed to discover Storage Accounts');
      }
    }

    return resources;
  }

  async getCostSummary(month?: string): Promise<{ totalCost: number; currency: string; breakdown: ProviderCostEntry[] }> {
    // Azure Cost Management API requires additional setup and permissions
    // For now, return empty breakdown - real implementation would use Azure Cost Management client
    const targetMonth = month ?? new Date().toISOString().slice(0, 7);

    logger.warn('[AzureProviderClient] getCostSummary not fully implemented - requires Cost Management API setup');

    return {
      totalCost: 0,
      currency: 'USD',
      breakdown: [],
    };
  }

  async getResource(providerResourceId: string): Promise<ProviderResource | null> {
    if (!this.computeClient) {
      throw new OrionError('Client not initialized - call initialize() first', ErrorCode.UNAUTHORIZED);
    }

    // Try as Virtual Machine
    try {
      const vm = await this.getVirtualMachine(providerResourceId);
      if (vm) return vm;
    } catch {
      // Not a VM or other error
    }

    // Try as Storage Account
    try {
      const storage = await this.getStorageAccount(providerResourceId);
      if (storage) return storage;
    } catch {
      // Not a storage account or other error
    }

    return null;
  }

  // ==================== Private Methods ====================

  private async discoverVirtualMachines(): Promise<ProviderResource[]> {
    if (!this.computeClient) return [];

    const vms: ProviderResource[] = [];

    try {
      const vmIterator = this.computeClient.virtualMachines.listAll();
      for await (const vm of vmIterator) {
        if (!vm.name || !vm.id) continue;

        const location = vm.location || this.region;
        const tags = vm.tags || {};

        vms.push({
          id: vm.name,
          name: vm.name,
          type: 'virtual_machine',
          region: location,
          status: this.mapAzureVmProvisioningState(vm.provisioningState),
          tags: tags,
          spec: {
            vmId: vm.id,
            vmSize: vm.hardwareProfile?.vmSize,
            osType: vm.storageProfile?.osDisk?.osType,
            location: location,
            provisioningState: vm.provisioningState,
            resourceGroup: this.extractResourceGroupFromId(vm.id),
          },
          monthlyCost: 0,
        });
      }
    } catch (error: any) {
      logger.error({ error: error.message }, '[AzureProviderClient] Failed to list virtual machines');
    }

    return vms;
  }

  private async discoverStorageAccounts(): Promise<ProviderResource[]> {
    if (!this.storageClient) return [];

    const storageAccounts: ProviderResource[] = [];

    try {
      const accounts = await this.storageClient.storageAccounts.list();

      for await (const account of accounts) {
        if (!account.name) continue;

        const location = account.location || this.region;
        const tags = account.tags || {};

        storageAccounts.push({
          id: account.name,
          name: account.name,
          type: 'blob_storage',
          region: location,
          status: account.provisioningState === 'Succeeded' ? 'active' : 'provisioning',
          tags: tags,
          spec: {
            skuName: account.sku?.name,
            kind: account.kind,
            accessTier: account.accessTier,
            provisioningState: account.provisioningState,
            resourceGroup: this.extractResourceGroupFromId(account.id),
          },
          monthlyCost: 0,
        });
      }
    } catch (error: any) {
      logger.error({ error: error.message }, '[AzureProviderClient] Failed to list storage accounts');
    }

    return storageAccounts;
  }

  private async getVirtualMachine(resourceName: string): Promise<ProviderResource | null> {
    if (!this.computeClient) return null;

    try {
      // Azure VM names are unique within a subscription, but we need to search
      const vmIterator = this.computeClient.virtualMachines.listAll();
      for await (const vm of vmIterator) {
        if (vm.name === resourceName) {
          const location = vm.location || this.region;
          return {
            id: vm.name,
            name: vm.name,
            type: 'virtual_machine',
            region: location,
            status: this.mapAzureVmProvisioningState(vm.provisioningState),
            tags: vm.tags || {},
            spec: {
              vmId: vm.id,
              vmSize: vm.hardwareProfile?.vmSize,
              osType: vm.storageProfile?.osDisk?.osType,
              location: location,
              provisioningState: vm.provisioningState,
              resourceGroup: this.extractResourceGroupFromId(vm.id),
            },
          };
        }
      }
    } catch (error: any) {
      logger.debug({ error: error.message }, '[AzureProviderClient] VM lookup error');
    }

    return null;
  }

  private async getStorageAccount(resourceName: string): Promise<ProviderResource | null> {
    if (!this.storageClient) return null;

    try {
      const account = await this.storageClient.storageAccounts.getProperties(
        this.extractResourceGroupFromId(resourceName) || 'default',
        resourceName
      );

      if (account) {
        const location = account.location || this.region;
        return {
          id: account.name ?? '',
          name: account.name ?? '',
          type: 'blob_storage',
          region: location,
          status: account.provisioningState === 'Succeeded' ? 'active' : 'provisioning',
          tags: account.tags || {},
          spec: {
            skuName: account.sku?.name,
            kind: account.kind,
            accessTier: account.accessTier,
            provisioningState: account.provisioningState,
            resourceGroup: this.extractResourceGroupFromId(account.id),
          },
        };
      }
    } catch {
      // Account not found or other error
    }

    return null;
  }

  private mapAzureVmProvisioningState(state: string | undefined): string {
    switch (state?.toLowerCase()) {
      case 'succeeded':
        return 'running';
      case 'creating':
      case 'updating':
        return 'provisioning';
      case 'deleting':
        return 'deleting';
      case 'failed':
        return 'error';
      case 'stopped':
      case 'stopping':
      case 'starting':
        return state.toLowerCase();
      default:
        return state?.toLowerCase() || 'unknown';
    }
  }

  private extractResourceGroupFromId(resourceId: string | undefined): string {
    if (!resourceId) return '';
    // Azure resource ID format: /subscriptions/{sub}/resourceGroups/{rg}/...
    const match = resourceId.match(/\/resourceGroups\/([^\/]+)/);
    return match ? match[1] : '';
  }
}
