/**
 * QualityGateRepository - 质量门禁定义的持久化存储
 *
 * 负责质量门禁（QualityGate）的 CRUD 操作：
 * - 按租户查询
 * - 按名称查询
 * - 增删改查
 *
 * GAP-CN-04: 代码质量门禁
 */
import { BaseRepository } from '../db/base-repository';
import {
  QualityGate,
  QualityGateRule,
  QualityGateCreateInput,
  QualityGateUpdateInput,
} from '../models/QualityGate';
import { OrionError, ErrorCode } from '../errors';

// ============================================================================
// Repository
// ============================================================================

export class QualityGateRepository extends BaseRepository<QualityGate> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'quality_gates');
  }

  /**
   * 按租户查询所有质量门禁
   */
  async findByTenant(tenantId: string, options?: { enabledOnly?: boolean }): Promise<QualityGate[]> {
    let query = `SELECT * FROM quality_gates WHERE tenant_id = $1`;
    const params: any[] = [tenantId];

    if (options?.enabledOnly) {
      query += ` AND enabled = true`;
    }

    query += ` ORDER BY created_at DESC`;
    const result = await this.db.query(query, params);
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  /**
   * 按租户和名称查询
   */
  async findByName(tenantId: string, name: string): Promise<QualityGate | undefined> {
    const result = await this.db.query(
      `SELECT * FROM quality_gates WHERE tenant_id = $1 AND name = $2`,
      [tenantId, name]
    );
    if (result.rows.length === 0) return undefined;
    return this.mapRowToEntity(result.rows[0]);
  }

  /**
   * 创建质量门禁
   */
  async create(input: QualityGateCreateInput): Promise<QualityGate> {
    const result = await this.db.query(
      `INSERT INTO quality_gates (id, tenant_id, name, description, rules, external_provider, enabled)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [
        input.tenantId + '-' + Date.now(), // temporary ID, will be overwritten by UUID
        input.tenantId,
        input.name,
        input.description || null,
        JSON.stringify(input.rules),
        input.externalProvider ? JSON.stringify(input.externalProvider) : null,
        input.enabled ?? true,
      ]
    );
    return this.mapRowToEntity(result.rows[0]);
  }

  /**
   * 更新质量门禁
   */
  async update(id: string, input: QualityGateUpdateInput): Promise<QualityGate> {
    const updates: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (input.name !== undefined) {
      updates.push(`name = $${paramIndex}`);
      params.push(input.name);
      paramIndex++;
    }
    if (input.description !== undefined) {
      updates.push(`description = $${paramIndex}`);
      params.push(input.description || null);
      paramIndex++;
    }
    if (input.rules !== undefined) {
      updates.push(`rules = $${paramIndex}`);
      params.push(JSON.stringify(input.rules));
      paramIndex++;
    }
    if (input.externalProvider !== undefined) {
      updates.push(`external_provider = $${paramIndex}`);
      params.push(input.externalProvider ? JSON.stringify(input.externalProvider) : null);
      paramIndex++;
    }
    if (input.enabled !== undefined) {
      updates.push(`enabled = $${paramIndex}`);
      params.push(input.enabled);
      paramIndex++;
    }

    if (updates.length === 0) {
      throw new OrionError(ErrorCode.OPERATION_FAILED, 'Update requires at least one column');
    }

    updates.push(`updated_at = NOW()`);
    params.push(id);

    const result = await this.db.query(
      `UPDATE quality_gates SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      params
    );
    if (result.rows.length === 0) {
      throw new OrionError('OPERATION_FAILED', `UPDATE on quality_gates affected no rows (id: ${id})`)
    }
    return this.mapRowToEntity(result.rows[0]);
  }

  protected mapRowToEntity(row: any): QualityGate {
    let rules: QualityGateRule[] = [];
    try {
      rules = typeof row.rules === 'string' ? JSON.parse(row.rules) : (row.rules || []);
    } catch {
      rules = [];
    }

    let externalProvider: QualityGate['externalProvider'] = undefined;
    if (row.external_provider) {
      try {
        externalProvider = typeof row.external_provider === 'string'
          ? JSON.parse(row.external_provider)
          : row.external_provider;
      } catch {
        externalProvider = undefined;
      }
    }

    return {
      id: row.id,
      tenantId: row.tenant_id,
      name: row.name,
      description: row.description,
      rules,
      externalProvider,
      enabled: row.enabled ?? true,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
