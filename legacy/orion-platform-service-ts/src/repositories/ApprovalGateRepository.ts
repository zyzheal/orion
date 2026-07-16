/**
 * ApprovalGateRepository - PostgreSQL data access layer for approval gates
 *
 * Provides CRUD operations for Pipeline approval gates.
 * Uses db query interface (compatible with Pool and BaseRepository.db).
 */

export interface ApprovalGateEntity {
  id: string;
  tenantId: string;
  runId: string;
  stageId: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  requestedBy: string;
  requestedAt: Date;
  reviewedBy?: string;
  reviewedAt?: Date;
  comment?: string;
  approverIds: string[];
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface ApprovalGateCreateInput {
  tenantId: string;
  runId: string;
  stageId: string;
  status?: 'pending' | 'approved' | 'rejected' | 'cancelled';
  requestedBy: string;
  approverIds: string[];
  metadata?: Record<string, unknown>;
}

export interface ApprovalGateUpdateInput {
  status?: 'pending' | 'approved' | 'rejected' | 'cancelled';
  reviewedBy?: string;
  reviewedAt?: Date;
  comment?: string;
}

export class ApprovalGateRepository {
  constructor(private db: { query: (text: string, params?: any[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {}

  /**
   * Create a new approval gate
   */
  async create(input: ApprovalGateCreateInput): Promise<ApprovalGateEntity> {
    const now = new Date();
    const id = `gate-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

    await this.db.query(
      `INSERT INTO approval_gates (id, tenant_id, run_id, stage_id, status, requested_by, approver_ids, metadata, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        id,
        input.tenantId,
        input.runId,
        input.stageId,
        input.status || 'pending',
        input.requestedBy,
        JSON.stringify(input.approverIds),
        input.metadata ? JSON.stringify(input.metadata) : null,
        now,
        now,
      ]
    );

    return {
      id,
      tenantId: input.tenantId,
      runId: input.runId,
      stageId: input.stageId,
      status: input.status || 'pending',
      requestedBy: input.requestedBy,
      requestedAt: now,
      approverIds: input.approverIds,
      metadata: input.metadata,
      createdAt: now,
      updatedAt: now,
    };
  }

  /**
   * Find gate by ID
   */
  async findById(id: string): Promise<ApprovalGateEntity | null> {
    const result = await this.db.query(
      'SELECT * FROM approval_gates WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) return null;
    return this.mapRowToEntity(result.rows[0]);
  }

  /**
   * Find all gates by run ID
   */
  async findByRunId(runId: string): Promise<ApprovalGateEntity[]> {
    const result = await this.db.query(
      'SELECT * FROM approval_gates WHERE run_id = $1 ORDER BY created_at DESC',
      [runId]
    );

    return result.rows.map(row => this.mapRowToEntity(row));
  }

  /**
   * Find gate by run ID and stage ID
   */
  async findByRunAndStage(runId: string, stageId: string): Promise<ApprovalGateEntity | null> {
    const result = await this.db.query(
      'SELECT * FROM approval_gates WHERE run_id = $1 AND stage_id = $2',
      [runId, stageId]
    );

    if (result.rows.length === 0) return null;
    return this.mapRowToEntity(result.rows[0]);
  }

  /**
   * Find pending gates by approver
   */
  async findPendingByApprover(approverId: string, tenantId: string): Promise<ApprovalGateEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM approval_gates
       WHERE tenant_id = $1 AND status = 'pending'
       AND $2 = ANY(approver_ids::text[])
       ORDER BY requested_at ASC`,
      [tenantId, approverId]
    );

    return result.rows.map(row => this.mapRowToEntity(row));
  }

  /**
   * Find pending gates by tenant
   */
  async findPendingByTenant(tenantId: string): Promise<ApprovalGateEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM approval_gates
       WHERE tenant_id = $1 AND status = 'pending'
       ORDER BY requested_at ASC`,
      [tenantId]
    );

    return result.rows.map(row => this.mapRowToEntity(row));
  }

  /**
   * Update gate
   */
  async update(id: string, input: ApprovalGateUpdateInput): Promise<ApprovalGateEntity | null> {
    const existing = await this.findById(id);
    if (!existing) return null;

    const updates: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (input.status !== undefined) {
      updates.push(`status = $${paramIndex++}`);
      values.push(input.status);
    }
    if (input.reviewedBy !== undefined) {
      updates.push(`reviewed_by = $${paramIndex++}`);
      values.push(input.reviewedBy);
    }
    if (input.reviewedAt !== undefined) {
      updates.push(`reviewed_at = $${paramIndex++}`);
      values.push(input.reviewedAt);
    }
    if (input.comment !== undefined) {
      updates.push(`comment = $${paramIndex++}`);
      values.push(input.comment);
    }

    updates.push(`updated_at = $${paramIndex++}`);
    values.push(new Date());
    values.push(id);

    await this.db.query(
      `UPDATE approval_gates SET ${updates.join(', ')} WHERE id = $${paramIndex}`,
      values
    );

    return this.findById(id);
  }

  /**
   * Check if approval is required for a stage
   */
  async isApprovalRequired(runId: string, stageId: string): Promise<boolean> {
    const result = await this.db.query(
      `SELECT 1 FROM approval_gates
       WHERE run_id = $1 AND stage_id = $2 AND status = 'pending'
       LIMIT 1`,
      [runId, stageId]
    );

    return result.rows.length > 0;
  }

  /**
   * Delete gate by ID
   */
  async delete(id: string): Promise<boolean> {
    const result = await this.db.query(
      'DELETE FROM approval_gates WHERE id = $1',
      [id]
    );

    return (result.rowCount ?? 0) > 0;
  }

  /**
   * Map database row to entity
   */
  private mapRowToEntity(row: any): ApprovalGateEntity {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      runId: row.run_id,
      stageId: row.stage_id,
      status: row.status,
      requestedBy: row.requested_by,
      requestedAt: row.requested_at,
      reviewedBy: row.reviewed_by,
      reviewedAt: row.reviewed_at,
      comment: row.comment,
      approverIds: row.approver_ids || [],
      metadata: row.metadata,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
