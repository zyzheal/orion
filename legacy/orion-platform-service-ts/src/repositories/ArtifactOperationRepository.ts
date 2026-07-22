/**
 * ArtifactOperationRepository
 *
 * PostgreSQL-backed repository for artifact operation tracking.
 * Extends BaseRepository for standard CRUD operations.
 */

import { BaseRepository, FindAllOptions, FindAllResult } from '../db/base-repository';
import { DatabasePool } from '../services/database';

export interface ArtifactOperationEntity {
  id: string;
  tenant_id: string;
  artifact_id: string;
  operation: string;
  source: string | null;
  target: string | null;
  metadata: Record<string, unknown>;
  status: string;
  initiated_by: string | null;
  created_at: Date;
  completed_at?: Date | null;
  duration_ms?: number | null;
}

export class ArtifactOperationRepository extends BaseRepository<ArtifactOperationEntity> {
  constructor(db: DatabasePool) {
    super(db, 'artifact_operations');
  }

  /**
   * Find operations by artifact ID
   */
  async findByArtifactId(artifactId: string, options?: FindAllOptions): Promise<FindAllResult<ArtifactOperationEntity>> {
    return this.findAll({
      ...options,
      where: { ...options?.where, artifact_id: artifactId },
    });
  }

  /**
   * Find operations by tenant ID with optional filters
   */
  async findByTenant(tenantId: string, filters?: {
    artifactId?: string;
    operation?: string;
    status?: string;
    initiatedBy?: string;
    startDate?: string;
    endDate?: string;
  }, options?: FindAllOptions): Promise<FindAllResult<ArtifactOperationEntity>> {
    const where: Record<string, any> = { tenant_id: tenantId };
    if (filters?.artifactId) where.artifact_id = filters.artifactId;
    if (filters?.operation) where.operation = filters.operation;
    if (filters?.status) where.status = filters.status;
    if (filters?.initiatedBy) where.initiated_by = filters.initiatedBy;

    let query = `SELECT * FROM artifact_operations WHERE tenant_id = $1`;
    const params: any[] = [tenantId];
    let paramIdx = 2;

    if (filters?.artifactId) {
      query += ` AND artifact_id = $${paramIdx}`;
      params.push(filters.artifactId);
      paramIdx++;
    }
    if (filters?.operation) {
      query += ` AND operation = $${paramIdx}`;
      params.push(filters.operation);
      paramIdx++;
    }
    if (filters?.status) {
      query += ` AND status = $${paramIdx}`;
      params.push(filters.status);
      paramIdx++;
    }
    if (filters?.initiatedBy) {
      query += ` AND initiated_by = $${paramIdx}`;
      params.push(filters.initiatedBy);
      paramIdx++;
    }
    if (filters?.startDate) {
      query += ` AND created_at >= $${paramIdx}`;
      params.push(filters.startDate);
      paramIdx++;
    }
    if (filters?.endDate) {
      query += ` AND created_at <= $${paramIdx}`;
      params.push(filters.endDate);
      paramIdx++;
    }

    const orderBy = options?.orderBy || 'created_at';
    const orderDir = options?.orderDir || 'DESC';
    const limit = options?.limit || 100;
    const offset = options?.offset || 0;

    // Validate ORDER BY column and direction to prevent SQL injection
    const allowedOrderColumns = ['id', 'created_at', 'updated_at', 'operation', 'status', 'artifact_id', 'tenant_id', 'initiated_by'];
    const allowedOrderDirs = ['ASC', 'DESC'];
    const safeColumn = allowedOrderColumns.includes(orderBy) ? orderBy : 'created_at';
    const safeDir = allowedOrderDirs.includes(orderDir.toUpperCase()) ? orderDir.toUpperCase() : 'DESC';

    query += ` ORDER BY ${safeColumn} ${safeDir} LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`;
    params.push(limit, offset);

    const result = await this.db.query(query, params);
    const entities = result.rows.map(row => this.mapRowToEntity(row));

    // Count query
    const countQuery = query.slice(0, query.indexOf(' ORDER BY'));
    const countResult = await this.db.query(countQuery, params.slice(0, -2));

    return {
      entities,
      total: parseInt(countResult.rows[0]?.count || countResult.rows.length.toString(), 10),
    };
  }

  /**
   * Get stats for a tenant
   */
  async getTenantStats(tenantId: string): Promise<{
    totalOperations: number;
    operationsByType: Record<string, number>;
    operationsByStatus: Record<string, number>;
    uniqueArtifacts: number;
    averageDuration: number;
    successRate: number;
  }> {
    // Total operations
    const totalResult = await this.db.query(
      'SELECT COUNT(*) as count FROM artifact_operations WHERE tenant_id = $1',
      [tenantId]
    );
    const totalOperations = parseInt(totalResult.rows[0]?.count || '0', 10);

    // Operations by type
    const typeResult = await this.db.query(
      'SELECT operation, COUNT(*) as count FROM artifact_operations WHERE tenant_id = $1 GROUP BY operation',
      [tenantId]
    );
    const operationsByType: Record<string, number> = {};
    for (const row of typeResult.rows) {
      operationsByType[row.operation] = parseInt(row.count, 10);
    }

    // Operations by status
    const statusResult = await this.db.query(
      'SELECT status, COUNT(*) as count FROM artifact_operations WHERE tenant_id = $1 GROUP BY status',
      [tenantId]
    );
    const operationsByStatus: Record<string, number> = {};
    for (const row of statusResult.rows) {
      operationsByStatus[row.status] = parseInt(row.count, 10);
    }

    // Unique artifacts
    const artifactResult = await this.db.query(
      'SELECT COUNT(DISTINCT artifact_id) as count FROM artifact_operations WHERE tenant_id = $1',
      [tenantId]
    );
    const uniqueArtifacts = parseInt(artifactResult.rows[0]?.count || '0', 10);

    // Average duration (only for completed operations with duration)
    const durationResult = await this.db.query(
      'SELECT AVG(duration_ms) as avg_duration FROM artifact_operations WHERE tenant_id = $1 AND duration_ms IS NOT NULL',
      [tenantId]
    );
    const averageDuration = parseFloat(durationResult.rows[0]?.avg_duration || '0');

    // Success rate
    const successCount = operationsByStatus['completed'] || 0;
    const successRate = totalOperations > 0 ? successCount / totalOperations : 0;

    return {
      totalOperations,
      operationsByType,
      operationsByStatus,
      uniqueArtifacts,
      averageDuration,
      successRate,
    };
  }

  /**
   * Delete all operations for a tenant
   */
  async deleteByTenant(tenantId: string): Promise<number> {
    const result = await this.db.query(
      'DELETE FROM artifact_operations WHERE tenant_id = $1',
      [tenantId]
    );
    return result.rowCount ?? 0;
  }

  /**
   * Update operation status
   */
  async updateStatus(id: string, status: string, completedAt?: Date, durationMs?: number): Promise<ArtifactOperationEntity | undefined> {
    if (completedAt && durationMs !== undefined) {
      const result = await this.db.query(
        'UPDATE artifact_operations SET status = $1, completed_at = $2, duration_ms = $3, updated_at = NOW() WHERE id = $4 RETURNING *',
        [status, completedAt, durationMs, id]
      );
      if (result.rows.length === 0) return undefined;
      return this.mapRowToEntity(result.rows[0]);
    }
    const result = await this.db.query(
      'UPDATE artifact_operations SET status = $1 WHERE id = $2 RETURNING *',
      [status, id]
    );
    if (result.rows.length === 0) return undefined;
    return this.mapRowToEntity(result.rows[0]);
  }

  protected mapRowToEntity(row: any): ArtifactOperationEntity {
    return {
      id: row.id,
      tenant_id: row.tenant_id,
      artifact_id: row.artifact_id,
      operation: row.operation,
      source: row.source,
      target: row.target,
      metadata: row.metadata ?? {},
      status: row.status,
      initiated_by: row.initiated_by,
      created_at: row.created_at,
      completed_at: row.completed_at,
      duration_ms: row.duration_ms,
    };
  }
}
