/**
 * ApprovalGateCoordinator - Change coordination with approval gates
 *
 * Manages approval gates across cross-domain orchestration steps,
 * ensuring changes are properly reviewed before execution.
 */

import { v4 as uuidv4 } from 'uuid';
import { DatabasePool } from '../database';
import { OrionError, ErrorCode } from '../../errors';

export type GateStatus = 'pending' | 'approved' | 'rejected' | 'skipped';
export type GateType = 'manual' | 'auto' | 'policy';

export interface ApprovalGate {
  id: string;
  tenantId: string;
  orchestrationId: string;
  stepName: string;
  domainName: string;
  type: GateType;
  status: GateStatus;
  requiredApprovers: string[];
  actualApprovers: { approver: string; decision: 'approved' | 'rejected'; comment?: string; decidedAt: Date }[];
  autoApproveCondition?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
}

export interface CreateApprovalGateInput {
  orchestrationId: string;
  stepName: string;
  domainName: string;
  type?: GateType;
  requiredApprovers: string[];
  autoApproveCondition?: Record<string, unknown>;
}

// ============================================================
// Repository
// ============================================================

class ApprovalGateRepository {
  private pool: DatabasePool | null;
  private memory = new Map<string, ApprovalGate>();

  constructor(pool?: DatabasePool) { this.pool = pool || null; }
  private isDbAvailable(): boolean { return this.pool !== null; }

  async save(gate: ApprovalGate): Promise<void> {
    if (!this.isDbAvailable()) { this.memory.set(gate.id, gate); return; }
    await this.pool!.query(
      `INSERT INTO approval_gates (
        id, tenant_id, orchestration_id, step_name, domain_name, type, status,
        required_approvers, actual_approvers, auto_approve_condition,
        created_at, updated_at, completed_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
      ON CONFLICT (id) DO UPDATE SET
        status=EXCLUDED.status, actual_approvers=EXCLUDED.actual_approvers,
        updated_at=EXCLUDED.updated_at, completed_at=EXCLUDED.completed_at`,
      [
        gate.id, gate.tenantId, gate.orchestrationId, gate.stepName, gate.domainName,
        gate.type, gate.status, JSON.stringify(gate.requiredApprovers),
        JSON.stringify(gate.actualApprovers),
        gate.autoApproveCondition ? JSON.stringify(gate.autoApproveCondition) : null,
        gate.createdAt, gate.updatedAt, gate.completedAt || null,
      ]
    );
  }

  async findByOrchestration(orchestrationId: string): Promise<ApprovalGate[]> {
    if (!this.isDbAvailable()) {
      return Array.from(this.memory.values()).filter(g => g.orchestrationId === orchestrationId);
    }
    const rows = (await this.pool!.query(
      'SELECT * FROM approval_gates WHERE orchestration_id = $1 ORDER BY created_at',
      [orchestrationId]
    )).rows;
    return rows.map((r: any) => this.rowToGate(r));
  }

  async findById(id: string): Promise<ApprovalGate | null> {
    if (!this.isDbAvailable()) return this.memory.get(id) || null;
    const rows = (await this.pool!.query('SELECT * FROM approval_gates WHERE id = $1', [id])).rows;
    return rows.length ? this.rowToGate(rows[0]) : null;
  }

  private rowToGate(row: any): ApprovalGate {
    return {
      id: row.id, tenantId: row.tenant_id, orchestrationId: row.orchestration_id,
      stepName: row.step_name, domainName: row.domain_name,
      type: row.type as GateType, status: row.status as GateStatus,
      requiredApprovers: (row.required_approvers as string[]) || [],
      actualApprovers: (row.actual_approvers as ApprovalGate['actualApprovers']) || [],
      autoApproveCondition: row.auto_approve_condition || undefined,
      createdAt: row.created_at, updatedAt: row.updated_at, completedAt: row.completed_at || undefined,
    };
  }
}

// ============================================================
// Service
// ============================================================

export class ApprovalGateCoordinator {
  private repository: ApprovalGateRepository;

  constructor(database?: DatabasePool) {
    this.repository = new ApprovalGateRepository(database);
  }

  async createGate(tenantId: string, input: CreateApprovalGateInput): Promise<ApprovalGate> {
    const now = new Date();
    const gate: ApprovalGate = {
      id: uuidv4(), tenantId,
      orchestrationId: input.orchestrationId, stepName: input.stepName,
      domainName: input.domainName, type: input.type || 'manual',
      status: 'pending', requiredApprovers: input.requiredApprovers,
      actualApprovers: [], autoApproveCondition: input.autoApproveCondition,
      createdAt: now, updatedAt: now,
    };
    await this.repository.save(gate);
    return gate;
  }

  async approveGate(gateId: string, approver: string, comment?: string): Promise<ApprovalGate> {
    const gate = await this.repository.findById(gateId);
    if (!gate) throw new OrionError(ErrorCode.NOT_FOUND, `Approval gate '${gateId}' not found`);
    if (gate.status !== 'pending') throw new OrionError(ErrorCode.NOT_FOUND, `Gate is already ${gate.status}`);

    gate.actualApprovers.push({ approver, decision: 'approved', comment, decidedAt: new Date() });
    gate.updatedAt = new Date();

    if (gate.actualApprovers.length >= gate.requiredApprovers.length) {
      gate.status = 'approved';
      gate.completedAt = new Date();
    }
    await this.repository.save(gate);
    return gate;
  }

  async rejectGate(gateId: string, approver: string, comment?: string): Promise<ApprovalGate> {
    const gate = await this.repository.findById(gateId);
    if (!gate) throw new OrionError(ErrorCode.NOT_FOUND, `Approval gate '${gateId}' not found`);
    if (gate.status !== 'pending') throw new OrionError(ErrorCode.NOT_FOUND, `Gate is already ${gate.status}`);

    gate.actualApprovers.push({ approver, decision: 'rejected', comment, decidedAt: new Date() });
    gate.status = 'rejected';
    gate.completedAt = new Date();
    gate.updatedAt = new Date();
    await this.repository.save(gate);
    return gate;
  }

  async autoEvaluateGate(gateId: string, context: Record<string, unknown>): Promise<ApprovalGate> {
    const gate = await this.repository.findById(gateId);
    if (!gate) throw new OrionError(ErrorCode.NOT_FOUND, `Approval gate '${gateId}' not found`);
    if (gate.status !== 'pending') return gate;
    if (gate.type !== 'auto' || !gate.autoApproveCondition) return gate;

    const conditionMet = Object.entries(gate.autoApproveCondition).every(([key, expected]) => {
      return context[key] === expected;
    });

    if (conditionMet) {
      gate.status = 'approved';
      gate.actualApprovers.push({ approver: 'system', decision: 'approved', comment: 'Auto-approved based on conditions', decidedAt: new Date() });
      gate.completedAt = new Date();
    } else {
      gate.status = 'rejected';
      gate.actualApprovers.push({ approver: 'system', decision: 'rejected', comment: 'Auto-rejected: conditions not met', decidedAt: new Date() });
      gate.completedAt = new Date();
    }
    gate.updatedAt = new Date();
    await this.repository.save(gate);
    return gate;
  }

  async getGates(orchestrationId: string): Promise<ApprovalGate[]> {
    return this.repository.findByOrchestration(orchestrationId);
  }

  async isOrchestrationCleared(orchestrationId: string): Promise<boolean> {
    const gates = await this.repository.findByOrchestration(orchestrationId);
    return gates.every(g => g.status === 'approved' || g.status === 'skipped');
  }
}
