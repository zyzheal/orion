/**
 * K8sCostRepository - Data access for K8s cost allocation tables
 *
 * Covers: k8s_cluster_cost, k8s_namespace_cost, k8s_pod_cost
 * Tenant filtering via RLS + getCurrentTenantId() for explicit WHERE clauses.
 */

import { getCurrentTenantId } from '../../../db/tenant-context-storage';

export interface ClusterCost {
  id: string;
  tenant_id: string;
  cluster_name: string;
  region: string | null;
  month: string;
  node_count: number;
  total_cpu_cores: number;
  total_memory_gb: number;
  total_gpu_count: number;
  compute_cost: number;
  storage_cost: number;
  network_cost: number;
  total_cost: number;
  currency: string;
  created_at: Date;
}

export interface NamespaceCost {
  id: string;
  tenant_id: string;
  cluster_name: string;
  namespace: string;
  month: string;
  cpu_request_cores: number;
  cpu_usage_cores: number;
  memory_request_gb: number;
  memory_usage_gb: number;
  gpu_count: number;
  pod_count: number;
  compute_cost: number;
  storage_cost: number;
  total_cost: number;
  cost_per_pod: number;
  created_at: Date;
}

export interface PodCost {
  id: string;
  tenant_id: string;
  cluster_name: string;
  namespace: string;
  pod_name: string;
  workload_name: string | null;
  workload_type: string | null;
  month: string;
  cpu_request_millicores: number;
  cpu_usage_millicores: number;
  memory_request_mb: number;
  memory_usage_mb: number;
  gpu_count: number;
  running_hours: number;
  total_cost: number;
  created_at: Date;
}

type DbConnection = {
  query: (text: string, params?: any[]) => Promise<{ rows: any[]; rowCount: number | null }>;
};

export class K8sCostRepository {
  constructor(private db: DbConnection) {}

  // ── Cluster Costs ──────────────────────────────────────────────────────

  async getClusterCosts(month?: string): Promise<ClusterCost[]> {
    const tenantId = getCurrentTenantId();
    let sql = 'SELECT * FROM k8s_cluster_cost WHERE tenant_id = $1';
    const params: any[] = [tenantId];
    if (month) {
      sql += ' AND month = $2';
      params.push(month);
    }
    sql += ' ORDER BY month DESC, total_cost DESC';
    return (await this.db.query(sql, params)).rows;
  }

  async upsertClusterCost(data: {
    cluster_name: string;
    region?: string;
    month: string;
    node_count?: number;
    total_cpu_cores?: number;
    total_memory_gb?: number;
    total_gpu_count?: number;
    compute_cost?: number;
    storage_cost?: number;
    network_cost?: number;
    total_cost?: number;
    currency?: string;
  }): Promise<ClusterCost> {
    const tenantId = getCurrentTenantId();
    const result = await this.db.query(
      `INSERT INTO k8s_cluster_cost
         (tenant_id, cluster_name, region, month, node_count, total_cpu_cores, total_memory_gb,
          total_gpu_count, compute_cost, storage_cost, network_cost, total_cost, currency)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       ON CONFLICT (tenant_id, cluster_name, month)
       DO UPDATE SET
         region = EXCLUDED.region,
         node_count = EXCLUDED.node_count,
         total_cpu_cores = EXCLUDED.total_cpu_cores,
         total_memory_gb = EXCLUDED.total_memory_gb,
         total_gpu_count = EXCLUDED.total_gpu_count,
         compute_cost = EXCLUDED.compute_cost,
         storage_cost = EXCLUDED.storage_cost,
         network_cost = EXCLUDED.network_cost,
         total_cost = EXCLUDED.total_cost,
         currency = EXCLUDED.currency
       RETURNING *`,
      [
        tenantId,
        data.cluster_name,
        data.region ?? null,
        data.month,
        data.node_count ?? null,
        data.total_cpu_cores ?? null,
        data.total_memory_gb ?? null,
        data.total_gpu_count ?? 0,
        data.compute_cost ?? null,
        data.storage_cost ?? null,
        data.network_cost ?? null,
        data.total_cost ?? null,
        data.currency ?? 'CNY',
      ],
    );
    return result.rows[0];
  }

  // ── Namespace Costs ────────────────────────────────────────────────────

  async getNamespaceCosts(clusterName: string, month?: string): Promise<NamespaceCost[]> {
    const tenantId = getCurrentTenantId();
    let sql = 'SELECT * FROM k8s_namespace_cost WHERE tenant_id = $1 AND cluster_name = $2';
    const params: any[] = [tenantId, clusterName];
    if (month) {
      sql += ' AND month = $3';
      params.push(month);
    }
    sql += ' ORDER BY month DESC, total_cost DESC';
    return (await this.db.query(sql, params)).rows;
  }

  async upsertNamespaceCost(data: {
    cluster_name: string;
    namespace: string;
    month: string;
    cpu_request_cores?: number;
    cpu_usage_cores?: number;
    memory_request_gb?: number;
    memory_usage_gb?: number;
    gpu_count?: number;
    pod_count?: number;
    compute_cost?: number;
    storage_cost?: number;
    total_cost?: number;
    cost_per_pod?: number;
  }): Promise<NamespaceCost> {
    const tenantId = getCurrentTenantId();
    const result = await this.db.query(
      `INSERT INTO k8s_namespace_cost
         (tenant_id, cluster_name, namespace, month, cpu_request_cores, cpu_usage_cores,
          memory_request_gb, memory_usage_gb, gpu_count, pod_count,
          compute_cost, storage_cost, total_cost, cost_per_pod)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
       ON CONFLICT (tenant_id, cluster_name, namespace, month)
       DO UPDATE SET
         cpu_request_cores = EXCLUDED.cpu_request_cores,
         cpu_usage_cores = EXCLUDED.cpu_usage_cores,
         memory_request_gb = EXCLUDED.memory_request_gb,
         memory_usage_gb = EXCLUDED.memory_usage_gb,
         gpu_count = EXCLUDED.gpu_count,
         pod_count = EXCLUDED.pod_count,
         compute_cost = EXCLUDED.compute_cost,
         storage_cost = EXCLUDED.storage_cost,
         total_cost = EXCLUDED.total_cost,
         cost_per_pod = EXCLUDED.cost_per_pod
       RETURNING *`,
      [
        tenantId,
        data.cluster_name,
        data.namespace,
        data.month,
        data.cpu_request_cores ?? null,
        data.cpu_usage_cores ?? null,
        data.memory_request_gb ?? null,
        data.memory_usage_gb ?? null,
        data.gpu_count ?? 0,
        data.pod_count ?? null,
        data.compute_cost ?? null,
        data.storage_cost ?? null,
        data.total_cost ?? null,
        data.cost_per_pod ?? null,
      ],
    );
    return result.rows[0];
  }

  // ── Pod Costs ──────────────────────────────────────────────────────────

  async getPodCosts(clusterName: string, namespace: string, month?: string): Promise<PodCost[]> {
    const tenantId = getCurrentTenantId();
    let sql = 'SELECT * FROM k8s_pod_cost WHERE tenant_id = $1 AND cluster_name = $2 AND namespace = $3';
    const params: any[] = [tenantId, clusterName, namespace];
    if (month) {
      sql += ' AND month = $4';
      params.push(month);
    }
    sql += ' ORDER BY month DESC, total_cost DESC';
    return (await this.db.query(sql, params)).rows;
  }

  async upsertPodCost(data: {
    cluster_name: string;
    namespace: string;
    pod_name: string;
    workload_name?: string;
    workload_type?: string;
    month: string;
    cpu_request_millicores?: number;
    cpu_usage_millicores?: number;
    memory_request_mb?: number;
    memory_usage_mb?: number;
    gpu_count?: number;
    running_hours?: number;
    total_cost?: number;
  }): Promise<PodCost> {
    const tenantId = getCurrentTenantId();
    const result = await this.db.query(
      `INSERT INTO k8s_pod_cost
         (tenant_id, cluster_name, namespace, pod_name, workload_name, workload_type, month,
          cpu_request_millicores, cpu_usage_millicores, memory_request_mb, memory_usage_mb,
          gpu_count, running_hours, total_cost)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
       RETURNING *`,
      [
        tenantId,
        data.cluster_name,
        data.namespace,
        data.pod_name,
        data.workload_name ?? null,
        data.workload_type ?? null,
        data.month,
        data.cpu_request_millicores ?? null,
        data.cpu_usage_millicores ?? null,
        data.memory_request_mb ?? null,
        data.memory_usage_mb ?? null,
        data.gpu_count ?? 0,
        data.running_hours ?? null,
        data.total_cost ?? null,
      ],
    );
    return result.rows[0];
  }
}
