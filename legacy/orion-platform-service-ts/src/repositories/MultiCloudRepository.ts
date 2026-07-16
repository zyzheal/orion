/**
 * MultiCloudRepository - Facade for Multi-Cloud persistence
 *
 * Delegates to specialized repositories:
 * - CloudAccountRepository: cloud accounts and resource inventory
 * - DRRepository: cross-zone DR configurations and DR test results
 * - NetworkRepository: cloud networks and scheduling policies/decisions
 * - SyncRepository: cloud sync jobs and resource sync state
 *
 * All entity types are re-exported for backward compatibility.
 */

import {
  CloudAccountRepository,
  CloudAccountEntity,
  CloudResourceEntity,
} from './multi-cloud/CloudAccountRepository';
import {
  DRRepository,
  CrossZoneDREntity,
  DRTestResultEntity,
} from './multi-cloud/DRRepository';
import {
  NetworkRepository,
  CloudNetworkEntity,
  SchedulingPolicyEntity,
  SchedulingDecisionEntity,
} from './multi-cloud/NetworkRepository';
import {
  SyncRepository,
  CloudSyncJobEntity,
  CloudResourceSyncStateEntity,
} from './multi-cloud/SyncRepository';

// =============================================================================
// MultiCloudRepository (Facade)
// =============================================================================

export class MultiCloudRepository {
  private accountRepo: CloudAccountRepository;
  private drRepo: DRRepository;
  private networkRepo: NetworkRepository;
  private syncRepo: SyncRepository;

  constructor(
    db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> },
  ) {
    this.accountRepo = new CloudAccountRepository(db);
    this.drRepo = new DRRepository(db);
    this.networkRepo = new NetworkRepository(db);
    this.syncRepo = new SyncRepository(db);
  }

  // ==================== Cloud Account Operations ====================

  async createCloudAccount(input: Parameters<CloudAccountRepository['createCloudAccount']>[0]): Promise<CloudAccountEntity> {
    return this.accountRepo.createCloudAccount(input);
  }

  async findAccountById(id: string): Promise<CloudAccountEntity | undefined> {
    return this.accountRepo.findAccountById(id);
  }

  async findAccountsByTenant(tenantId: string): Promise<CloudAccountEntity[]> {
    return this.accountRepo.findAccountsByTenant(tenantId);
  }

  async deleteCloudAccount(id: string, tenantId: string): Promise<boolean> {
    return this.accountRepo.deleteCloudAccount(id, tenantId);
  }

  // ==================== Resource Inventory Operations ====================

  async createResource(input: Parameters<CloudAccountRepository['createResource']>[0]): Promise<CloudResourceEntity> {
    return this.accountRepo.createResource(input);
  }

  async findResourcesByTenant(tenantId: string, accountId?: string): Promise<CloudResourceEntity[]> {
    return this.accountRepo.findResourcesByTenant(tenantId, accountId);
  }

  async deleteResourcesByAccount(accountId: string, tenantId: string): Promise<number> {
    return this.accountRepo.deleteResourcesByAccount(accountId, tenantId);
  }

  // ==================== Cross-Zone DR Operations ====================

  async createCrossZoneDR(input: Parameters<DRRepository['createCrossZoneDR']>[0]): Promise<CrossZoneDREntity> {
    return this.drRepo.createCrossZoneDR(input);
  }

  async findCrossZoneDRById(id: string): Promise<CrossZoneDREntity | undefined> {
    return this.drRepo.findCrossZoneDRById(id);
  }

  async findCrossZoneDRByTenant(tenantId: string): Promise<CrossZoneDREntity[]> {
    return this.drRepo.findCrossZoneDRByTenant(tenantId);
  }

  async updateCrossZoneDRStatus(id: string, status: string, lastTestAt?: Date | null): Promise<void> {
    return this.drRepo.updateCrossZoneDRStatus(id, status, lastTestAt);
  }

  // ==================== DR Test Result Operations ====================

  async createDRTestResult(input: Parameters<DRRepository['createDRTestResult']>[0]): Promise<DRTestResultEntity> {
    return this.drRepo.createDRTestResult(input);
  }

  async findDRTestResultsByDRId(drId: string): Promise<DRTestResultEntity[]> {
    return this.drRepo.findDRTestResultsByDRId(drId);
  }

  // ==================== Cloud Network Operations ====================

  async createCloudNetwork(input: Parameters<NetworkRepository['createCloudNetwork']>[0]): Promise<CloudNetworkEntity> {
    return this.networkRepo.createCloudNetwork(input);
  }

  async findCloudNetworkById(id: string): Promise<CloudNetworkEntity | undefined> {
    return this.networkRepo.findCloudNetworkById(id);
  }

  async findCloudNetworksByTenant(tenantId: string): Promise<CloudNetworkEntity[]> {
    return this.networkRepo.findCloudNetworksByTenant(tenantId);
  }

  // ==================== Scheduling Policy Operations ====================

  async createSchedulingPolicy(input: Parameters<NetworkRepository['createSchedulingPolicy']>[0]): Promise<SchedulingPolicyEntity> {
    return this.networkRepo.createSchedulingPolicy(input);
  }

  async findSchedulingPolicyById(id: string): Promise<SchedulingPolicyEntity | undefined> {
    return this.networkRepo.findSchedulingPolicyById(id);
  }

  async findSchedulingPoliciesByTenant(tenantId: string): Promise<SchedulingPolicyEntity[]> {
    return this.networkRepo.findSchedulingPoliciesByTenant(tenantId);
  }

  // ==================== Scheduling Decision Operations ====================

  async createSchedulingDecision(input: Parameters<NetworkRepository['createSchedulingDecision']>[0]): Promise<SchedulingDecisionEntity> {
    return this.networkRepo.createSchedulingDecision(input);
  }

  async findSchedulingDecisionsByPolicyId(policyId: string): Promise<SchedulingDecisionEntity[]> {
    return this.networkRepo.findSchedulingDecisionsByPolicyId(policyId);
  }

  // ==================== Cloud Sync Job Operations ====================

  async createCloudSyncJob(input: Parameters<SyncRepository['createCloudSyncJob']>[0]): Promise<CloudSyncJobEntity> {
    return this.syncRepo.createCloudSyncJob(input);
  }

  async findCloudSyncJobById(id: string): Promise<CloudSyncJobEntity | undefined> {
    return this.syncRepo.findCloudSyncJobById(id);
  }

  async findCloudSyncJobsByTenant(tenantId: string, accountId?: string): Promise<CloudSyncJobEntity[]> {
    return this.syncRepo.findCloudSyncJobsByTenant(tenantId, accountId);
  }

  async updateCloudSyncJobStatus(
    id: string,
    status: string,
    updates?: Parameters<SyncRepository['updateCloudSyncJobStatus']>[2],
  ): Promise<CloudSyncJobEntity> {
    return this.syncRepo.updateCloudSyncJobStatus(id, status, updates);
  }

  // ==================== Cloud Resource Sync State Operations ====================

  async upsertCloudResourceSyncState(input: Parameters<SyncRepository['upsertCloudResourceSyncState']>[0]): Promise<CloudResourceSyncStateEntity> {
    return this.syncRepo.upsertCloudResourceSyncState(input);
  }

  async findCloudResourceSyncStateByAccount(tenantId: string, accountId: string): Promise<CloudResourceSyncStateEntity[]> {
    return this.syncRepo.findCloudResourceSyncStateByAccount(tenantId, accountId);
  }

  async updateCloudResourceSyncStatus(
    id: string,
    syncStatus: string,
    updates?: Parameters<SyncRepository['updateCloudResourceSyncStatus']>[2],
  ): Promise<CloudResourceSyncStateEntity> {
    return this.syncRepo.updateCloudResourceSyncStatus(id, syncStatus, updates);
  }

  async deleteCloudResourceSyncStateByAccount(tenantId: string, accountId: string): Promise<number> {
    return this.syncRepo.deleteCloudResourceSyncStateByAccount(tenantId, accountId);
  }
}
