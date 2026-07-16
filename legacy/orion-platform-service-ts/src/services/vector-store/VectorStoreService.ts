/**
 * VectorStoreService
 *
 * Business logic layer for vectorize rules and vector collections.
 * Composes VectorizeRuleRepository and VectorCollectionRepository.
 */

import { getCurrentTenantId } from '../../db/tenant-context-storage';
import { OrionError } from '../../errors';
import {
  VectorizeRuleRepository,
  VectorizeRuleEntity,
  VectorCollectionRepository,
  VectorCollectionEntity,
} from './VectorStoreRepository';

export class VectorStoreService {
  constructor(
    private ruleRepo: VectorizeRuleRepository,
    private collectionRepo: VectorCollectionRepository,
  ) {}

  // ==================== Vectorize Rules ====================

  /**
   * List rules for current tenant
   */
  async listRules(filters?: { enabled?: boolean; sourceType?: string }): Promise<VectorizeRuleEntity[]> {
    const tenantId = getCurrentTenantId();
    return this.ruleRepo.findByTenant(tenantId, filters);
  }

  /**
   * Get a single rule by ID (scoped to tenant)
   */
  async getRule(id: string): Promise<VectorizeRuleEntity> {
    const tenantId = getCurrentTenantId();
    const rule = await this.ruleRepo.findByIdAndTenant(id, tenantId);
    if (!rule) {
      throw new OrionError(`Vectorize rule not found: ${id}`, 'NOT_FOUND');
    }
    return rule;
  }

  /**
   * Create a new vectorize rule
   */
  async createRule(data: {
    name: string;
    sourceType: string;
    fileTypes?: string[];
    chunkSize?: number;
    chunkOverlap?: number;
    embeddingModel?: string;
    targetCollection: string;
    enabled?: boolean;
  }): Promise<VectorizeRuleEntity> {
    if (!data.name) {
      throw new OrionError('Rule name is required', 'VALIDATION_ERROR');
    }
    if (!data.targetCollection) {
      throw new OrionError('Target collection is required', 'VALIDATION_ERROR');
    }

    return this.ruleRepo.createForTenant({
      name: data.name,
      sourceType: data.sourceType || 'upload',
      fileTypes: data.fileTypes ?? [],
      chunkSize: data.chunkSize ?? 512,
      chunkOverlap: data.chunkOverlap ?? 50,
      embeddingModel: data.embeddingModel ?? 'text-embedding-3-small',
      targetCollection: data.targetCollection,
      enabled: data.enabled ?? true,
    });
  }

  /**
   * Update an existing vectorize rule
   */
  async updateRule(
    id: string,
    data: Partial<{
      name: string;
      sourceType: string;
      fileTypes: string[];
      chunkSize: number;
      chunkOverlap: number;
      embeddingModel: string;
      targetCollection: string;
      enabled: boolean;
    }>,
  ): Promise<VectorizeRuleEntity> {
    const tenantId = getCurrentTenantId();
    const updated = await this.ruleRepo.updateByIdAndTenant(id, tenantId, data);
    if (!updated) {
      throw new OrionError(`Vectorize rule not found: ${id}`, 'NOT_FOUND');
    }
    return updated;
  }

  /**
   * Delete a vectorize rule
   */
  async deleteRule(id: string): Promise<void> {
    const tenantId = getCurrentTenantId();
    const deleted = await this.ruleRepo.deleteByIdAndTenant(id, tenantId);
    if (!deleted) {
      throw new OrionError(`Vectorize rule not found: ${id}`, 'NOT_FOUND');
    }
  }

  /**
   * Toggle enabled status of a rule
   */
  async toggleRule(id: string, enabled: boolean): Promise<VectorizeRuleEntity> {
    const tenantId = getCurrentTenantId();
    const rule = await this.ruleRepo.toggleEnabled(id, enabled, tenantId);
    if (!rule) {
      throw new OrionError(`Vectorize rule not found: ${id}`, 'NOT_FOUND');
    }
    return rule;
  }

  // ==================== Vector Collections ====================

  /**
   * List collections for current tenant
   */
  async listCollections(filters?: { status?: string }): Promise<VectorCollectionEntity[]> {
    const tenantId = getCurrentTenantId();
    return this.collectionRepo.findByTenant(tenantId, filters);
  }

  /**
   * Get a single collection by ID (scoped to tenant)
   */
  async getCollection(id: string): Promise<VectorCollectionEntity> {
    const tenantId = getCurrentTenantId();
    const collection = await this.collectionRepo.findByIdAndTenant(id, tenantId);
    if (!collection) {
      throw new OrionError(`Vector collection not found: ${id}`, 'NOT_FOUND');
    }
    return collection;
  }

  /**
   * Create a new vector collection
   */
  async createCollection(data: {
    name: string;
    displayName?: string;
    description?: string;
    dimensions?: number;
    indexType?: string;
    distanceMetric?: string;
    status?: string;
    parameters?: Record<string, any>;
  }): Promise<VectorCollectionEntity> {
    if (!data.name) {
      throw new OrionError('Collection name is required', 'VALIDATION_ERROR');
    }

    return this.collectionRepo.createForTenant({
      name: data.name,
      displayName: data.displayName ?? null,
      description: data.description ?? null,
      dimensions: data.dimensions ?? 1536,
      indexType: data.indexType ?? 'hnsw',
      distanceMetric: data.distanceMetric ?? 'cosine',
      status: data.status ?? 'active',
      parameters: data.parameters ?? {},
    });
  }

  /**
   * Delete a vector collection
   */
  async deleteCollection(id: string): Promise<void> {
    const tenantId = getCurrentTenantId();
    const deleted = await this.collectionRepo.deleteByIdAndTenant(id, tenantId);
    if (!deleted) {
      throw new OrionError(`Vector collection not found: ${id}`, 'NOT_FOUND');
    }
  }
}
