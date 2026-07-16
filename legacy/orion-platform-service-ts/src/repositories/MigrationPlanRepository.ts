/**
 * MigrationPlanRepository - PostgreSQL persistence for migration plans
 *
 * Task 4.39: Migrate MigrationService from in-memory Map to PostgreSQL
 */

import { BaseRepository, FindAllResult } from '../db/base-repository';
import { OrionError, ErrorCode } from '../errors';

export interface MigrationPlanEntity {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  source_service: string;
  target_service: string;
  strategy: string;
  status: string;
  config: Record<string, unknown>;
  steps: Record<string, unknown>[];
  created_by: string;
  created_at: Date;
  updated_at: Date;
}

export interface CreateMigrationPlanInput {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  sourceService: string;
  targetService: string;
  strategy: string;
  config?: Record<string, unknown>;
  steps?: Record<string, unknown>[];
  createdBy: string;
}

export class MigrationPlanRepository extends BaseRepository<MigrationPlanEntity> {
  constructor(db: { query: (text: string, params?: any[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'migration_plans');
  }

  async create(input: CreateMigrationPlanInput): Promise<MigrationPlanEntity> {
    const result = await this.db.query(
      `INSERT INTO migration_plans (id, tenant_id, name, description, source_service, target_service, strategy, status, config, steps, created_by, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())
       RETURNING *`,
      [
        input.id,
        input.tenantId,
        input.name,
        input.description ?? null,
        input.sourceService,
        input.targetService,
        input.strategy,
        'pending',
        JSON.stringify(input.config ?? {}),
        JSON.stringify(input.steps ?? []),
        input.createdBy,
      ],
    );
    return this.mapRowToEntity(result.rows[0]);
  }

  async findBySourceService(sourceService: string): Promise<MigrationPlanEntity[]> {
    const tenantId = this.getTenantId();
    const result = await this.db.query(
      `SELECT * FROM migration_plans
       WHERE tenant_id = $1 AND (source_service = $2 OR target_service = $2)
       ORDER BY created_at DESC`,
      [tenantId, sourceService],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async updateStatus(id: string, status: string): Promise<MigrationPlanEntity | null> {
    const tenantId = this.getTenantId();
    const result = await this.db.query(
      `UPDATE migration_plans SET status = $1, updated_at = NOW()
       WHERE id = $2 AND tenant_id = $3
       RETURNING *`,
      [status, id, tenantId],
    );
    if (result.rows.length === 0) return null;
    return this.mapRowToEntity(result.rows[0]);
  }

  protected mapRowToEntity(row: any): MigrationPlanEntity {
    return {
      id: row.id,
      tenant_id: row.tenant_id,
      name: row.name,
      description: row.description,
      source_service: row.source_service,
      target_service: row.target_service,
      strategy: row.strategy,
      status: row.status,
      config: typeof row.config === 'string' ? JSON.parse(row.config) : (row.config || {}),
      steps: typeof row.steps === 'string' ? JSON.parse(row.steps) : (row.steps || []),
      created_by: row.created_by,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }
}
