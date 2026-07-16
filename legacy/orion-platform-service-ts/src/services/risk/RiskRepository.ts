/**
 * RiskRepository - PostgreSQL Repository for Risk Management
 *
 * Provides CRUD operations for risk records with full tenant_id isolation.
 * Uses the risk_assessments table (migration 018).
 *
 * ARCH-001: All queries include tenant_id filtering for multi-tenancy.
 */

import { BaseRepository } from '../../db/base-repository';
import { OrionError, ErrorCode } from '../../errors';
import {
  RiskEntity,
  RiskCreateInput,
  RiskUpdateInput,
  RiskRow,
  RiskLevel,
  RiskStatus,
  RiskCategory,
  RiskFinding,
  RiskFindingInput,
  RiskMitigation,
  CreateMitigationInput,
  MitigationStatus,
} from './types';

// ==================== Repository Class ====================

export class RiskRepository extends BaseRepository<RiskEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'risk_assessments');
  }

  // ==================== Core CRUD (tenant-aware) ====================

  /**
   * Create a new risk record with tenant_id isolation.
   */
  async create(input: RiskCreateInput): Promise<RiskEntity> {
    const id = `risk_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const now = new Date();

    const row = await this.db.query(
      `INSERT INTO risk_assessments
        (id, tenant_id, name, description, risk_level, score, category, target_type, target_id,
         status, identified_at, created_by, assigned_to, findings, mitigations, metadata, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
       RETURNING *`,
      [
        id,
        input.tenantId,
        input.name,
        input.description ?? null,
        RiskLevel.LOW,
        0,
        input.category ?? RiskCategory.TECHNICAL,
        input.targetType,
        input.targetId,
        RiskStatus.IDENTIFIED,
        now,
        input.createdBy ?? null,
        input.assignedTo ?? null,
        JSON.stringify([]),
        JSON.stringify([]),
        JSON.stringify(input.metadata ?? {}),
        now,
        now,
      ],
    );

    if (row.rows.length === 0) {
      throw new OrionError('Risk INSERT returned no rows', ErrorCode.OPERATION_FAILED);
    }
    return this.mapRowToEntity(row.rows[0]);
  }

  /**
   * Find risk by ID with tenant isolation.
   */
  async findById(id: string, tenantId?: string): Promise<RiskEntity | null> {
    const actualTenantId = tenantId ?? this.getTenantId();
    const result = await this.db.query(
      `SELECT * FROM risk_assessments WHERE id = $1 AND tenant_id = $2`,
      [id, actualTenantId],
    );
    if (result.rows.length === 0) return null;
    return this.mapRowToEntity(result.rows[0]);
  }

  /**
   * Find all risks for a tenant with pagination.
   */
  async findByTenant(
    tenantId: string,
    options?: { limit?: number; offset?: number; status?: RiskStatus; riskLevel?: RiskLevel },
  ): Promise<{ entities: RiskEntity[]; total: number }> {
    const limit = options?.limit ?? 20;
    const offset = options?.offset ?? 0;

    const whereClauses: string[] = ['tenant_id = $1'];
    const params: unknown[] = [tenantId];
    let paramIndex = 2;

    if (options?.status) {
      whereClauses.push(`status = $${paramIndex}`);
      params.push(options.status);
      paramIndex++;
    }

    if (options?.riskLevel) {
      whereClauses.push(`risk_level = $${paramIndex}`);
      params.push(options.riskLevel);
      paramIndex++;
    }

    const whereSql = whereClauses.join(' AND ');

    const result = await this.db.query(
      `SELECT * FROM risk_assessments WHERE ${whereSql} ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, limit, offset],
    );

    const countResult = await this.db.query(
      `SELECT COUNT(*) as count FROM risk_assessments WHERE ${whereSql}`,
      params,
    );

    return {
      entities: result.rows.map((row) => this.mapRowToEntity(row)),
      total: parseInt(countResult.rows[0].count, 10),
    };
  }

  /**
   * Find risks by target (target_type + target_id) with tenant isolation.
   */
  async findByTarget(tenantId: string, targetType: string, targetId: string): Promise<RiskEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM risk_assessments
       WHERE tenant_id = $1 AND target_type = $2 AND target_id = $3
       ORDER BY created_at DESC`,
      [tenantId, targetType, targetId],
    );
    return result.rows.map((row) => this.mapRowToEntity(row));
  }

  /**
   * Find open risks (non-closed) for a tenant.
   */
  async findOpenRisks(tenantId: string, options?: { limit?: number; riskLevel?: RiskLevel }): Promise<RiskEntity[]> {
    const limit = options?.limit ?? 50;
    let query = `SELECT * FROM risk_assessments WHERE tenant_id = $1 AND status != $2`;
    const params: unknown[] = [tenantId, RiskStatus.CLOSED];

    if (options?.riskLevel) {
      query += ` AND risk_level = $3`;
      params.push(options.riskLevel);
    }

    query += ` ORDER BY score DESC, created_at DESC LIMIT $${params.length + 1}`;
    params.push(limit);

    const result = await this.db.query(query, params);
    return result.rows.map((row) => this.mapRowToEntity(row));
  }

  /**
   * Find critical/high risks across tenants (for global monitoring).
   */
  async findHighRisk(options?: { limit?: number; tenantId?: string }): Promise<RiskEntity[]> {
    const limit = options?.limit ?? 20;
    let query = `SELECT * FROM risk_assessments WHERE risk_level IN ($1, $2) AND status != $3`;
    const params: unknown[] = [RiskLevel.HIGH, RiskLevel.CRITICAL, RiskStatus.CLOSED];

    if (options?.tenantId) {
      query += ` AND tenant_id = $4`;
      params.push(options.tenantId);
    }

    query += ` ORDER BY score DESC LIMIT $${params.length + 1}`;
    params.push(limit);

    const result = await this.db.query(query, params);
    return result.rows.map((row) => this.mapRowToEntity(row));
  }

  // ==================== Update Operations ====================

  /**
   * Update risk with tenant isolation.
   */
  async updateRisk(id: string, tenantId: string, input: RiskUpdateInput): Promise<RiskEntity> {
    const actualTenantId = tenantId ?? this.getTenantId();
    const existing = await this.findById(id, actualTenantId);
    if (!existing) {
      throw new OrionError(`Risk not found: ${id}`, ErrorCode.NOT_FOUND);
    }

    const setClauses: string[] = ['updated_at = NOW()'];
    const params: unknown[] = [];
    let paramIndex = 1;

    if (input.name !== undefined) {
      setClauses.push(`name = $${paramIndex}`);
      params.push(input.name);
      paramIndex++;
    }

    if (input.description !== undefined) {
      setClauses.push(`description = $${paramIndex}`);
      params.push(input.description);
      paramIndex++;
    }

    if (input.riskLevel !== undefined) {
      setClauses.push(`risk_level = $${paramIndex}`);
      params.push(input.riskLevel);
      paramIndex++;
    }

    if (input.score !== undefined) {
      setClauses.push(`score = $${paramIndex}`);
      params.push(input.score);
      paramIndex++;
    }

    if (input.status !== undefined) {
      // Update status-specific timestamp
      switch (input.status) {
        case RiskStatus.ASSESSED:
          setClauses.push(`status = $${paramIndex}, assessed_at = NOW()`);
          break;
        case RiskStatus.MITIGATING:
          setClauses.push(`status = $${paramIndex}, mitigated_at = NOW()`);
          break;
        case RiskStatus.CLOSED:
          setClauses.push(`status = $${paramIndex}, closed_at = NOW()`);
          break;
        default:
          setClauses.push(`status = $${paramIndex}`);
      }
      params.push(input.status);
      paramIndex++;
    }

    if (input.assignedTo !== undefined) {
      setClauses.push(`assigned_to = $${paramIndex}`);
      params.push(input.assignedTo);
      paramIndex++;
    }

    if (input.findings !== undefined) {
      setClauses.push(`findings = $${paramIndex}`);
      params.push(JSON.stringify(input.findings));
      paramIndex++;
    }

    if (input.mitigations !== undefined) {
      setClauses.push(`mitigations = $${paramIndex}`);
      params.push(JSON.stringify(input.mitigations));
      paramIndex++;
    }

    if (input.metadata !== undefined) {
      setClauses.push(`metadata = $${paramIndex}`);
      params.push(JSON.stringify(input.metadata));
      paramIndex++;
    }

    params.push(id, tenantId);
    const query = `UPDATE risk_assessments SET ${setClauses.join(', ')} WHERE id = $${paramIndex} AND tenant_id = $${paramIndex + 1} RETURNING *`;

    const result = await this.db.query(query, params);
    if (result.rows.length === 0) {
      throw new OrionError(`Risk update affected no rows: ${id}`, ErrorCode.OPERATION_FAILED);
    }
    return this.mapRowToEntity(result.rows[0]);
  }

  /**
   * Add a finding to a risk.
   */
  async addFinding(id: string, tenantId: string, finding: RiskFindingInput): Promise<RiskEntity> {
    const existing = await this.findById(id, tenantId);
    if (!existing) {
      throw new OrionError(`Risk not found: ${id}`, ErrorCode.NOT_FOUND);
    }

    const newFinding: RiskFinding = {
      ...finding,
      id: `finding_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      affectedComponents: finding.affectedComponents ?? [],
      evidence: finding.evidence ?? {},
      detectedAt: new Date(),
    };

    const updatedFindings = [...existing.findings, newFinding];

    // Recalculate score based on new finding
    const recalculatedScore = this.recalculateScore(updatedFindings, existing.score);
    const newLevel = this.scoreToLevel(recalculatedScore);

    return this.updateRisk(id, tenantId, {
      findings: updatedFindings,
      score: recalculatedScore,
      riskLevel: newLevel,
    });
  }

  // ==================== Mitigation Operations ====================

  /**
   * Create a mitigation plan for a risk.
   */
  async createMitigation(id: string, tenantId: string, input: CreateMitigationInput): Promise<RiskEntity> {
    const existing = await this.findById(id, tenantId);
    if (!existing) {
      throw new OrionError(`Risk not found: ${id}`, ErrorCode.NOT_FOUND);
    }

    const now = new Date();
    const mitigation: RiskMitigation = {
      id: `mitigation_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      riskId: id,
      plan: input.plan,
      actions: input.actions.map((a) => ({
        ...a,
        id: `action_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        status: 'pending',
      })),
      status: MitigationStatus.PLANNED,
      priority: input.priority ?? existing.riskLevel,
      owner: input.owner,
      dueDate: input.dueDate,
      createdAt: now,
      updatedAt: now,
    };

    const updatedMitigations = [...existing.mitigations, mitigation];

    return this.updateRisk(id, tenantId, {
      status: RiskStatus.MITIGATING,
      mitigations: updatedMitigations,
    });
  }

  /**
   * Update mitigation status.
   */
  async updateMitigation(
    id: string,
    tenantId: string,
    mitigationId: string,
    updates: Partial<Pick<RiskMitigation, 'status' | 'effectiveness' | 'result' | 'dueDate'>>,
  ): Promise<RiskEntity> {
    const existing = await this.findById(id, tenantId);
    if (!existing) {
      throw new OrionError(`Risk not found: ${id}`, ErrorCode.NOT_FOUND);
    }

    const updatedMitigations = existing.mitigations.map((m) => {
      if (m.id !== mitigationId) return m;
      const now = new Date();
      const updated: RiskMitigation = { ...m, ...updates, updatedAt: now };

      if (updates.status === 'completed') {
        updated.completedAt = now;
      }
      return updated;
    });

    return this.updateRisk(id, tenantId, { mitigations: updatedMitigations });
  }

  // ==================== Statistics ====================

  /**
   * Get risk statistics for a tenant.
   */
  async getStats(tenantId: string): Promise<{
    total: number;
    byLevel: Record<RiskLevel, number>;
    byCategory: Record<RiskCategory, number>;
    byStatus: Record<RiskStatus, number>;
    openRisks: number;
    averageScore: number;
    criticalOpen: number;
  }> {
    const result = await this.db.query(
      `SELECT
        COUNT(*) as total,
        AVG(score) as avg_score,
        COUNT(*) FILTER (WHERE risk_level = $2) as low_count,
        COUNT(*) FILTER (WHERE risk_level = $3) as medium_count,
        COUNT(*) FILTER (WHERE risk_level = $4) as high_count,
        COUNT(*) FILTER (WHERE risk_level = $5) as critical_count,
        COUNT(*) FILTER (WHERE status != $6) as open_count,
        COUNT(*) FILTER (WHERE risk_level = $5 AND status != $6) as critical_open,
        COUNT(*) FILTER (WHERE category = $7) as security_count,
        COUNT(*) FILTER (WHERE category = $8) as operational_count,
        COUNT(*) FILTER (WHERE category = $9) as compliance_count,
        COUNT(*) FILTER (WHERE category = $10) as financial_count,
        COUNT(*) FILTER (WHERE category = $11) as technical_count,
        COUNT(*) FILTER (WHERE category = $12) as strategic_count,
        COUNT(*) FILTER (WHERE category = $13) as reputation_count,
        COUNT(*) FILTER (WHERE category = $14) as supply_chain_count,
        COUNT(*) FILTER (WHERE status = $15) as identified_count,
        COUNT(*) FILTER (WHERE status = $16) as assessed_count,
        COUNT(*) FILTER (WHERE status = $17) as mitigating_count,
        COUNT(*) FILTER (WHERE status = $18) as accepted_count,
        COUNT(*) FILTER (WHERE status = $19) as closed_count
       FROM risk_assessments
       WHERE tenant_id = $1`,
      [
        tenantId,
        RiskLevel.LOW,
        RiskLevel.MEDIUM,
        RiskLevel.HIGH,
        RiskLevel.CRITICAL,
        RiskStatus.CLOSED,
        RiskCategory.SECURITY,
        RiskCategory.OPERATIONAL,
        RiskCategory.COMPLIANCE,
        RiskCategory.FINANCIAL,
        RiskCategory.TECHNICAL,
        RiskCategory.STRATEGIC,
        RiskCategory.REPUTATION,
        RiskCategory.SUPPLY_CHAIN,
        RiskStatus.IDENTIFIED,
        RiskStatus.ASSESSED,
        RiskStatus.MITIGATING,
        RiskStatus.ACCEPTED,
        RiskStatus.CLOSED,
      ],
    );

    const row = result.rows[0];
    return {
      total: parseInt(row.total, 10) || 0,
      byLevel: {
        [RiskLevel.LOW]: parseInt(row.low_count, 10) || 0,
        [RiskLevel.MEDIUM]: parseInt(row.medium_count, 10) || 0,
        [RiskLevel.HIGH]: parseInt(row.high_count, 10) || 0,
        [RiskLevel.CRITICAL]: parseInt(row.critical_count, 10) || 0,
      },
      byCategory: {
        [RiskCategory.SECURITY]: parseInt(row.security_count, 10) || 0,
        [RiskCategory.OPERATIONAL]: parseInt(row.operational_count, 10) || 0,
        [RiskCategory.COMPLIANCE]: parseInt(row.compliance_count, 10) || 0,
        [RiskCategory.FINANCIAL]: parseInt(row.financial_count, 10) || 0,
        [RiskCategory.TECHNICAL]: parseInt(row.technical_count, 10) || 0,
        [RiskCategory.STRATEGIC]: parseInt(row.strategic_count, 10) || 0,
        [RiskCategory.REPUTATION]: parseInt(row.reputation_count, 10) || 0,
        [RiskCategory.SUPPLY_CHAIN]: parseInt(row.supply_chain_count, 10) || 0,
      },
      byStatus: {
        [RiskStatus.IDENTIFIED]: parseInt(row.identified_count, 10) || 0,
        [RiskStatus.ASSESSED]: parseInt(row.assessed_count, 10) || 0,
        [RiskStatus.MITIGATING]: parseInt(row.mitigating_count, 10) || 0,
        [RiskStatus.ACCEPTED]: parseInt(row.accepted_count, 10) || 0,
        [RiskStatus.CLOSED]: parseInt(row.closed_count, 10) || 0,
      },
      openRisks: parseInt(row.open_count, 10) || 0,
      averageScore: parseFloat(row.avg_score) || 0,
      criticalOpen: parseInt(row.critical_open, 10) || 0,
    };
  }

  // ==================== Row Mapping ====================

  protected mapRowToEntity(row: RiskRow): RiskEntity {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      name: row.name,
      description: row.description ?? undefined,
      riskLevel: row.risk_level as RiskLevel,
      score: Number(row.score),
      category: row.category as RiskCategory,
      targetType: row.target_type,
      targetId: row.target_id,
      status: row.status as RiskStatus,
      identifiedAt: row.identified_at,
      assessedAt: row.assessed_at ?? undefined,
      mitigatedAt: row.mitigated_at ?? undefined,
      closedAt: row.closed_at ?? undefined,
      createdBy: row.created_by ?? undefined,
      assignedTo: row.assigned_to ?? undefined,
      findings: (row.findings as unknown as RiskFinding[]) ?? [],
      mitigations: (row.mitigations as unknown as RiskMitigation[]) ?? [],
      metadata: (row.metadata as Record<string, unknown>) ?? {},
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  // ==================== Scoring Helpers ====================

  private recalculateScore(findings: RiskFinding[], baseScore: number): number {
    if (findings.length === 0) return baseScore;
    // Score is the maximum finding severity, averaged over all findings
    const severityScores: Record<RiskLevel, number> = {
      [RiskLevel.LOW]: 10,
      [RiskLevel.MEDIUM]: 30,
      [RiskLevel.HIGH]: 60,
      [RiskLevel.CRITICAL]: 90,
    };

    const total = findings.reduce((sum, f) => sum + (severityScores[f.severity] ?? 0), 0);
    const avg = total / findings.length;
    return Math.min(100, Math.max(0, Math.round(avg)));
  }

  private scoreToLevel(score: number): RiskLevel {
    if (score <= 25) return RiskLevel.LOW;
    if (score <= 50) return RiskLevel.MEDIUM;
    if (score <= 75) return RiskLevel.HIGH;
    return RiskLevel.CRITICAL;
  }
}

export default RiskRepository;
