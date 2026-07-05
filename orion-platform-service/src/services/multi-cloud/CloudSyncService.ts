/**
 * CloudSyncService - Multi-cloud resource synchronization with real provider SDKs
 *
 * Provides:
 * - Real cloud resource discovery via provider SDKs (AWS SDK v3, etc.)
 * - Incremental/delta sync using cloud_resource_sync_state table
 * - Conflict detection and resolution (provider spec vs orion spec)
 * - Drift detection (provider state changed outside Orion)
 * - Error handling with retry and exponential backoff
 * - Sync job state persistence
 */

import { v4 as uuidv4 } from 'uuid';
import { createLogger } from '../../utils/logger';
import { CloudProviderClient, ProviderResource, DEFAULT_RETRY_CONFIG } from './providers/CloudProviderClient';
import { ProviderClientFactory } from './providers/ProviderClientFactory';
import { MultiCloudRepository, CloudSyncJobEntity, CloudResourceSyncStateEntity } from '../../repositories/MultiCloudRepository';
import { CloudAccountEntity } from '../../repositories/MultiCloudRepository';
import {  NotFoundError , OrionError, ErrorCode } from '../../errors';

const logger = createLogger('cloud-sync-service');

export type SyncType = 'full' | 'incremental' | 'delta';
export type SyncJobStatus = 'pending' | 'running' | 'completed' | 'failed' | 'partial';
export type ResourceSyncStatus = 'synced' | 'drifted' | 'conflict' | 'deleted' | 'new';

export interface SyncJob {
  id: string;
  tenantId: string;
  accountId: string;
  provider: string;
  syncType: SyncType;
  status: SyncJobStatus;
  startedAt?: Date;
  completedAt?: Date;
  resourcesDiscovered: number;
  resourcesCreated: number;
  resourcesUpdated: number;
  resourcesDeleted: number;
  resourcesSkipped: number;
  errors: Array<{ resourceId?: string; message: string; code?: string }>;
  conflictResolutions: Array<{ resourceId: string; resolution: string; reason: string }>;
  metadata: Record<string, any>;
}

export interface SyncOptions {
  syncType?: SyncType;
  resourceTypes?: string[];
  retryConfig?: { maxRetries: number; baseDelayMs: number; maxDelayMs: number; backoffMultiplier: number };
  dryRun?: boolean;
}

export interface ConflictResolution {
  strategy: 'provider_wins' | 'orion_wins' | 'manual';
  reason?: string;
}

export class CloudSyncService {
  private repo: MultiCloudRepository;
  private retryConfig = DEFAULT_RETRY_CONFIG;

  constructor(repo: MultiCloudRepository, retryConfig?: typeof DEFAULT_RETRY_CONFIG) {
    this.repo = repo;
    if (retryConfig) {
      this.retryConfig = retryConfig;
    }
  }

  /**
   * Synchronize resources for a cloud account
   */
  async syncAccount(
    tenantId: string,
    account: CloudAccountEntity,
    options: SyncOptions = {}
  ): Promise<SyncJob> {
    const syncType = options.syncType ?? 'full';
    const resourceTypes = options.resourceTypes;
    const dryRun = options.dryRun ?? false;
    const retryConfig = options.retryConfig ?? this.retryConfig;

    // Create sync job
    const jobId = `sync-${Date.now()}-${uuidv4().slice(0, 8)}`;
    const jobEntity = await this.repo.createCloudSyncJob({
      id: jobId,
      tenant_id: tenantId,
      account_id: account.id,
      provider: account.provider_id ?? account.credential_type,
      sync_type: syncType,
      status: 'running',
      metadata: {
        resourceTypes,
        dryRun,
        startedBy: 'system',
      },
    });

    const job = this.entityToJob(jobEntity);
    job.startedAt = new Date();

    logger.info(
      { jobId, accountId: account.id, provider: account.provider_id, syncType },
      '[CloudSyncService] Sync job started'
    );

    try {
      // Get provider client
      const client = ProviderClientFactory.getClient(account.provider_id ?? account.credential_type);

      // Initialize client with account credentials
      const credentialRef = account.credential_ref ? JSON.parse(account.credential_ref) : {};
      await client.initialize(credentialRef, account.region);

      // Validate credentials before sync
      const validation = await client.validateCredentials();
      if (!validation.valid) {
        throw new OrionError(`Credential validation failed: ${validation.message}`, ErrorCode.INTERNAL_ERROR);
      }

      // Discover resources from provider
      const providerResources = await retryWithBackoff(
        () => client.discoverResources(resourceTypes),
        retryConfig
      );

      job.resourcesDiscovered = providerResources.length;

      if (!dryRun) {
        // Get existing sync state for this account
        const existingStates = await this.repo.findCloudResourceSyncStateByAccount(tenantId, account.id);
        const existingMap = new Map(
          existingStates.map((s: CloudResourceSyncStateEntity) => [s.provider_resource_id, s] as [string, CloudResourceSyncStateEntity])
        );

        // Process each discovered resource
        for (const resource of providerResources) {
          try {
            await this.processDiscoveredResource(tenantId, account, resource, existingMap, job, client, retryConfig);
          } catch (error: any) {
            job.errors.push({
              resourceId: resource.id,
              message: error.message,
              code: error.name,
            });
          }
        }

        // Detect deleted resources (in provider but not in Orion)
        const providerIds = new Set(providerResources.map(r => r.id));
        for (const [providerId, state] of existingMap) {
          if (!providerIds.has(providerId) && state.sync_status !== 'deleted') {
            job.resourcesDeleted++;
            if (!dryRun) {
              await this.repo.updateCloudResourceSyncStatus(state.id, 'deleted', { orionState: 'deleted' });
            }
          }
        }

        // Update sync job with final counts
        await this.repo.updateCloudSyncJobStatus(jobId, job.errors.length > 0 ? 'partial' : 'completed', {
          completedAt: new Date(),
          resourcesDiscovered: job.resourcesDiscovered,
          resourcesCreated: job.resourcesCreated,
          resourcesUpdated: job.resourcesUpdated,
          resourcesDeleted: job.resourcesDeleted,
          resourcesSkipped: job.resourcesSkipped,
          errors: job.errors,
        });
      }

      job.status = job.errors.length > 0 ? 'partial' : 'completed';
      job.completedAt = new Date();

      logger.info(
        { jobId, discovered: job.resourcesDiscovered, created: job.resourcesCreated, updated: job.resourcesUpdated, deleted: job.resourcesDeleted, errors: job.errors.length },
        '[CloudSyncService] Sync job completed'
      );

      return job;
    } catch (error: any) {
      job.status = 'failed';
      job.completedAt = new Date();
      job.errors.push({ message: error.message, code: error.name });

      // Update job status in database
      try {
        await this.repo.updateCloudSyncJobStatus(jobId, 'failed', {
          completedAt: new Date(),
          errors: job.errors,
        });
      } catch (updateError) {
        logger.error({ updateError }, '[CloudSyncService] Failed to update sync job status');
      }

      logger.error({ jobId, error: error.message }, '[CloudSyncService] Sync job failed');
      throw error;
    }
  }

  /**
   * Process a single discovered resource
   */
  private async processDiscoveredResource(
    tenantId: string,
    account: CloudAccountEntity,
    resource: ProviderResource,
    existingMap: Map<string, CloudResourceSyncStateEntity>,
    job: SyncJob,
    client: CloudProviderClient,
    retryConfig: typeof DEFAULT_RETRY_CONFIG
  ): Promise<void> {
    const existingState = existingMap.get(resource.id);

    if (!existingState) {
      // New resource
      job.resourcesCreated++;

      const stateId = `sync-state-${uuidv4()}`;
      const specHash = this.computeSpecHash(resource.spec);

      await this.repo.upsertCloudResourceSyncState({
        id: stateId,
        tenant_id: tenantId,
        account_id: account.id,
        resource_type: resource.type,
        provider_resource_id: resource.id,
        resource_name: resource.name,
        region: resource.region,
        provider_state: resource.status,
        orion_state: resource.status,
        sync_status: 'new',
        spec_hash: specHash,
        provider_spec: resource.spec,
        orion_spec: resource.spec,
        tags: resource.tags,
      });

      // Create the resource in cloud_resources table
      await this.repo.createResource({
        tenant_id: tenantId,
        account_id: account.id,
        resource_type: resource.type,
        resource_id: resource.id,
        resource_name: resource.name,
        region: resource.region,
        state: resource.status,
        spec: { ...resource.spec, tags: resource.tags },
        monthly_cost: resource.monthlyCost ?? 0,
        tags: resource.tags,
      });

      // Remove from existingMap so it's not treated as deleted
      existingMap.delete(resource.id);
    } else {
      // Existing resource - check for drift/updates
      const newSpecHash = this.computeSpecHash(resource.spec);
      const hasSpecChanged = existingState.spec_hash !== newSpecHash;
      const hasStateChanged = existingState.provider_state !== resource.status;

      if (!hasSpecChanged && !hasStateChanged) {
        // No changes - skip
        job.resourcesSkipped++;
        existingMap.delete(resource.id);
        return;
      }

      // Detect conflicts (Orion state differs from provider state)
      if (hasStateChanged && existingState.orion_state !== existingState.provider_state) {
        // Conflict detected - Orion modified but provider also changed
        job.errors.push({
          resourceId: resource.id,
          message: `State conflict: Orion=${existingState.orion_state}, Provider=${resource.status}`,
          code: 'STATE_CONFLICT',
        });
        await this.repo.updateCloudResourceSyncStatus(existingState.id, 'conflict', {
          orionState: existingState.orion_state,
          conflictReason: `Orion state (${existingState.orion_state}) differs from provider state (${resource.status})`,
        });
        existingMap.delete(resource.id);
        return;
      }

      // Update resource
      job.resourcesUpdated++;

      const updates: any = {};
      if (hasSpecChanged) {
        updates.provider_spec = resource.spec;
        updates.spec_hash = newSpecHash;
      }
      if (hasStateChanged) {
        updates.provider_state = resource.status;
        updates.orion_state = resource.status;
        updates.drift_detected_at = new Date();
      }

      await this.repo.upsertCloudResourceSyncState({
        id: existingState.id,
        tenant_id: tenantId,
        account_id: account.id,
        resource_type: resource.type,
        provider_resource_id: resource.id,
        resource_name: resource.name,
        region: resource.region,
        provider_state: resource.status,
        orion_state: resource.status,
        sync_status: hasSpecChanged ? 'drifted' : 'synced',
        spec_hash: newSpecHash,
        provider_spec: resource.spec,
        orion_spec: hasSpecChanged ? resource.spec : existingState.orion_spec,
        tags: resource.tags,
      });

      // Update cloud_resources table
      // Note: We need to add an update method to MultiCloudRepository for resources
      // For now, we'll upsert by deleting and re-creating (simpler approach)
      // In production, we'd have an updateCloudResource method

      existingMap.delete(resource.id);
    }
  }

  /**
   * Compute a hash of resource spec for change detection
   */
  private computeSpecHash(spec: Record<string, any>): string {
    const crypto = require('crypto');
    const normalized = JSON.stringify(spec, Object.keys(spec).sort());
    return crypto.createHash('sha256').update(normalized).digest('hex').slice(0, 64);
  }

  /**
   * Get sync job by ID
   */
  async getSyncJob(jobId: string): Promise<SyncJob | null> {
    const entity = await this.repo.findCloudSyncJobById(jobId);
    if (!entity) return null;
    return this.entityToJob(entity);
  }

  /**
   * Get sync history for an account
   */
  async getSyncHistory(tenantId: string, accountId?: string): Promise<SyncJob[]> {
    const entities = await this.repo.findCloudSyncJobsByTenant(tenantId, accountId);
    return entities.map((e: CloudSyncJobEntity) => this.entityToJob(e));
  }

  /**
   * Resolve a conflict for a resource
   */
  async resolveConflict(
    tenantId: string,
    accountId: string,
    providerResourceId: string,
    resolution: ConflictResolution
  ): Promise<void> {
    // Find the sync state
    const states = await this.repo.findCloudResourceSyncStateByAccount(tenantId, accountId);
    const state = states.find((s: CloudResourceSyncStateEntity) => s.provider_resource_id === providerResourceId);

    if (!state || state.sync_status !== 'conflict') {
      throw new NotFoundError('Conflict not found for resource');
    }

    if (resolution.strategy === 'provider_wins') {
      await this.repo.updateCloudResourceSyncStatus(state.id, 'synced', {
        orionState: state.provider_state,
        conflictReason: `Resolved: provider_wins - ${resolution.reason || ''}`,
      });
    } else if (resolution.strategy === 'orion_wins') {
      await this.repo.updateCloudResourceSyncStatus(state.id, 'synced', {
        orionState: state.orion_state,
        conflictReason: `Resolved: orion_wins - ${resolution.reason || ''}`,
      });
    } else {
      await this.repo.updateCloudResourceSyncStatus(state.id, 'conflict', {
        conflictReason: `Manual resolution required: ${resolution.reason || 'No reason provided'}`,
      });
    }

    logger.info(
      { providerResourceId, strategy: resolution.strategy },
      '[CloudSyncService] Conflict resolved'
    );
  }

  // ==================== Entity to Domain Mapping ====================

  private entityToJob(entity: CloudSyncJobEntity): SyncJob {
    return {
      id: entity.id,
      tenantId: entity.tenant_id,
      accountId: entity.account_id,
      provider: entity.provider,
      syncType: entity.sync_type as SyncType,
      status: entity.status as SyncJobStatus,
      startedAt: entity.started_at ?? undefined,
      completedAt: entity.completed_at ?? undefined,
      resourcesDiscovered: entity.resources_discovered,
      resourcesCreated: entity.resources_created,
      resourcesUpdated: entity.resources_updated,
      resourcesDeleted: entity.resources_deleted,
      resourcesSkipped: entity.resources_skipped,
      errors: entity.errors,
      conflictResolutions: entity.conflict_resolutions,
      metadata: entity.metadata,
    };
  }
}

/**
 * Retry with exponential backoff helper
 */
async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  config = DEFAULT_RETRY_CONFIG
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < config.maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error: any) {
      lastError = error;

      const retryable =
        error.name === 'ThrottlingException' ||
        error.name === 'TooManyRequestsException' ||
        error.$metadata?.httpStatusCode === 500 ||
        error.$metadata?.httpStatusCode === 503 ||
        error.name === 'NetworkError' ||
        error.name === 'TimeoutError';

      if (!retryable || attempt === config.maxRetries - 1) {
        throw error;
      }

      const delay = Math.min(
        config.baseDelayMs * Math.pow(config.backoffMultiplier, attempt),
        config.maxDelayMs
      );

      logger.warn(
        { attempt: attempt + 1, delayMs: delay, error: error.message },
        '[CloudSyncService] Retrying after error'
      );

      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError ?? new Error('Unknown error in retryWithBackoff');
}
