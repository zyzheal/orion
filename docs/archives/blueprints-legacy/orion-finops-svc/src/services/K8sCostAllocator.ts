/**
 * K8s 成本分摊服务
 *
 * 根据资源使用情况将 Kubernetes 集群成本分摊到命名空间、部署、Pod 级别
 * 支持多租户成本归因
 */

import { v4 as uuidv4 } from 'uuid';
import { K8sCost } from '../types/finops';

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
  /** 已计算的成本记录 */
  private costRecords: K8sCost[] = [];

  /**
   * 分配集群成本
   *
   * 根据集群节点资源使用情况，将成本分摊到各个 Pod
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

    this.costRecords.push(...records);
    return records;
  }

  /**
   * 获取命名空间级别成本汇总
   */
  getNamespaceCosts(filter?: { namespace?: string; startTime?: Date; endTime?: Date }): NamespaceCostSummary[] {
    let records = [...this.costRecords];

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
