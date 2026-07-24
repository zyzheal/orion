import { BaseRepository } from '../db/base-repository';
import { DatabasePool } from '../services/database';

/** Entity for emergency approvals stored in the approval_requests table */
export interface EmergencyApprovalEntity {
  id: string;
  tenant_id: string;
  title: string;
  description: string | null;
  request_type: string;
  requester_id: string;
  status: string;  // pending, approved, rejected, executed, audited
  approval_chain: Record<string, any>[];
  current_step: number;
  total_steps: number;
  is_emergency: boolean;
  emergency_reason: string | null;
  metadata: Record<string, any>;
  created_at: Date;
  updated_at: Date;
  completed_at: Date | null;
}

export class EmergencyApprovalRepository extends BaseRepository<EmergencyApprovalEntity> {
  constructor(db: DatabasePool) {
    super(db, 'approval_requests');
  }

  /** Find all emergency approvals for a tenant */
  async findByTenant(tenantId: string): Promise<EmergencyApprovalEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM approval_requests WHERE tenant_id = $1 AND is_emergency = true ORDER BY created_at DESC`,
      [tenantId],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  /** Create a new emergency approval request */
  async createRequest(input: {
    id: string;
    tenantId: string;
    title: string;
    description: string;
    requesterId: string;
    requestType?: string;
    status: string;
    approvalChain: Record<string, any>[];
    currentStep: number;
    totalSteps: number;
    emergencyReason: string;
    metadata?: Record<string, any>;
  }): Promise<EmergencyApprovalEntity> {
    const result = await this.db.query(
      `INSERT INTO approval_requests (id, tenant_id, title, description, request_type, requester_id, status,
         approval_chain, current_step, total_steps, is_emergency, emergency_reason, metadata, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15) RETURNING *`,
      [
        input.id,
        input.tenantId,
        input.title,
        input.description,
        input.requestType || 'emergency',
        input.requesterId,
        input.status,
        JSON.stringify(input.approvalChain),
        input.currentStep,
        input.totalSteps,
        true, // is_emergency
        input.emergencyReason,
        input.metadata ? JSON.stringify(input.metadata) : '{}',
        new Date(),
        new Date(),
      ],
    );
    return this.mapRowToEntity(result.rows[0]);
  }

  /** Update an emergency approval request */
  async updateRequest(
    id: string,
    updates: {
      status?: string;
      approvedBy?: string;
      approvedAt?: Date;
      approvalChain?: Record<string, any>[];
      currentStep?: number;
      completedAt?: Date;
    },
  ): Promise<EmergencyApprovalEntity | null> {
    const setClauses: string[] = ['updated_at = $1'];
    const params: any[] = [new Date()];
    let paramIndex = 2;

    if (updates.status !== undefined) {
      setClauses.push(`status = $${paramIndex}`);
      params.push(updates.status);
      paramIndex++;
    }
    if (updates.approvalChain !== undefined) {
      setClauses.push(`approval_chain = $${paramIndex}`);
      params.push(JSON.stringify(updates.approvalChain));
      paramIndex++;
    }
    if (updates.currentStep !== undefined) {
      setClauses.push(`current_step = $${paramIndex}`);
      params.push(updates.currentStep);
      paramIndex++;
    }
    if (updates.completedAt !== undefined) {
      setClauses.push(`completed_at = $${paramIndex}`);
      params.push(updates.completedAt);
      paramIndex++;
    }

    params.push(id);
    const query = `UPDATE approval_requests SET ${setClauses.join(', ')} WHERE id = $${paramIndex} RETURNING *`;
    const result = await this.db.query(query, params);
    if (result.rows.length === 0) return null;
    return this.mapRowToEntity(result.rows[0]);
  }

  protected mapRowToEntity(row: any): EmergencyApprovalEntity {
    return {
      id: row.id,
      tenant_id: row.tenant_id,
      title: row.title,
      description: row.description,
      request_type: row.request_type || 'emergency',
      requester_id: row.requester_id,
      status: row.status || 'pending',
      approval_chain: typeof row.approval_chain === 'string' ? JSON.parse(row.approval_chain) : (row.approval_chain || []),
      current_step: row.current_step ?? 1,
      total_steps: row.total_steps ?? 1,
      is_emergency: row.is_emergency ?? true,
      emergency_reason: row.emergency_reason,
      metadata: row.metadata ? (typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata) : {},
      created_at: row.created_at ? new Date(row.created_at) : new Date(),
      updated_at: row.updated_at ? new Date(row.updated_at) : new Date(),
      completed_at: row.completed_at ? new Date(row.completed_at) : null,
    };
  }
}

export default EmergencyApprovalRepository;
