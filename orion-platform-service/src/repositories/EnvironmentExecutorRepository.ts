/**
 * EnvironmentExecutorRepository - PostgreSQL persistence for environment executor state
 *
 * Replaces the in-memory Map() storage for EnvironmentExecutorService.
 * Tracks environment hibernation/wake states with K8s configuration.
 */

import { BaseRepository } from '../db/base-repository';

export interface EnvironmentExecutorStateEntity {
  id: string;
  envId: string;
  tenantId: string;
  state: 'active' | 'hibernating' | 'hibernated' | 'waking' | 'error';
  lastActiveAt: Date;
  hibernatedAt?: Date;
  wakeScheduledAt?: Date;
  ttlSeconds?: number;
  lastCheckedAt: Date;
  statusMessage?: string;
  previousReplicas?: number;
  originalReplicaCount?: number;
  // K8s configuration (stored as separate columns for queryability)
  k8sNamespace?: string;
  k8sDeploymentName?: string;
  k8sLabelSelector?: string;
  k8sScaleStatefulSets?: boolean;
  k8sHpaName?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateEnvironmentExecutorStateInput {
  id: string;
  envId: string;
  tenantId: string;
  state: string;
  lastActiveAt: Date;
  lastCheckedAt: Date;
  ttlSeconds?: number;
  statusMessage?: string;
  previousReplicas?: number;
  originalReplicaCount?: number;
  k8sNamespace?: string;
  k8sDeploymentName?: string;
  k8sLabelSelector?: string;
  k8sScaleStatefulSets?: boolean;
  k8sHpaName?: string;
}

export class EnvironmentExecutorRepository extends BaseRepository<EnvironmentExecutorStateEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'environment_executor_states');
  }

  /**
   * Find state by tenant and environment ID
   */
  async findByTenantAndEnv(tenantId: string, envId: string): Promise<EnvironmentExecutorStateEntity | undefined> {
    const result = await this.db.query(
      `SELECT * FROM environment_executor_states WHERE tenant_id = $1 AND env_id = $2`,
      [tenantId, envId],
    );
    if (result.rows.length === 0) return undefined;
    return this.mapRowToEntity(result.rows[0]);
  }

  /**
   * Find all states for a tenant
   */
  async findByTenant(tenantId: string): Promise<EnvironmentExecutorStateEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM environment_executor_states WHERE tenant_id = $1 ORDER BY last_active_at DESC`,
      [tenantId],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  /**
   * Find active states for a tenant (for TTL checking)
   */
  async findActiveByTenant(tenantId: string): Promise<EnvironmentExecutorStateEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM environment_executor_states WHERE tenant_id = $1 AND state = 'active' ORDER BY last_active_at`,
      [tenantId],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  /**
   * Create or upsert a state entry
   */
  async upsert(input: CreateEnvironmentExecutorStateInput & {
    hibernatedAt?: Date;
    wakeScheduledAt?: Date;
    statusMessage?: string;
    previousReplicas?: number;
    originalReplicaCount?: number;
  }): Promise<EnvironmentExecutorStateEntity> {
    const result = await this.db.query(
      `INSERT INTO environment_executor_states (
        id, env_id, tenant_id, state, last_active_at, hibernated_at, wake_scheduled_at,
        ttl_seconds, last_checked_at, status_message, previous_replicas, original_replica_count,
        k8s_namespace, k8s_deployment_name, k8s_label_selector, k8s_scale_stateful_sets, k8s_hpa_name,
        created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19
      )
      ON CONFLICT (tenant_id, env_id) DO UPDATE SET
        state = EXCLUDED.state,
        last_active_at = EXCLUDED.last_active_at,
        hibernated_at = EXCLUDED.hibernated_at,
        wake_scheduled_at = EXCLUDED.wake_scheduled_at,
        ttl_seconds = EXCLUDED.ttl_seconds,
        last_checked_at = EXCLUDED.last_checked_at,
        status_message = EXCLUDED.status_message,
        previous_replicas = EXCLUDED.previous_replicas,
        original_replica_count = EXCLUDED.original_replica_count,
        k8s_namespace = EXCLUDED.k8s_namespace,
        k8s_deployment_name = EXCLUDED.k8s_deployment_name,
        k8s_label_selector = EXCLUDED.k8s_label_selector,
        k8s_scale_stateful_sets = EXCLUDED.k8s_scale_stateful_sets,
        k8s_hpa_name = EXCLUDED.k8s_hpa_name,
        updated_at = now()
      RETURNING *`,
      [
        input.id, input.envId, input.tenantId, input.state, input.lastActiveAt,
        input.hibernatedAt || null, input.wakeScheduledAt || null, input.ttlSeconds || null,
        input.lastCheckedAt, input.statusMessage || null, input.previousReplicas || null,
        input.originalReplicaCount || null, input.k8sNamespace || null,
        input.k8sDeploymentName || null, input.k8sLabelSelector || null,
        input.k8sScaleStatefulSets || false, input.k8sHpaName || null,
        new Date(), new Date(),
      ],
    );
    if (result.rows.length === 0) {
      // Fallback for mock/test environments
      return {
        id: input.id,
        envId: input.envId,
        tenantId: input.tenantId,
        state: input.state as EnvironmentExecutorStateEntity['state'],
        lastActiveAt: input.lastActiveAt,
        hibernatedAt: input.hibernatedAt,
        wakeScheduledAt: input.wakeScheduledAt,
        ttlSeconds: input.ttlSeconds,
        lastCheckedAt: input.lastCheckedAt,
        statusMessage: input.statusMessage,
        previousReplicas: input.previousReplicas,
        originalReplicaCount: input.originalReplicaCount,
        k8sNamespace: input.k8sNamespace,
        k8sDeploymentName: input.k8sDeploymentName,
        k8sLabelSelector: input.k8sLabelSelector,
        k8sScaleStatefulSets: input.k8sScaleStatefulSets,
        k8sHpaName: input.k8sHpaName,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }
    return this.mapRowToEntity(result.rows[0]);
  }

  /**
   * Update state fields
   */
  async update(id: string, updates: Partial<Omit<EnvironmentExecutorStateEntity, 'id' | 'created_at'>>): Promise<EnvironmentExecutorStateEntity> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    const fieldMap: Record<string, string> = {
      state: 'state',
      lastActiveAt: 'last_active_at',
      hibernatedAt: 'hibernated_at',
      wakeScheduledAt: 'wake_scheduled_at',
      ttlSeconds: 'ttl_seconds',
      lastCheckedAt: 'last_checked_at',
      statusMessage: 'status_message',
      previousReplicas: 'previous_replicas',
      originalReplicaCount: 'original_replica_count',
      k8sNamespace: 'k8s_namespace',
      k8sDeploymentName: 'k8s_deployment_name',
      k8sLabelSelector: 'k8s_label_selector',
      k8sScaleStatefulSets: 'k8s_scale_stateful_sets',
      k8sHpaName: 'k8s_hpa_name',
    };

    for (const [field, dbField] of Object.entries(fieldMap)) {
      const key = field as keyof typeof updates;
      if (updates[key] !== undefined) {
        fields.push(`${dbField} = $${paramIndex}`);
        values.push(updates[key]);
        paramIndex++;
      }
    }

    if (fields.length === 0) {
      const entity = await this.findById(id);
      if (!entity) throw new Error(`Entity with id ${id} not found`);
      return entity;
    }

    fields.push(`updated_at = $${paramIndex}`);
    values.push(new Date());
    values.push(id);

    const result = await this.db.query(
      `UPDATE environment_executor_states SET ${fields.join(', ')} WHERE id = $${paramIndex + 1} RETURNING *`,
      values,
    );
    if (result.rows.length === 0) {
      throw new Error(`Update failed: entity with id ${id} not found`);
    }
    return this.mapRowToEntity(result.rows[0]);
  }

  protected mapRowToEntity(row: any): EnvironmentExecutorStateEntity {
    return {
      id: row.id,
      envId: row.env_id,
      tenantId: row.tenant_id,
      state: row.state ?? 'active',
      lastActiveAt: row.last_active_at,
      hibernatedAt: row.hibernated_at,
      wakeScheduledAt: row.wake_scheduled_at,
      ttlSeconds: row.ttl_seconds,
      lastCheckedAt: row.last_checked_at,
      statusMessage: row.status_message,
      previousReplicas: row.previous_replicas,
      originalReplicaCount: row.original_replica_count,
      k8sNamespace: row.k8s_namespace,
      k8sDeploymentName: row.k8s_deployment_name,
      k8sLabelSelector: row.k8s_label_selector,
      k8sScaleStatefulSets: row.k8s_scale_stateful_sets,
      k8sHpaName: row.k8s_hpa_name,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
