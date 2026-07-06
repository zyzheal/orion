/**
 * ArtifactOperationService - 制品操作追踪服务
 *
 * Provides artifact operation tracking, history, and statistics
 * using PostgreSQL-backed repositories.
 *
 * Task 2.38: 统一 SimpleFallbackStorage
 *   - 移除模块级 inMemoryOperations Map
 *   - 使用 SimpleFallbackStorage 替代直接内存操作
 *   - 保持 tenant_id 隔离（key 前缀包含 tenantId）
 *
 * TASK-504: 制品运营
 */

import { v4 as uuidv4 } from 'uuid';
import { createLogger } from '../../utils/logger';
import {
  ArtifactOperationRepository,
  ArtifactOperationEntity,
} from '../../repositories/ArtifactOperationRepository';
import { SimpleFallbackStorage } from '../fallback/FallbackStorageService';
import type { DatabasePool } from '../database';

const logger = createLogger('ArtifactOperationService');

// ==================== Domain Types ====================

export type ArtifactOperationType = 'upload' | 'download' | 'delete' | 'scan' | 'promote' | 'quarantine' | 'copy' | 'move' | 'tag' | 'untag';

export interface ArtifactOperationInput {
  artifactId: string;
  operation: ArtifactOperationType;
  source?: string;
  target?: string;
  metadata?: Record<string, unknown>;
  initiatedBy?: string;
}

export interface ArtifactOperationRecord {
  id: string;
  tenantId: string;
  artifactId: string;
  operation: ArtifactOperationType;
  source?: string;
  target?: string;
  metadata?: Record<string, unknown>;
  status: string;
  initiatedBy?: string;
  createdAt: Date;
  completedAt?: Date;
  durationMs?: number;
}

export interface ArtifactStats {
  tenantId: string;
  totalOperations: number;
  operationsByType: Record<string, number>;
  operationsByStatus: Record<string, number>;
  uniqueArtifacts: number;
  averageDuration: number;
  successRate: number;
}

export interface OperationHistoryFilter {
  artifactId?: string;
  operation?: ArtifactOperationType;
  status?: string;
  initiatedBy?: string;
  startDate?: string;
  endDate?: string;
}

// ==================== Storage Key Helper ====================

const OPS_PREFIX = 'artifact-ops';

function tenantOpsKey(tenantId: string): string {
  return `${OPS_PREFIX}:tenant:${tenantId}`;
}

// ==================== ArtifactOperationService ====================

export class ArtifactOperationService {
  private operationRepository: ArtifactOperationRepository | null;
  private storage: SimpleFallbackStorage | null;

  /**
   * @param db - DatabasePool, or null for in-memory mode.
   */
  constructor(db: DatabasePool | null) {
    this.operationRepository = db ? new ArtifactOperationRepository(db) : null;

    if (db) {
      // Persistent mode: SimpleFallbackStorage with DB persistence
      this.storage = new SimpleFallbackStorage({
        prefix: OPS_PREFIX,
        maxSize: 5000,
        ttlMs: 0, // Operations are permanent until deleted
        persistToDb: true,
        tenantId: 'global',
      });
      this.storage.start();
    } else {
      // In-memory fallback mode
      this.storage = new SimpleFallbackStorage({
        prefix: OPS_PREFIX,
        maxSize: 5000,
        ttlMs: 0,
        persistToDb: false,
      });
      this.storage.start();
    }
  }

  // ==================== Track Operations ====================

  /**
   * Track a new artifact operation.
   */
  async trackOperation(
    tenantId: string,
    input: ArtifactOperationInput
  ): Promise<ArtifactOperationRecord> {
    const now = new Date();
    const id = uuidv4();

    const record: ArtifactOperationRecord = {
      id,
      tenantId,
      artifactId: input.artifactId,
      operation: input.operation,
      source: input.source,
      target: input.target,
      metadata: input.metadata,
      status: 'completed',
      initiatedBy: input.initiatedBy,
      createdAt: now,
      completedAt: now,
      durationMs: 0,
    };

    // Store in SimpleFallbackStorage (keyed by tenant)
    const key = tenantOpsKey(tenantId);
    const existingOps = (await this.storage!.get<ArtifactOperationRecord[]>(key)) ?? [];
    existingOps.push(record);
    await this.storage!.set(key, existingOps);

    // Persist to database
    if (this.operationRepository) {
      try {
        await this.operationRepository.create({
          id,
          tenant_id: tenantId,
          artifact_id: input.artifactId,
          operation: input.operation,
          source: input.source ?? null,
          target: input.target ?? null,
          metadata: input.metadata ?? {},
          status: 'completed',
          initiated_by: input.initiatedBy ?? null,
        });

        // Update status after creation
        await this.operationRepository.updateStatus(id, 'completed', now, 0);
      } catch (error) {
        logger.warn({ error }, '[ArtifactOperation] Failed to persist operation');
      }
    }

    logger.info(
      { id, tenantId, artifactId: input.artifactId, operation: input.operation },
      '[ArtifactOperation] Operation tracked'
    );

    return record;
  }

  // ==================== Operation History ====================

  /**
   * Get operation history for a tenant or artifact.
   */
  async getOperationHistory(
    tenantId: string,
    filter?: OperationHistoryFilter
  ): Promise<ArtifactOperationRecord[]> {
    // Try database first
    if (this.operationRepository) {
      try {
        const result = await this.operationRepository.findByTenant(tenantId, {
          artifactId: filter?.artifactId,
          operation: filter?.operation,
          status: filter?.status,
          initiatedBy: filter?.initiatedBy,
          startDate: filter?.startDate,
          endDate: filter?.endDate,
        });

        return result.entities.map((entity) => ({
          id: entity.id,
          tenantId: entity.tenant_id,
          artifactId: entity.artifact_id,
          operation: entity.operation as ArtifactOperationType,
          source: entity.source ?? undefined,
          target: entity.target ?? undefined,
          metadata: entity.metadata,
          status: entity.status,
          initiatedBy: entity.initiated_by ?? undefined,
          createdAt: entity.created_at,
          completedAt: entity.completed_at ?? undefined,
          durationMs: entity.duration_ms ?? undefined,
        }));
      } catch (error) {
        logger.warn({ error }, '[ArtifactOperation] Failed to get history from DB, using memory');
      }
    }

    // Fallback to storage
    const storedOps = await this.storage!.get<ArtifactOperationRecord[]>(tenantOpsKey(tenantId)) ?? [];
    let ops = storedOps;

    if (filter) {
      if (filter.artifactId) {
        ops = ops.filter((o) => o.artifactId === filter.artifactId);
      }
      if (filter.operation) {
        ops = ops.filter((o) => o.operation === filter.operation);
      }
      if (filter.status) {
        ops = ops.filter((o) => o.status === filter.status);
      }
      if (filter.initiatedBy) {
        ops = ops.filter((o) => o.initiatedBy === filter.initiatedBy);
      }
    }

    // Sort by createdAt desc
    return ops.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  // ==================== Statistics ====================

  /**
   * Get artifact operation statistics for a tenant.
   */
  async getArtifactStats(tenantId: string): Promise<ArtifactStats> {
    // Try database first
    if (this.operationRepository) {
      try {
        const dbStats = await this.operationRepository.getTenantStats(tenantId);

        return {
          tenantId,
          totalOperations: dbStats.totalOperations,
          operationsByType: dbStats.operationsByType,
          operationsByStatus: dbStats.operationsByStatus,
          uniqueArtifacts: dbStats.uniqueArtifacts,
          averageDuration: dbStats.averageDuration,
          successRate: dbStats.successRate,
        };
      } catch (error) {
        logger.warn({ error }, '[ArtifactOperation] Failed to get stats from DB, using memory');
      }
    }

    // Fallback to storage
    const ops = await this.storage!.get<ArtifactOperationRecord[]>(tenantOpsKey(tenantId)) ?? [];

    const totalOperations = ops.length;
    const operationsByType: Record<string, number> = {};
    const operationsByStatus: Record<string, number> = {};
    const artifactSet = new Set<string>();

    let totalDuration = 0;
    let completedCount = 0;

    for (const op of ops) {
      operationsByType[op.operation] = (operationsByType[op.operation] ?? 0) + 1;
      operationsByStatus[op.status] = (operationsByStatus[op.status] ?? 0) + 1;
      artifactSet.add(op.artifactId);

      if (op.durationMs !== undefined) {
        totalDuration += op.durationMs;
      }
      if (op.status === 'completed') {
        completedCount++;
      }
    }

    return {
      tenantId,
      totalOperations,
      operationsByType,
      operationsByStatus,
      uniqueArtifacts: artifactSet.size,
      averageDuration: totalOperations > 0 ? totalDuration / totalOperations : 0,
      successRate: totalOperations > 0 ? completedCount / totalOperations : 0,
    };
  }

  // ==================== Delete Operations ====================

  /**
   * Delete all operation records for a tenant.
   */
  async deleteTenantOperations(tenantId: string): Promise<number> {
    const ops = await this.storage!.get<ArtifactOperationRecord[]>(tenantOpsKey(tenantId)) ?? [];
    const count = ops.length;

    await this.storage!.delete(tenantOpsKey(tenantId));

    // Also delete from database if repository available
    if (this.operationRepository) {
      try {
        await this.operationRepository.deleteByTenant(tenantId);
      } catch (error) {
        logger.warn({ error }, '[ArtifactOperation] Failed to delete from DB');
      }
    }

    logger.info({ tenantId, count }, '[ArtifactOperation] Tenant operations deleted');

    return count;
  }

  /**
   * Delete operation records for a specific artifact.
   */
  async deleteArtifactOperations(tenantId: string, artifactId: string): Promise<number> {
    const ops = await this.storage!.get<ArtifactOperationRecord[]>(tenantOpsKey(tenantId)) ?? [];
    const toDelete = ops.filter((o) => o.artifactId === artifactId);
    const remaining = ops.filter((o) => o.artifactId !== artifactId);

    await this.storage!.set(tenantOpsKey(tenantId), remaining);

    return toDelete.length;
  }

  // ==================== Operation Status Updates ====================

  /**
   * Update operation status.
   */
  async updateOperationStatus(
    operationId: string,
    tenantId: string,
    status: string,
    completedAt?: Date,
    durationMs?: number
  ): Promise<ArtifactOperationRecord | null> {
    const ops = await this.storage!.get<ArtifactOperationRecord[]>(tenantOpsKey(tenantId)) ?? [];
    const op = ops.find((o) => o.id === operationId);

    if (op) {
      op.status = status;
      if (completedAt) {
        op.completedAt = completedAt;
      }
      if (durationMs !== undefined) {
        op.durationMs = durationMs;
      }

      // Save updated list back to storage
      await this.storage!.set(tenantOpsKey(tenantId), ops);

      // Update in database
      if (this.operationRepository) {
        try {
          await this.operationRepository.updateStatus(
            operationId,
            status,
            completedAt,
            durationMs
          );
        } catch (error) {
          logger.warn({ error }, '[ArtifactOperation] Failed to update status in DB');
        }
      }

      return op;
    }

    return null;
  }
}

export default ArtifactOperationService;
