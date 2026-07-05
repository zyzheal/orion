/**
 * GCP Provider Client
 *
 * Real GCP integration using @google-cloud/compute and @google-cloud/storage.
 */

import { OrionError, ErrorCode } from '../../../errors';
import { createLogger } from '../../../utils/logger';
import { Storage } from '@google-cloud/storage';
import ComputeModule from '@google-cloud/compute';
import { CloudProviderClient, ProviderResource, ProviderCostEntry, ProviderHealthStatus, CredentialValidationResult } from './CloudProviderClient';

const logger = createLogger('gcp-provider-client');

export class GcpProviderClient implements CloudProviderClient {
  readonly provider = 'gcp';
  private projectId: string = '';
  private region: string = '';
  private credentials: Record<string, string> = {};
  private storage: Storage | null = null;
  private compute: any = null;

  async initialize(credentials: Record<string, string>, region: string): Promise<void> {
    this.credentials = credentials;
    this.region = region;
    this.projectId = credentials.projectId ?? credentials.project_id ?? '';

    if (!this.projectId) {
      throw new OrionError('GCP projectId is required in credentials', ErrorCode.VALIDATION_ERROR);
    }

    // Build Google Cloud client options
    const clientOptions: any = { projectId: this.projectId };

    // If keyFilename or credentials JSON provided, use it
    if (credentials.keyFilename) {
      clientOptions.keyFilename = credentials.keyFilename;
    } else if (credentials.credentialsJson) {
      clientOptions.credentials = JSON.parse(credentials.credentialsJson);
    }

    try {
      this.storage = new Storage(clientOptions);
      // @google-cloud/compute v4+ types diverged from the v3 unified API.
      // Cast to any since the runtime module still supports the old unified constructor.
      this.compute = new (ComputeModule as any)(clientOptions);
    } catch (error: any) {
      logger.error({ error: error.message }, '[GcpProviderClient] Failed to initialize GCP clients');
      throw error;
    }
  }

  async validateCredentials(): Promise<CredentialValidationResult> {
    if (!this.projectId) {
      return {
        valid: false,
        message: 'Project ID is required for GCP credential validation',
      };
    }

    try {
      // Validate by attempting to list buckets (requires storage.buckets.list permission)
      if (!this.storage) {
        // If no storage client, try to create one just for validation
        const tempStorage = new Storage({ projectId: this.projectId });
        await tempStorage.getBuckets({ autoPaginate: false });
      } else {
        await this.storage.getBuckets({ autoPaginate: false });
      }

      return {
        valid: true,
        accountId: this.projectId,
        message: 'GCP credentials validated successfully',
        details: {
          projectId: this.projectId,
        },
      };
    } catch (error: any) {
      logger.error({ error: error.message }, '[GcpProviderClient] Credential validation failed');
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
        apiVersion: 'Google Cloud APIs',
        details: {
          projectId: this.projectId,
          message: validation.message,
        },
      };
    } catch (error: any) {
      return {
        healthy: false,
        latencyMs: Date.now() - startTime,
        apiVersion: 'Google Cloud APIs',
        details: { error: error.message },
      };
    }
  }

  async discoverResources(resourceTypes?: string[]): Promise<ProviderResource[]> {
    if (!this.projectId) {
      throw new OrionError('GCP projectId is required - call initialize() first', ErrorCode.VALIDATION_ERROR);
    }

    const resources: ProviderResource[] = [];
    const typesToDiscover = resourceTypes ?? ['compute_engine', 'cloud_storage'];

    // Discover Compute Engine instances
    if (typesToDiscover.includes('compute_engine')) {
      try {
        const instances = await this.discoverComputeInstances();
        resources.push(...instances);
      } catch (error: any) {
        logger.error({ error: error.message }, '[GcpProviderClient] Failed to discover Compute Engine instances');
      }
    }

    // Discover Cloud Storage buckets
    if (typesToDiscover.includes('cloud_storage')) {
      try {
        const buckets = await this.discoverStorageBuckets();
        resources.push(...buckets);
      } catch (error: any) {
        logger.error({ error: error.message }, '[GcpProviderClient] Failed to discover Cloud Storage buckets');
      }
    }

    return resources;
  }

  async getCostSummary(month?: string): Promise<{ totalCost: number; currency: string; breakdown: ProviderCostEntry[] }> {
    // Cloud Billing API requires additional setup and permissions
    // For now, return empty breakdown - real implementation would use @google-cloud/billing
    const targetMonth = month ?? new Date().toISOString().slice(0, 7);

    logger.warn('[GcpProviderClient] getCostSummary not fully implemented - requires Cloud Billing API setup');

    return {
      totalCost: 0,
      currency: 'USD',
      breakdown: [],
    };
  }

  async getResource(providerResourceId: string): Promise<ProviderResource | null> {
    if (!this.projectId) {
      throw new OrionError('GCP projectId is required - call initialize() first', ErrorCode.VALIDATION_ERROR);
    }

    // Try as Compute Engine instance
    try {
      const instance = await this.getComputeInstance(providerResourceId);
      if (instance) return instance;
    } catch {
      // Not an instance or other error
    }

    // Try as Cloud Storage bucket
    try {
      const bucket = await this.getStorageBucket(providerResourceId);
      if (bucket) return bucket;
    } catch {
      // Not a bucket or other error
    }

    return null;
  }

  // ==================== Private Methods ====================

  private async discoverComputeInstances(): Promise<ProviderResource[]> {
    if (!this.compute) {
      throw new OrionError('Compute client not initialized', ErrorCode.UNAUTHORIZED);
    }

    const instances: ProviderResource[] = [];

    // Use the Compute client to list instances across all zones
    const zones = await this.getAvailableZones();
    for (const zone of zones) {
      try {
        const [instances] = await this.compute.getInstances({
          project: this.projectId,
          zone,
          autoPaginate: false,
        });

        for (const instance of instances) {
          const metadata: Record<string, any> = {};
          for (const [key, value] of Object.entries(instance.metadata || {})) {
            metadata[key] = value;
          }

          instances.push({
            id: instance.id || instance.name || `unknown-${Date.now()}`,
            name: instance.name || 'unnamed',
            type: 'compute_engine',
            region: zone.split('-').slice(0, 2).join('-'),
            status: instance.status === 'RUNNING' ? 'running' : instance.status?.toLowerCase() || 'unknown',
            tags: instance.labels || {},
            spec: {
              machineType: instance.machineType,
              zone: zone,
              status: instance.status,
              ...metadata,
            },
            monthlyCost: 0,
          });
        }
      } catch (error: any) {
        // Skip zones we don't have access to
        logger.debug({ zone, error: error.message }, '[GcpProviderClient] Skipping zone');
      }
    }

    return instances;
  }

  private async discoverStorageBuckets(): Promise<ProviderResource[]> {
    if (!this.storage) {
      throw new OrionError('Storage client not initialized', ErrorCode.UNAUTHORIZED);
    }

    const buckets: ProviderResource[] = [];

    try {
      const [bucketsList] = await this.storage.getBuckets({ autoPaginate: false });

      for (const bucket of bucketsList) {
        const b = bucket as any;
        if (!b.name) continue;

        buckets.push({
          id: b.name,
          name: b.name,
          type: 'cloud_storage',
          region: this.region || 'global',
          status: 'active',
          tags: b.labels || {},
          spec: {
            storageClass: b.storageClass,
            location: b.location,
            locationType: b.locationType,
            createdAt: b.timeCreated,
          },
          monthlyCost: 0,
        });
      }
    } catch (error: any) {
      logger.error({ error: error.message }, '[GcpProviderClient] Failed to list storage buckets');
    }

    return buckets;
  }

  private async getComputeInstance(instanceId: string): Promise<ProviderResource | null> {
    if (!this.compute) return null;

    const zones = await this.getAvailableZones();
    for (const zone of zones) {
      try {
        const [instance] = await this.compute.getInstance({
          project: this.projectId,
          zone,
          instance: instanceId,
        });

        if (instance) {
          return {
            id: instance.id || instance.name,
            name: instance.name || 'unnamed',
            type: 'compute_engine',
            region: zone.split('-').slice(0, 2).join('-'),
            status: instance.status === 'RUNNING' ? 'running' : instance.status?.toLowerCase() || 'unknown',
            tags: instance.labels || {},
            spec: {
              machineType: instance.machineType,
              zone: zone,
              status: instance.status,
            },
          };
        }
      } catch {
        // Continue to next zone
      }
    }

    return null;
  }

  private async getStorageBucket(bucketId: string): Promise<ProviderResource | null> {
    if (!this.storage) return null;

    try {
      const [bucket] = await this.storage.bucket(bucketId).get();

      const b = bucket as any;
      if (b) {
        return {
          id: b.name,
          name: b.name,
          type: 'cloud_storage',
          region: b.location || this.region || 'global',
          status: 'active',
          tags: b.labels || {},
          spec: {
            storageClass: b.storageClass,
            location: b.location,
            locationType: b.locationType,
          },
        };
      }
    } catch {
      // Bucket not found or other error
    }

    return null;
  }

  private async getAvailableZones(): Promise<string[]> {
    if (!this.compute) {
      // Return common zones if compute client not available
      return [
        `${this.region}-a`,
        `${this.region}-b`,
        `${this.region}-c`,
      ];
    }

    try {
      const [zones] = await this.compute.getZones({
        project: this.projectId,
        autoPaginate: false,
      });

      return zones.map((zone: { name?: string }) => zone.name || '').filter((name: string) => name.length > 0);
    } catch (error: any) {
      logger.warn({ error: error.message }, '[GcpProviderClient] Failed to list zones, using defaults');
      return [
        `${this.region}-a`,
        `${this.region}-b`,
        `${this.region}-c`,
      ];
    }
  }
}
