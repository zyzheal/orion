/**
 * NetworkRepository - Cloud networks and scheduling policies
 *
 * Handles CRUD for:
 * - Cloud networks (cloud_networks table)
 * - Scheduling policies (scheduling_policies table)
 * - Scheduling decisions (scheduling_decisions table)
 */

import { OrionError, ErrorCode } from '../../errors';

// =============================================================================
// Entity Types
// =============================================================================

export interface CloudNetworkEntity {
  id: string;
  tenant_id: string;
  name: string;
  vpc_id: string;
  subnets: string[];
  security_groups: string[];
  status: 'active' | 'provisioning' | 'error';
  created_at: Date;
  updated_at: Date;
}

export interface SchedulingPolicyEntity {
  id: string;
  tenant_id: string;
  name: string;
  strategy: 'cost-optimized' | 'performance-optimized' | 'balanced' | 'geo-proximity';
  constraints: Record<string, unknown>;
  priority: number;
  enabled: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface SchedulingDecisionEntity {
  id: string;
  policy_id: string;
  resource_type: string;
  selected_provider: string;
  selected_region: string;
  estimated_cost: number;
  reason: string;
  alternatives: { provider: string; region: string; cost: number }[];
  decided_at: Date;
  created_at: Date;
  updated_at: Date;
}

// =============================================================================
// NetworkRepository
// =============================================================================

export class NetworkRepository {
  constructor(
    private db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> },
  ) {}

  // ==================== Cloud Network Operations ====================

  async createCloudNetwork(input: {
    id: string;
    tenant_id: string;
    name: string;
    vpc_id: string;
    subnets: string[];
    security_groups: string[];
    status: string;
    created_at: Date;
  }): Promise<CloudNetworkEntity> {
    const result = await this.db.query(
      `INSERT INTO cloud_networks
        (id, tenant_id, name, vpc_id, subnets, security_groups, status, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [input.id, input.tenant_id, input.name, input.vpc_id,
       JSON.stringify(input.subnets), JSON.stringify(input.security_groups),
       input.status, input.created_at],
    );
    if (result.rows.length === 0) {
      throw new OrionError('INSERT into cloud_networks returned no rows', ErrorCode.OPERATION_FAILED);
    }
    return this.mapCloudNetworkRow(result.rows[0]);
  }

  async findCloudNetworkById(id: string): Promise<CloudNetworkEntity | undefined> {
    const result = await this.db.query(
      `SELECT * FROM cloud_networks WHERE id = $1`,
      [id],
    );
    if (result.rows.length === 0) return undefined;
    return this.mapCloudNetworkRow(result.rows[0]);
  }

  async findCloudNetworksByTenant(tenantId: string): Promise<CloudNetworkEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM cloud_networks WHERE tenant_id = $1 ORDER BY created_at DESC`,
      [tenantId],
    );
    return result.rows.map((row: any) => this.mapCloudNetworkRow(row));
  }

  // ==================== Scheduling Policy Operations ====================

  async createSchedulingPolicy(input: {
    id: string;
    tenant_id: string;
    name: string;
    strategy: string;
    constraints: Record<string, unknown>;
    priority: number;
    enabled: boolean;
    created_at: Date;
  }): Promise<SchedulingPolicyEntity> {
    const result = await this.db.query(
      `INSERT INTO scheduling_policies
        (id, tenant_id, name, strategy, constraints, priority, enabled, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [input.id, input.tenant_id, input.name, input.strategy,
       JSON.stringify(input.constraints), input.priority, input.enabled, input.created_at],
    );
    if (result.rows.length === 0) {
      throw new OrionError('INSERT into scheduling_policies returned no rows', ErrorCode.OPERATION_FAILED);
    }
    return this.mapSchedulingPolicyRow(result.rows[0]);
  }

  async findSchedulingPolicyById(id: string): Promise<SchedulingPolicyEntity | undefined> {
    const result = await this.db.query(
      `SELECT * FROM scheduling_policies WHERE id = $1`,
      [id],
    );
    if (result.rows.length === 0) return undefined;
    return this.mapSchedulingPolicyRow(result.rows[0]);
  }

  async findSchedulingPoliciesByTenant(tenantId: string): Promise<SchedulingPolicyEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM scheduling_policies WHERE tenant_id = $1 ORDER BY priority ASC, created_at DESC`,
      [tenantId],
    );
    return result.rows.map((row: any) => this.mapSchedulingPolicyRow(row));
  }

  // ==================== Scheduling Decision Operations ====================

  async createSchedulingDecision(input: {
    id: string;
    policy_id: string;
    resource_type: string;
    selected_provider: string;
    selected_region: string;
    estimated_cost: number;
    reason: string;
    alternatives: { provider: string; region: string; cost: number }[];
    decided_at: Date;
    created_at: Date;
  }): Promise<SchedulingDecisionEntity> {
    const result = await this.db.query(
      `INSERT INTO scheduling_decisions
        (id, policy_id, resource_type, selected_provider, selected_region, estimated_cost, reason, alternatives, decided_at, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [input.id, input.policy_id, input.resource_type, input.selected_provider,
       input.selected_region, input.estimated_cost, input.reason,
       JSON.stringify(input.alternatives), input.decided_at, input.created_at],
    );
    if (result.rows.length === 0) {
      throw new OrionError('INSERT into scheduling_decisions returned no rows', ErrorCode.OPERATION_FAILED);
    }
    return this.mapSchedulingDecisionRow(result.rows[0]);
  }

  async findSchedulingDecisionsByPolicyId(policyId: string): Promise<SchedulingDecisionEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM scheduling_decisions WHERE policy_id = $1 ORDER BY decided_at DESC`,
      [policyId],
    );
    return result.rows.map((row: any) => this.mapSchedulingDecisionRow(row));
  }

  // ==================== Converters ====================

  private mapCloudNetworkRow(row: any): CloudNetworkEntity {
    return {
      id: row.id,
      tenant_id: row.tenant_id,
      name: row.name,
      vpc_id: row.vpc_id,
      subnets: typeof row.subnets === 'string' ? JSON.parse(row.subnets) : (row.subnets ?? []),
      security_groups: typeof row.security_groups === 'string' ? JSON.parse(row.security_groups) : (row.security_groups ?? []),
      status: row.status,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  private mapSchedulingPolicyRow(row: any): SchedulingPolicyEntity {
    return {
      id: row.id,
      tenant_id: row.tenant_id,
      name: row.name,
      strategy: row.strategy,
      constraints: typeof row.constraints === 'string' ? JSON.parse(row.constraints) : (row.constraints ?? {}),
      priority: Number(row.priority),
      enabled: row.enabled ?? true,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  private mapSchedulingDecisionRow(row: any): SchedulingDecisionEntity {
    return {
      id: row.id,
      policy_id: row.policy_id,
      resource_type: row.resource_type,
      selected_provider: row.selected_provider,
      selected_region: row.selected_region,
      estimated_cost: Number(row.estimated_cost),
      reason: row.reason,
      alternatives: typeof row.alternatives === 'string' ? JSON.parse(row.alternatives) : (row.alternatives ?? []),
      decided_at: row.decided_at,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }
}
