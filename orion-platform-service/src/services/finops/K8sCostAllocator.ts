/**
 * K8s 成本分摊服务
 *
 * 根据资源使用情况将 Kubernetes 集群成本分摊到命名空间、部署、Pod 级别
 * 支持多租户成本归因
 * 持久化：PostgreSQL (finops_k8s_costs) + 内存降级 (fallback)
 */

import { v4 as uuidv4 } from 'uuid';
import { K8sCost } from './types';
import { DatabasePool } from '../../database';

/**
 * 集群资源使用数据
 */
export interface ClusterResourceUsage {
  /** 节点名称 */
  nodeName: string;
  /** 节点总成本 */
  nodeCost: number;
  /** CPU 总核数 */
  totalCpuCores: number;
  /** CPU 已用核数 */
  usedCpuCores: number;
  /** 内存总容量 (GB) */
  totalMemoryGB: number;
  /** 内存已用量 (GB) */
  usedMemoryGB: number;
  /** 存储总容量 (GB) */
  totalStorageGB: number;
  /** 存储已用量 (GB) */
  usedStorageGB: number;
  /** 网络成本 */
  networkCost: number;
}

/**
 * Pod 资源使用数据
 */
export interface PodResourceUsage {
  /** Pod 名称 */
  podName: string;
  /** 命名空间 */
  namespace: string;
  /** 部署名称 */
  deployment: string;
  /** CPU 请求核数 */
  cpuRequest: number;
  /** CPU 使用核数 */
  cpuUsed: number;
  /** 内存请求 (GB) */
  memoryRequest: number;
  /** 内存使用 (GB) */
  memoryUsed: number;
  /** 存储使用 (GB) */
  storageUsed: number;
  /** 租户 ID */
  tenantId?: string;
  /** 节点名称 */
  nodeName?: string;
}

/**
 * Namespace 成本汇总
 */
export interface NamespaceCostSummary {
  /** 命名空间 */
  namespace: string;
  /** CPU 成本 */
  cpuCost: number;
  /** 内存成本 */
  memoryCost: number;
  /** 存储成本 */
  storageCost: number;
  /** 网络成本 */
  networkCost: number;
  /** 总成本 */
  totalCost: number;
  /** Pod 数量 */
  podCount: number;
  /** 关联租户 */
  tenantId?: string;
}

/**
 * K8s 成本分摊服务
 */
export class K8sCostAllocator {
  /** 已计算的成本记录（内存后备存储，DB 失败时使用） */
  private costRecords: K8sCost[] = [];

  /** PostgreSQL 数据库连接池（可选） */
  private db: DatabasePool | null = null;

  /**
   * 构造函数
   *
   * @param db - 可选的数据库连接池，提供则持久化到 PostgreSQL
   */
  constructor(db?: DatabasePool) {
    if (db) {
      this.db = db;
    }
  }

  /**
   * 分配集群成本
   *
   * 根据集群节点资源使用情况，将成本分摊到各个 Pod
   * 同时将记录持久化到 PostgreSQL（失败时降级到内存）
   *
   * @param clusterUsage 集群资源使用数据
   * @param podUsage Pod 资源使用数据列表
   * @param timestamp 时间戳
   */
  allocateClusterCosts(
    clusterUsage: ClusterResourceUsage,
    podUsage: PodResourceUsage[],
    timestamp: Date = new Date()
  ): K8sCost[] {
    // 计算每单位资源的成本
    const cpuCostPerCore = clusterUsage.nodeCost * 0.4 / Math.max(clusterUsage.totalCpuCores, 1);
    const memoryCostPerGB = clusterUsage.nodeCost * 0.35 / Math.max(clusterUsage.totalMemoryGB, 1);
    const storageCostPerGB = clusterUsage.nodeCost * 0.15 / Math.max(clusterUsage.totalStorageGB, 1);
    const networkCostPerPod = clusterUsage.networkCost / Math.max(podUsage.length, 1);

    const records: K8sCost[] = [];

    for (const pod of podUsage) {
      const cpuCost = Math.round(pod.cpuUsed * cpuCostPerCore * 100) / 100;
      const memoryCost = Math.round(pod.memoryUsed * memoryCostPerGB * 100) / 100;
      const storageCost = Math.round(pod.storageUsed * storageCostPerGB * 100) / 100;
      const networkCost = Math.round(networkCostPerPod * 100) / 100;
      const totalCost = Math.round((cpuCost + memoryCost + storageCost + networkCost) * 100) / 100;

      const record: K8sCost = {
        id: uuidv4(),
        namespace: pod.namespace,
        deployment: pod.deployment,
        podName: pod.podName,
        cpuCost,
        memoryCost,
        storageCost,
        networkCost,
        totalCost,
        tenantId: pod.tenantId,
        timestamp,
        clusterName: pod.nodeName ? `cluster-${pod.nodeName.split('-')[0]}` : undefined,
        nodeName: pod.nodeName,
      };

      records.push(record);
    }

    // 持久化到 PostgreSQL（失败不影响业务）
    this.persistToDatabase(records);

    // 内存中备份
    this.costRecords.push(...records);
    return records;
  }

  /**
   * 将成本记录持久化到 PostgreSQL
   * 若 DB 不可用则静默降级到内存模式
   */
  private persistToDatabase(records: K8sCost[]): void {
    if (!this.db) {
      return; // 未配置数据库，直接使用内存
    }

    try {
      for (const record of records) {
        this.db.query(
          `INSERT INTO finops_k8s_costs
            (id, namespace, deployment, pod_name, cpu_cost, memory_cost, storage_cost, network_cost,
             total_cost, tenant_id, timestamp, cluster_name, node_name)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
           ON CONFLICT (id) DO NOTHING`,
          [
            record.id,
            record.namespace,
            record.deployment,
            record.podName || null,
            record.cpuCost,
            record.memoryCost,
            record.storageCost,
            record.networkCost,
            record.totalCost,
            record.tenantId || null,
            record.timestamp,
            record.clusterName || null,
            record.nodeName || null,
          ]
        ).catch(() => {
          // DB 写入失败静默降级，已在内存中保留副本
        });
      }
    } catch {
      // DB 连接异常等不可恢复错误，仅记录不抛出
    }
  }

  /**
   * 获取命名空间级别成本汇总
   *
   * 优先从 PostgreSQL 读取，DB 不可用时降级到内存
   */
  async getNamespaceCosts(filter?: { namespace?: string; startTime?: Date; endTime?: Date }): Promise<NamespaceCostSummary[]> {
    // 优先从数据库读取
    const dbRecords = await this.fetchFromDatabase(filter);
    let records = dbRecords.length > 0 ? dbRecords : [...this.costRecords];

    if (filter?.namespace) {
      records = records.filter((r) => r.namespace === filter.namespace);
    }
    if (filter?.startTime) {
      records = records.filter((r) => r.timestamp >= filter.startTime!);
    }
    if (filter?.endTime) {
      records = records.filter((r) => r.timestamp <= filter.endTime!);
    }

    // 按命名空间聚合
    const namespaceMap = new Map<string, {
      cpuCost: number;
      memoryCost: number;
      storageCost: number;
      networkCost: number;
      totalCost: number;
      podNames: Set<string>;
      tenantIds: Set<string>;
    }>();

    for (const record of records) {
      const existing = namespaceMap.get(record.namespace) || {
        cpuCost: 0,
        memoryCost: 0,
        storageCost: 0,
        networkCost: 0,
        totalCost: 0,
        podNames: new Set<string>(),
        tenantIds: new Set<string>(),
      };

      existing.cpuCost += record.cpuCost;
      existing.memoryCost += record.memoryCost;
      existing.storageCost += record.storageCost;
      existing.networkCost += record.networkCost;
      existing.totalCost += record.totalCost;
      if (record.podName) {
        existing.podNames.add(record.podName);
      }
      if (record.tenantId) {
        existing.tenantIds.add(record.tenantId);
      }

      namespaceMap.set(record.namespace, existing);
    }

    const summaries: NamespaceCostSummary[] = [];
    for (const [namespace, data] of namespaceMap) {
      summaries.push({
        namespace,
        cpuCost: Math.round(data.cpuCost * 100) / 100,
        memoryCost: Math.round(data.memoryCost * 100) / 100,
        storageCost: Math.round(data.storageCost * 100) / 100,
        networkCost: Math.round(data.networkCost * 100) / 100,
        totalCost: Math.round(data.totalCost * 100) / 100,
        podCount: data.podNames.size,
        tenantId: data.tenantIds.size === 1 ? Array.from(data.tenantIds)[0] : undefined,
      });
    }

    // 按总成本降序排序
    summaries.sort((a, b) => b.totalCost - a.totalCost);
    return summaries;
  }

  /**
   * 获取 Pod 级别成本明细
   */
  getPodCosts(filter?: { namespace?: string; deployment?: string }): K8sCost[] {
    let records = [...this.costRecords];

    if (filter?.namespace) {
      records = records.filter((r) => r.namespace === filter.namespace);
    }
    if (filter?.deployment) {
      records = records.filter((r) => r.deployment === filter.deployment);
    }

    return records.sort((a, b) => b.totalCost - a.totalCost);
  }

  /**
   * 获取租户级别成本汇总
   */
  getTenantCosts(filter?: { tenantId?: string; startTime?: Date; endTime?: Date }): Record<string, number> {
    let records = [...this.costRecords];

    if (filter?.tenantId) {
      records = records.filter((r) => r.tenantId === filter.tenantId);
    }
    if (filter?.startTime) {
      records = records.filter((r) => r.timestamp >= filter.startTime!);
    }
    if (filter?.endTime) {
      records = records.filter((r) => r.timestamp <= filter.endTime!);
    }

    const tenantCosts: Record<string, number> = {};
    for (const record of records) {
      const tenantId = record.tenantId || 'unknown';
      if (!tenantCosts[tenantId]) {
        tenantCosts[tenantId] = 0;
      }
      tenantCosts[tenantId] += record.totalCost;
    }

    // 四舍五入
    for (const key of Object.keys(tenantCosts)) {
      tenantCosts[key] = Math.round(tenantCosts[key] * 100) / 100;
    }

    return tenantCosts;
  }

  /**
   * 按部署分组成本
   */
  getDeploymentCosts(): Record<string, { totalCost: number; podCount: number; namespace: string }> {
    const deploymentMap = new Map<string, { totalCost: number; podNames: Set<string>; namespace: string }>();

    for (const record of this.costRecords) {
      const key = `${record.namespace}/${record.deployment}`;
      const existing = deploymentMap.get(key) || {
        totalCost: 0,
        podNames: new Set<string>(),
        namespace: record.namespace,
      };

      existing.totalCost += record.totalCost;
      if (record.podName) {
        existing.podNames.add(record.podName);
      }

      deploymentMap.set(key, existing);
    }

    const result: Record<string, { totalCost: number; podCount: number; namespace: string }> = {};
    for (const [key, data] of deploymentMap) {
      result[key] = {
        totalCost: Math.round(data.totalCost * 100) / 100,
        podCount: data.podNames.size,
        namespace: data.namespace,
      };
    }

    return result;
  }

  /**
   * 从 PostgreSQL 获取成本记录
   * 如果数据库不可用则返回空数组（调用方会降级到内存）
   */
  private async fetchFromDatabase(filter?: { namespace?: string; startTime?: Date; endTime?: Date }): Promise<K8sCost[]> {
    if (!this.db) {
      return [];
    }

    try {
      const conditions: string[] = [];
      const params: unknown[] = [];
      let idx = 1;

      if (filter?.namespace) {
        conditions.push(`namespace = $${idx++}`);
        params.push(filter.namespace);
      }
      if (filter?.startTime) {
        conditions.push(`timestamp >= $${idx++}`);
        params.push(filter.startTime);
      }
      if (filter?.endTime) {
        conditions.push(`timestamp <= $${idx++}`);
        params.push(filter.endTime);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      const result = await this.db.query(
        `SELECT id, namespace, deployment, pod_name, cpu_cost, memory_cost, storage_cost, network_cost,
                total_cost, tenant_id, timestamp, cluster_name, node_name
         FROM finops_k8s_costs ${whereClause}
         ORDER BY timestamp DESC`,
        params
      );

      return (result.rows || []).map((row) => ({
        id: row.id,
        namespace: row.namespace,
        deployment: row.deployment,
        podName: row.pod_name,
        cpuCost: row.cpu_cost,
        memoryCost: row.memory_cost,
        storageCost: row.storage_cost,
        networkCost: row.network_cost,
        totalCost: row.total_cost,
        tenantId: row.tenant_id || undefined,
        timestamp: new Date(row.timestamp),
        clusterName: row.cluster_name || undefined,
        nodeName: row.node_name || undefined,
      }));
    } catch {
      return [];
    }
  }

  /**
   * 获取所有成本记录
   */
  getRecords(): K8sCost[] {
    return [...this.costRecords];
  }

  /**
   * 清空成本记录
   */
  clearRecords(): void {
    this.costRecords = [];
  }

  /**
   * 获取记录总数
   */
  getRecordCount(): number {
    return this.costRecords.length;
  }
}
