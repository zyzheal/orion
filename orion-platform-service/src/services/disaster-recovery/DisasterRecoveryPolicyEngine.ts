/**
 * DisasterRecoveryPolicyEngine - 统一容灾策略引擎
 *
 * F016: Unified DR Policy Engine with PostgreSQL persistence.
 *
 * Features:
 * - DR plan management (create, read, update, delete)
 * - Strategy enforcement (active-active, active-passive, warm/cold standby)
 * - RTO/RPO compliance tracking
 * - Failover policy definitions
 * - Service dependency management
 */

import { v4 as uuidv4 } from 'uuid';
import type { DatabasePool } from '../database';
import { BaseRepository } from '../../db/base-repository';
import { OrionError } from '../../errors';

// ─── Types ──────────────────────────────────────────────────────────────────

export type DRStrategy = 'active-active' | 'active-passive' | 'warm-standby' | 'cold-standby';
export type DRStatus = 'active' | 'testing' | 'inactive' | 'failed';

export interface DRPolicy {
  id: string;
  name: string;
  description: string;
  services: string[]; // Service IDs
  strategy: DRStrategy;
  rpo: string; // RPO (Recovery Point Objective)
  rto: string; // RTO (Recovery Time Objective)
  priority: number;
  status: DRStatus;
  tenantId: string;
  projectId?: string;
  createdById?: string;
  config: DRPolicyConfig;
  createdAt: string;
  updatedAt: string;
}

export interface DRPolicyConfig {
  failoverMode?: 'manual' | 'automatic';
  autoFailback?: boolean;
  healthCheckEndpoint?: string;
  healthCheckInterval?: number;
  switchOverTimeout?: number;
  rollbackEnabled?: boolean;
  dataSyncMode?: 'async' | 'sync' | 'semi-sync';
  priorityList?: string[]; // Service priority order
}

export interface DRPolicyCreateInput {
  name: string;
  description?: string;
  services: string[];
  strategy: DRStrategy;
  rpo: string;
  rto: string;
  priority?: number;
  config?: Partial<DRPolicyConfig>;
}

export interface DRPolicyUpdateInput {
  name?: string;
  description?: string;
  services?: string[];
  strategy?: DRStrategy;
  rpo?: string;
  rto?: string;
  priority?: number;
  status?: DRStatus;
  config?: Partial<DRPolicyConfig>;
}

// ─── Repository ─────────────────────────────────────────────────────────────

export class DRPolicyRepository extends BaseRepository<DRPolicy> {
  constructor(db: { query: (text: string, params?: any[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'disaster_recovery_policies');
  }

  async create(input: DRPolicyCreateInput & { tenantId: string; projectId?: string; createdById?: string }): Promise<DRPolicy> {
    const now = new Date().toISOString();

    const columns: string[] = ['name', 'description', 'services', 'strategy', 'rpo', 'rto', 'priority', 'status', 'tenant_id'];
    const values: any[] = [
      input.name,
      input.description || null,
      input.services,
      input.strategy,
      input.rpo,
      input.rto,
      input.priority || 0,
      'active',
      input.tenantId,
    ];

    if (input.projectId !== undefined) {
      columns.push('project_id');
      values.push(input.projectId);
    }
    if (input.createdById !== undefined) {
      columns.push('created_by_id');
      values.push(input.createdById);
    }
    columns.push('config', 'created_at', 'updated_at');
    values.push(JSON.stringify(input.config || {}), now, now);

    const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
    const query = `INSERT INTO disaster_recovery_policies (${columns.join(', ')}) VALUES (${placeholders}) RETURNING *`;
    const result = await this.db.query(query, values);

    if (result.rows.length === 0) {
      throw new OrionError(`INSERT into disaster_recovery_policies returned no rows`, 'OPERATION_FAILED')
    }
    return this.mapRowToEntity(result.rows[0]);
  }

  async getById(id: string): Promise<DRPolicy | null> {
    const result = await this.db.query(
      `SELECT * FROM disaster_recovery_policies WHERE id = $1`,
      [id],
    );
    if (result.rows.length === 0) return null;
    return this.mapRowToEntity(result.rows[0]);
  }

  async listByTenant(tenantId: string): Promise<DRPolicy[]> {
    const result = await this.db.query(
      `SELECT * FROM disaster_recovery_policies WHERE tenant_id = $1 ORDER BY priority, created_at`,
      [tenantId],
    );
    return result.rows.map((row: any) => this.mapRowToEntity(row));
  }

  // @ts-ignore - Override with different return type
  async update(id: string, input: DRPolicyUpdateInput): Promise<DRPolicy | null> {
    const existing = await this.getById(id);
    if (!existing) return null;

    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (input.name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      values.push(input.name);
    }
    if (input.description !== undefined) {
      updates.push(`description = $${paramIndex++}`);
      values.push(input.description);
    }
    if (input.services !== undefined) {
      updates.push(`services = $${paramIndex++}`);
      values.push(input.services);
    }
    if (input.strategy !== undefined) {
      updates.push(`strategy = $${paramIndex++}`);
      values.push(input.strategy);
    }
    if (input.rpo !== undefined) {
      updates.push(`rpo = $${paramIndex++}`);
      values.push(input.rpo);
    }
    if (input.rto !== undefined) {
      updates.push(`rto = $${paramIndex++}`);
      values.push(input.rto);
    }
    if (input.priority !== undefined) {
      updates.push(`priority = $${paramIndex++}`);
      values.push(input.priority);
    }
    if (input.status !== undefined) {
      updates.push(`status = $${paramIndex++}`);
      values.push(input.status);
    }
    if (input.config !== undefined) {
      updates.push(`config = $${paramIndex++}`);
      values.push(JSON.stringify({ ...existing.config, ...input.config }));
    }

    if (updates.length === 0) {
      return existing; // No changes
    }

    const now = new Date().toISOString();
    updates.push(`updated_at = $${paramIndex}`);
    values.push(now);
    values.push(id);

    const query = `UPDATE disaster_recovery_policies SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`;
    const result = await this.db.query(query, values);

    if (result.rows.length === 0) {
      return null;
    }
    return this.mapRowToEntity(result.rows[0]);
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.db.query(
      `DELETE FROM disaster_recovery_policies WHERE id = $1`,
      [id],
    );
    return (result.rowCount ?? 0) > 0;
  }

  async listByStrategy(tenantId: string, strategy: DRStrategy): Promise<DRPolicy[]> {
    const result = await this.db.query(
      `SELECT * FROM disaster_recovery_policies WHERE tenant_id = $1 AND strategy = $2`,
      [tenantId, strategy],
    );
    return result.rows.map((row: any) => this.mapRowToEntity(row));
  }

  async listActive(tenantId: string): Promise<DRPolicy[]> {
    return this.listByStatus(tenantId, 'active');
  }

  async listByStatus(tenantId: string, status: DRStatus): Promise<DRPolicy[]> {
    const result = await this.db.query(
      `SELECT * FROM disaster_recovery_policies WHERE tenant_id = $1 AND status = $2`,
      [tenantId, status],
    );
    return result.rows.map((row: any) => this.mapRowToEntity(row));
  }

  // ─── Private ──────────────────────────────────────────────────────────────

  protected mapRowToEntity(row: any): DRPolicy {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      services: row.services || [],
      strategy: row.strategy,
      rpo: row.rpo,
      rto: row.rto,
      priority: row.priority || 0,
      status: row.status,
      tenantId: row.tenant_id,
      projectId: row.project_id,
      createdById: row.created_by_id,
      config: row.config ? JSON.parse(row.config) : {},
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

// ─── Service ────────────────────────────────────────────────────────────────

export class DisasterRecoveryPolicyService {
  private repository: DRPolicyRepository | null;

  constructor(database: DatabasePool | null) {
    this.repository = database ? new DRPolicyRepository(database) : null;
  }

  // ─── CRUD Operations ─────────────────────────────────────────────────────

  async createPolicy(
    input: DRPolicyCreateInput & { tenantId: string; projectId?: string; createdById?: string },
  ): Promise<DRPolicy> {
    if (!this.repository) {
      return this.mockCreate(input);
    }
    return this.repository.create(input);
  }

  async getPolicy(id: string): Promise<DRPolicy | null> {
    if (!this.repository) return null;
    return this.repository.getById(id);
  }

  async listPolicies(tenantId: string): Promise<DRPolicy[]> {
    if (!this.repository) return [];
    return this.repository.listByTenant(tenantId);
  }

  async updatePolicy(
    id: string,
    input: DRPolicyUpdateInput,
  ): Promise<DRPolicy | null> {
    if (!this.repository) return null;
    return this.repository.update(id, input);
  }

  async deletePolicy(id: string): Promise<boolean> {
    if (!this.repository) return false;
    return this.repository.delete(id);
  }

  // ─── Policy Enforcement ──────────────────────────────────────────────────

  /**
   * Check if a policy allows failover to a target region
   */
  async canFailover(policy: DRPolicy, targetRegion: string): Promise<boolean> {
    // Active-active: failover to any region
    if (policy.strategy === 'active-active') return true;

    // Check policy config for allowed regions
    const config = policy.config as any;
    const allowedRegions = config?.allowed_regions;
    if (allowedRegions && Array.isArray(allowedRegions)) {
      return allowedRegions.includes(targetRegion);
    }

    // Default: allow failover for non-active-passive strategies
    return policy.strategy !== 'active-passive';
  }

  /**
   * Check RTO/RPO compliance
   */
  async checkCompliance(policy: DRPolicy, actualRTO: number, actualRPO: number): Promise<boolean> {
    // Parse RTO/RPO from policy (format: "5m", "1h", "30s")
    const policyRTO = this.parseDuration(policy.rto);
    const policyRPO = this.parseDuration(policy.rpo);

    return actualRTO <= policyRTO && actualRPO <= policyRPO;
  }

  /**
   * Get failover cost estimate based on strategy
   */
  getFailoverCostEstimate(strategy: DRStrategy, serviceCount: number): number {
    const baseCosts: Record<DRStrategy, number> = {
      'active-active': 0, // Already running, minimal cost
      'active-passive': 100, // Start passive instances
      'warm-standby': 500, // Warm up instances
      'cold-standby': 1000, // Start from cold
    };
    return baseCosts[strategy] + serviceCount * 10;
  }

  // ─── Mock Mode (for tests without DB) ────────────────────────────────────

  private mockCreate(input: DRPolicyCreateInput & { tenantId: string; projectId?: string; createdById?: string }): DRPolicy {
    const id = `dr-policy-${Date.now()}-${uuidv4().slice(0, 8)}`;
    return {
      id,
      name: input.name,
      description: input.description || '',
      services: input.services,
      strategy: input.strategy,
      rpo: input.rpo,
      rto: input.rto,
      priority: input.priority || 0,
      status: 'active',
      tenantId: input.tenantId,
      projectId: input.projectId,
      createdById: input.createdById,
      config: input.config || {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  // ─── Private Helpers ─────────────────────────────────────────────────────

  private parseDuration(duration: string): number {
    // Parse duration strings like "5m", "1h", "30s" to milliseconds
    const match = duration.match(/^(\d+)([smh]?)$/);
    if (!match) return 0;
    const value = parseInt(match[1], 10);
    const unit = match[2];
    switch (unit) {
      case 's': return value * 1000;
      case 'm': return value * 60 * 1000;
      case 'h': return value * 60 * 60 * 1000;
      default: return value;
    }
  }
}
