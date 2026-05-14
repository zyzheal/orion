/**
 * Policy Evaluation Service - Evaluate policies against resources and runs
 */

import { EventBusService } from '../event-bus-service';
import { DatabasePool } from '../../utils/database';

interface EvaluationResult {
  id: string;
  policyId: string;
  resourceId: string;
  runId: string;
  passed: boolean;
  violations: ViolationRecord[];
  evaluatedAt: Date;
}

interface ViolationRecord {
  id: string;
  policyId: string;
  runId?: string;
  resourceId?: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  message: string;
  resolved: boolean;
  waived: boolean;
  createdAt: Date;
}

interface ExemptionRecord {
  id: string;
  violationId: string;
  policyId: string;
  runId: string;
  reason: string;
  category: string;
  requestedBy: string;
  status: 'pending' | 'approved' | 'rejected' | 'revoked';
  reviewedBy?: string;
  reviewedAt?: Date;
  expiresAt?: Date;
  createdAt: Date;
}

export class PolicyEvaluationService {
  private eventBus?: EventBusService;
  private db?: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> };

  constructor(options?: { eventBus?: EventBusService; db?: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> } }) {
    this.eventBus = options?.eventBus;
    this.db = options?.db;
  }

  async evaluate(input: {
    policyId: string;
    resourceId: string;
    runId: string;
    resourceData: Record<string, unknown>;
  }): Promise<EvaluationResult> {
    // MVP: simulate evaluation
    const result: EvaluationResult = {
      id: `eval-${Date.now()}`,
      policyId: input.policyId,
      resourceId: input.resourceId,
      runId: input.runId,
      passed: true,
      violations: [],
      evaluatedAt: new Date(),
    };

    await this.eventBus?.publish('policy.evaluated', {
      evaluationId: result.id,
      policyId: input.policyId,
      passed: result.passed,
    });

    return result;
  }

  async listEvaluations(options?: { runId?: string; policyId?: string; limit?: number }): Promise<EvaluationResult[]> {
    if (this.db) {
      const result = await this.db.query(
        'SELECT * FROM policy_evaluations ORDER BY evaluated_at DESC LIMIT $1',
        [options?.limit || 50]
      );
      return result.rows.map((row: any) => ({
        id: row.id,
        policyId: row.policy_id,
        resourceId: row.resource_id,
        runId: row.run_id,
        passed: row.passed,
        violations: row.violations || [],
        evaluatedAt: row.evaluated_at,
      }));
    }
    return [];
  }

  async listViolations(options?: { policyId?: string; severity?: string; resolved?: boolean }): Promise<ViolationRecord[]> {
    if (this.db) {
      const conditions: string[] = [];
      const params: unknown[] = [];
      let idx = 1;

      if (options?.policyId) { conditions.push(`policy_id = $${idx}`); params.push(options.policyId); idx++; }
      if (options?.severity) { conditions.push(`severity = $${idx}`); params.push(options.severity); idx++; }
      if (options?.resolved !== undefined) { conditions.push(`resolved = $${idx}`); params.push(options.resolved); idx++; }

      const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      const result = await this.db.query(`SELECT * FROM policy_violations ${where} ORDER BY created_at DESC LIMIT 100`, params);

      return result.rows.map((row: any) => ({
        id: row.id,
        policyId: row.policy_id,
        runId: row.run_id || undefined,
        resourceId: row.resource_id || undefined,
        severity: row.severity,
        message: row.message,
        resolved: row.resolved,
        waived: row.waived || false,
        createdAt: row.created_at,
      }));
    }
    return [];
  }

  async getViolationById(id: string): Promise<ViolationRecord | undefined> {
    if (this.db) {
      const result = await this.db.query('SELECT * FROM policy_violations WHERE id = $1', [id]);
      if (result.rows.length === 0) return undefined;
      const row = result.rows[0];
      return {
        id: row.id,
        policyId: row.policy_id,
        runId: row.run_id || undefined,
        resourceId: row.resource_id || undefined,
        severity: row.severity,
        message: row.message,
        resolved: row.resolved,
        waived: row.waived || false,
        createdAt: row.created_at,
      };
    }
    return undefined;
  }

  async waiveViolation(id: string, reason: string): Promise<ViolationRecord | undefined> {
    if (!this.db) return undefined;
    const result = await this.db.query(
      'UPDATE policy_violations SET waived = true WHERE id = $1 RETURNING *',
      [id]
    );
    if (result.rows.length === 0) return undefined;
    const row = result.rows[0];
    return {
      id: row.id,
      policyId: row.policy_id,
      runId: row.run_id || undefined,
      resourceId: row.resource_id || undefined,
      severity: row.severity,
      message: row.message,
      resolved: row.resolved,
      waived: true,
      createdAt: row.created_at,
    };
  }

  async resolveViolation(id: string): Promise<ViolationRecord | undefined> {
    if (!this.db) return undefined;
    const result = await this.db.query(
      'UPDATE policy_violations SET resolved = true WHERE id = $1 RETURNING *',
      [id]
    );
    if (result.rows.length === 0) return undefined;
    const row = result.rows[0];
    return {
      id: row.id,
      policyId: row.policy_id,
      runId: row.run_id || undefined,
      resourceId: row.resource_id || undefined,
      severity: row.severity,
      message: row.message,
      resolved: true,
      waived: row.waived || false,
      createdAt: row.created_at,
    };
  }

  async listOverrides(): Promise<Array<{ id: string; policyId: string; reason: string; overriddenBy: string; overriddenAt: Date }>> {
    return [];
  }

  async createOverride(data: { policyId: string; reason: string; overriddenBy: string }): Promise<{ id: string; policyId: string; reason: string; overriddenBy: string; overriddenAt: Date }> {
    return {
      id: `override-${Date.now()}`,
      policyId: data.policyId,
      reason: data.reason,
      overriddenBy: data.overriddenBy,
      overriddenAt: new Date(),
    };
  }
}
