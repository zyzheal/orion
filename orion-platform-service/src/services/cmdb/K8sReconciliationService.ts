/**
 * K8s Reconciliation Service
 *
 * 提供 K8s 与 CMDB 的定时对账能力：
 * - 定时全量对账（5分钟间隔）
 * - 对账差异检测
 * - 数据冲突解决策略：
 *   - K8s原生属性：以K8s为准
 *   - CMDB扩展属性：以CMDB为准
 */

import { createLogger } from '../../utils/logger';
import * as k8s from '@kubernetes/client-node';
import { CmdbService } from './CmdbService';
import { CI, CiType, CreateCIInput, UpdateCIInput } from './CmdbTypes';
import { SyncStatus } from './K8sWatchClient';

const logger = createLogger('K8sReconciliationService');

/**
 * 对账配置
 */
export interface ReconciliationConfig {
  /** K8s API Server URL */
  apiServerUrl?: string;
  /** Bearer Token */
  token?: string;
  /** CA 证书 */
  caCert?: string;
  /** 是否使用集群内配置 */
  useClusterConfig?: boolean;
  /** 对账间隔（毫秒） */
  intervalMs?: number;
  /** 命名空间列表（为空表示所有） */
  namespaces?: string[];
  /** 资源类型 */
  resourceKinds?: ('Namespace' | 'Deployment' | 'Pod' | 'Service')[];
}

/**
 * 对账差异
 */
export interface ReconciliationDiff {
  /** 资源类型 */
  kind: string;
  /** 资源名称 */
  name: string;
  /** 命名空间 */
  namespace: string;
  /** 差异类型 */
  diffType: 'MISSING_IN_CMDB' | 'MISSING_IN_K8S' | 'CONFLICT';
  /** K8s 数据 */
  k8sData?: any;
  /** CMDB 数据 */
  cmdbData?: CI;
  /** 冲突字段详情 */
  conflictFields?: Record<string, { k8sValue: any; cmdbValue: any; resolution: 'K8S' | 'CMDB' }>;
}

/**
 * 对账结果
 */
export interface ReconciliationResult {
  /** 开始时间 */
  startedAt: Date;
  /** 结束时间 */
  endedAt: Date;
  /** 耗时（毫秒） */
  durationMs: number;
  /** 检查的资源数量 */
  resourcesChecked: number;
  /** 发现的差异数量 */
  diffsFound: number;
  /** 已修复的差异数量 */
  diffsResolved: number;
  /** 差异详情 */
  diffs: ReconciliationDiff[];
  /** 错误 */
  errors: string[];
  /** 状态 */
  status: 'SUCCESS' | 'PARTIAL' | 'FAILED';
}

/**
 * K8s 资源数据
 */
export interface K8sResourceData {
  kind: string;
  name: string;
  namespace: string;
  uid: string;
  resourceVersion: string;
  labels: Record<string, string>;
  annotations: Record<string, string>;
  spec: Record<string, any>;
  status: Record<string, any>;
  createdAt: Date;
}

/**
 * CMDB 扩展属性键名（这些属性以 CMDB 为准）
 */
const CMDB_EXTENDED_ATTRIBUTES = [
  'owner',
  'costCenter',
  'businessApp',
  'slaLevel',
  'ticketId',
  'notes',
  'customTags',
  'approvalStatus',
  'lastAuditAt',
  'riskLevel',
];

/**
 * K8s 原生属性键名（这些属性以 K8s 为准）
 */
const K8S_NATIVE_ATTRIBUTES = [
  'labels',
  'annotations',
  'spec',
  'status',
  'resourceVersion',
  'uid',
  'nodeName',
  'podIP',
  'phase',
  'containerStatuses',
  'replicas',
  'availableReplicas',
];

/**
 * K8s 对账服务
 */
export class K8sReconciliationService {
  private kubeConfig: k8s.KubeConfig;
  private coreV1Api: k8s.CoreV1Api;
  private appsV1Api: k8s.AppsV1Api;
  private cmdbService: CmdbService;
  private config: ReconciliationConfig;
  private reconciliationTimer: NodeJS.Timeout | null = null;
  private lastReconciliationResult?: ReconciliationResult;
  private isRunning = false;
  private tenantId: bigint = BigInt(0);

  constructor(cmdbService: CmdbService, config: ReconciliationConfig = {}) {
    this.cmdbService = cmdbService;
    this.config = {
      ...config,
      intervalMs: config.intervalMs || 5 * 60 * 1000, // 默认 5 分钟
      resourceKinds: config.resourceKinds || ['Namespace', 'Deployment', 'Pod'],
    };

    this.kubeConfig = new k8s.KubeConfig();
    this.initializeKubeConfig();

    this.coreV1Api = this.kubeConfig.makeApiClient(k8s.CoreV1Api);
    this.appsV1Api = this.kubeConfig.makeApiClient(k8s.AppsV1Api);
  }

  /**
   * 初始化 KubeConfig
   */
  private initializeKubeConfig(): void {
    if (this.config.useClusterConfig || (!this.config.apiServerUrl && !this.config.token)) {
      try {
        this.kubeConfig.loadFromCluster();
        logger.info('Reconciliation: Loaded KubeConfig from cluster');
      } catch (err) {
        logger.warn({ err }, 'Reconciliation: Failed to load cluster config');
        this.kubeConfig.loadFromDefault();
      }
    } else if (this.config.apiServerUrl && this.config.token) {
      const cluster = {
        name: 'orion-cluster',
        server: this.config.apiServerUrl,
        skipTLSVerify: !this.config.caCert,
        caData: this.config.caCert,
      };

      const user = {
        name: 'orion-sa',
        token: this.config.token,
      };

      const context = {
        name: 'orion-context',
        cluster: cluster.name,
        user: user.name,
      };

      this.kubeConfig.addCluster(cluster);
      this.kubeConfig.addUser(user);
      this.kubeConfig.addContext(context);
      this.kubeConfig.setCurrentContext(context.name);

      logger.info({ server: this.config.apiServerUrl }, 'Reconciliation: Loaded explicit KubeConfig');
    } else {
      this.kubeConfig.loadFromDefault();
      logger.info('Reconciliation: Loaded default KubeConfig');
    }
  }

  /**
   * 设置租户 ID
   */
  setTenantId(tenantId: bigint): void {
    this.tenantId = tenantId;
  }

  /**
   * 启动定时对账
   */
  start(tenantId?: bigint): void {
    if (this.reconciliationTimer) {
      logger.warn('Reconciliation already running');
      return;
    }

    if (tenantId) {
      this.tenantId = tenantId;
    }

    this.isRunning = true;
    logger.info({ intervalMs: this.config.intervalMs }, 'Starting reconciliation timer');

    // 立即执行一次
    this.runReconciliation().catch((err) => {
      logger.error({ err }, 'Initial reconciliation failed');
    });

    // 定时执行
    this.reconciliationTimer = setInterval(() => {
      this.runReconciliation().catch((err) => {
        logger.error({ err }, 'Scheduled reconciliation failed');
      });
    }, this.config.intervalMs!);
  }

  /**
   * 停止定时对账
   */
  stop(): void {
    if (this.reconciliationTimer) {
      clearInterval(this.reconciliationTimer);
      this.reconciliationTimer = null;
    }
    this.isRunning = false;
    logger.info('Stopped reconciliation timer');
  }

  /**
   * 执行一次全量对账
   */
  async runReconciliation(): Promise<ReconciliationResult> {
    const startedAt = new Date();
    const diffs: ReconciliationDiff[] = [];
    const errors: string[] = [];
    let resourcesChecked = 0;
    let diffsResolved = 0;

    logger.info({ tenantId: this.tenantId }, 'Starting full reconciliation');

    try {
      // 获取 K8s 资源列表
      const k8sResources = await this.fetchK8sResources();
      resourcesChecked = k8sResources.length;

      // 获取 CMDB 中对应的 CI
      const cmdbCIs = await this.fetchCMDBCIs();

      // 比较差异
      for (const k8sRes of k8sResources) {
        const ciId = this.generateCiId(k8sRes.kind, k8sRes.namespace, k8sRes.name);
        const cmdbCI = cmdbCIs.find((ci) => ci.ciId === ciId);

        if (!cmdbCI) {
          // K8s 有，CMDB 没有
          diffs.push({
            kind: k8sRes.kind,
            name: k8sRes.name,
            namespace: k8sRes.namespace,
            diffType: 'MISSING_IN_CMDB',
            k8sData: k8sRes,
          });
        } else {
          // 两边都有，检查冲突
          const conflict = this.detectConflict(k8sRes, cmdbCI);
          if (conflict) {
            diffs.push({
              kind: k8sRes.kind,
              name: k8sRes.name,
              namespace: k8sRes.namespace,
              diffType: 'CONFLICT',
              k8sData: k8sRes,
              cmdbData: cmdbCI,
              conflictFields: conflict,
            });
          }
        }
      }

      // 检查 CMDB 有但 K8s 没有的资源（已删除）
      for (const ci of cmdbCIs) {
        const existsInK8s = k8sResources.some(
          (r) => this.generateCiId(r.kind, r.namespace, r.name) === ci.ciId
        );

        if (!existsInK8s && ci.status !== 'DECOMMISSIONED') {
          diffs.push({
            kind: ci.ciType.replace('K8S_', ''),
            name: ci.name,
            namespace: ci.attributes?.namespace || 'default',
            diffType: 'MISSING_IN_K8S',
            cmdbData: ci,
          });
        }
      }

      // 自动修复差异
      for (const diff of diffs) {
        try {
          const resolved = await this.resolveDiff(diff);
          if (resolved) {
            diffsResolved++;
          }
        } catch (err) {
          errors.push(`Failed to resolve diff for ${diff.kind}/${diff.namespace}/${diff.name}: ${(err as Error).message}`);
        }
      }

    } catch (err) {
      errors.push(`Reconciliation failed: ${(err as Error).message}`);
      logger.error({ err }, 'Reconciliation execution failed');
    }

    const endedAt = new Date();
    const durationMs = endedAt.getTime() - startedAt.getTime();

    const result: ReconciliationResult = {
      startedAt,
      endedAt,
      durationMs,
      resourcesChecked,
      diffsFound: diffs.length,
      diffsResolved,
      diffs,
      errors,
      status: errors.length > 0 ? (diffsResolved > 0 ? 'PARTIAL' : 'FAILED') : 'SUCCESS',
    };

    this.lastReconciliationResult = result;

    logger.info(
      {
        durationMs,
        resourcesChecked,
        diffsFound: diffs.length,
        diffsResolved,
        errors: errors.length,
      },
      'Reconciliation completed'
    );

    return result;
  }

  /**
   * 从 K8s 获取资源列表
   */
  private async fetchK8sResources(): Promise<K8sResourceData[]> {
    const resources: K8sResourceData[] = [];
    const namespaces = this.config.namespaces || [];

    // 如果未指定命名空间，获取所有命名空间
    if (namespaces.length === 0 && this.config.resourceKinds!.includes('Namespace')) {
      try {
        const nsResponse = await this.coreV1Api.listNamespace();
        // @kubernetes/client-node returns the list directly
        const nsItems = nsResponse.items || [];
        for (const ns of nsItems) {
          const metadata = ns.metadata!;
          resources.push({
            kind: 'Namespace',
            name: metadata.name || '',
            namespace: '',
            uid: metadata.uid || '',
            resourceVersion: metadata.resourceVersion || '',
            labels: metadata.labels || {},
            annotations: metadata.annotations || {},
            spec: ns.spec || {},
            status: ns.status || {},
            createdAt: new Date(metadata.creationTimestamp || ''),
          });
          namespaces.push(metadata.name || '');
        }
      } catch (err) {
        logger.error({ err }, 'Failed to list namespaces');
      }
    }

    // 获取 Deployment
    if (this.config.resourceKinds!.includes('Deployment')) {
      for (const ns of namespaces) {
        try {
          const deployResponse = await this.appsV1Api.listDeploymentForAllNamespaces();
          const deployItems = deployResponse.items || [];
          for (const deploy of deployItems) {
            const metadata = deploy.metadata!;
            const deployNs = metadata.namespace || ns;
            if (namespaces.length > 0 && !namespaces.includes(deployNs)) {
              continue;
            }
            resources.push({
              kind: 'Deployment',
              name: metadata.name || '',
              namespace: deployNs,
              uid: metadata.uid || '',
              resourceVersion: metadata.resourceVersion || '',
              labels: metadata.labels || {},
              annotations: metadata.annotations || {},
              spec: {
                replicas: deploy.spec?.replicas,
                selector: deploy.spec?.selector,
                template: deploy.spec?.template,
              },
              status: {
                replicas: deploy.status?.replicas,
                availableReplicas: deploy.status?.availableReplicas,
                conditions: deploy.status?.conditions,
              },
              createdAt: new Date(metadata.creationTimestamp || ''),
            });
          }
        } catch (err) {
          logger.error({ ns, err }, 'Failed to list deployments');
        }
      }
    }

    // 获取 Pod
    if (this.config.resourceKinds!.includes('Pod')) {
      try {
        const podResponse = await this.coreV1Api.listPodForAllNamespaces();
        const podItems = podResponse.items || [];
        for (const pod of podItems) {
          const metadata = pod.metadata!;
          const podNs = metadata.namespace || 'default';
          if (namespaces.length > 0 && !namespaces.includes(podNs)) {
            continue;
          }
          resources.push({
            kind: 'Pod',
            name: metadata.name || '',
            namespace: podNs,
            uid: metadata.uid || '',
            resourceVersion: metadata.resourceVersion || '',
            labels: metadata.labels || {},
            annotations: metadata.annotations || {},
            spec: {
              nodeName: pod.spec?.nodeName,
              containers: pod.spec?.containers?.map((c: { name: string }) => c.name),
            },
            status: {
              phase: pod.status?.phase,
              podIP: pod.status?.podIP,
              containerStatuses: pod.status?.containerStatuses?.map((c: { name: string; ready: boolean; restartCount: number }) => ({
                name: c.name,
                ready: c.ready,
                restartCount: c.restartCount,
              })),
            },
            createdAt: new Date(metadata.creationTimestamp || ''),
          });
        }
      } catch (err) {
        logger.error({ err }, 'Failed to list pods');
      }
    }

    // 获取 Service
    if (this.config.resourceKinds!.includes('Service')) {
      try {
        const svcResponse = await this.coreV1Api.listServiceForAllNamespaces();
        const svcItems = svcResponse.items || [];
        for (const svc of svcItems) {
          const metadata = svc.metadata!;
          const svcNs = metadata.namespace || 'default';
          if (namespaces.length > 0 && !namespaces.includes(svcNs)) {
            continue;
          }
          resources.push({
            kind: 'Service',
            name: metadata.name || '',
            namespace: svcNs,
            uid: metadata.uid || '',
            resourceVersion: metadata.resourceVersion || '',
            labels: metadata.labels || {},
            annotations: metadata.annotations || {},
            spec: {
              type: svc.spec?.type,
              ports: svc.spec?.ports,
              clusterIP: svc.spec?.clusterIP,
            },
            status: {
              loadBalancer: svc.status?.loadBalancer,
            },
            createdAt: new Date(metadata.creationTimestamp || ''),
          });
        }
      } catch (err) {
        logger.error({ err }, 'Failed to list services');
      }
    }

    return resources;
  }

  /**
   * 从 CMDB 获取 K8s 相关 CI
   */
  private async fetchCMDBCIs(): Promise<CI[]> {
    const ciTypes: CiType[] = ['K8S_CLUSTER', 'K8S_DEPLOYMENT', 'K8S_POD'];

    const allCIs: CI[] = [];
    for (const ciType of ciTypes) {
      const response = await this.cmdbService.listCIs({
        tenantId: this.tenantId,
        ciType,
        limit: 1000,
      });
      allCIs.push(...response.data);
    }

    return allCIs;
  }

  /**
   * 生成 CI ID
   */
  private generateCiId(kind: string, namespace: string, name: string): string {
    return `k8s-${kind.toLowerCase()}-${namespace}-${name}`;
  }

  /**
   * 检测冲突
   */
  private detectConflict(
    k8sRes: K8sResourceData,
    cmdbCI: CI
  ): Record<string, { k8sValue: any; cmdbValue: any; resolution: 'K8S' | 'CMDB' }> | null {
    const conflicts: Record<string, { k8sValue: any; cmdbValue: any; resolution: 'K8S' | 'CMDB' }> = {};

    // 比较 labels
    const k8sLabels = k8sRes.labels || {};
    const cmdbLabels = cmdbCI.attributes?.labels || {};

    for (const key of Object.keys(k8sLabels)) {
      if (k8sLabels[key] !== cmdbLabels[key]) {
        conflicts[`labels.${key}`] = {
          k8sValue: k8sLabels[key],
          cmdbValue: cmdbLabels[key],
          resolution: 'K8S', // K8s 原生属性，以 K8s 为准
        };
      }
    }

    // 比较 annotations
    const k8sAnnotations = k8sRes.annotations || {};
    const cmdbAnnotations = cmdbCI.attributes?.annotations || {};

    for (const key of Object.keys(k8sAnnotations)) {
      if (k8sAnnotations[key] !== cmdbAnnotations[key]) {
        conflicts[`annotations.${key}`] = {
          k8sValue: k8sAnnotations[key],
          cmdbValue: cmdbAnnotations[key],
          resolution: 'K8S',
        };
      }
    }

    // 比较 spec/status（只检查关键差异）
    const k8sSpec = k8sRes.spec || {};
    const cmdbSpec = cmdbCI.attributes?.spec || {};

    for (const key of Object.keys(k8sSpec)) {
      if (JSON.stringify(k8sSpec[key]) !== JSON.stringify(cmdbSpec[key])) {
        conflicts[`spec.${key}`] = {
          k8sValue: k8sSpec[key],
          cmdbValue: cmdbSpec[key],
          resolution: 'K8S',
        };
      }
    }

    // 检查 CMDB 扩展属性冲突（理论上 K8s 不应该有这些，这里只是检查）
    for (const extAttr of CMDB_EXTENDED_ATTRIBUTES) {
      if (cmdbCI.attributes?.[extAttr] !== undefined) {
        // CMDB 扩展属性，以 CMDB 为准，不需要冲突记录
        // 但如果 K8s 也有这个属性（极少见），则标记冲突
        if (k8sRes.annotations?.[`orion.io/${extAttr}`] !== undefined) {
          conflicts[`extended.${extAttr}`] = {
            k8sValue: k8sRes.annotations[`orion.io/${extAttr}`],
            cmdbValue: cmdbCI.attributes[extAttr],
            resolution: 'CMDB', // CMDB 扩展属性，以 CMDB 为准
          };
        }
      }
    }

    return Object.keys(conflicts).length > 0 ? conflicts : null;
  }

  /**
   * 解决差异
   */
  private async resolveDiff(diff: ReconciliationDiff): Promise<boolean> {
    logger.info(
      { kind: diff.kind, namespace: diff.namespace, name: diff.name, diffType: diff.diffType },
      'Resolving reconciliation diff'
    );

    switch (diff.diffType) {
      case 'MISSING_IN_CMDB':
        // K8s 有，CMDB 没有 -> 创建 CI
        return await this.createCIFromK8s(diff.k8sData);

      case 'MISSING_IN_K8S':
        // CMDB 有，K8s 没有 -> 标记为 DECOMMISSIONED
        if (!diff.cmdbData) {
          return false;
        }
        return await this.decommissionCI(diff.cmdbData);

      case 'CONFLICT':
        // 冲突 -> 根据策略合并
        return await this.resolveConflict(diff);

      default:
        return false;
    }
  }

  /**
   * 从 K8s 数据创建 CI
   */
  private async createCIFromK8s(k8sData: any): Promise<boolean> {
    const ciTypeMap: Record<string, CiType> = {
      'Namespace': 'K8S_CLUSTER', // 命名空间映射到集群级别 CI
      'Deployment': 'K8S_DEPLOYMENT',
      'Pod': 'K8S_POD',
      'Service': 'SERVICE',
    };

    const ciId = this.generateCiId(k8sData.kind, k8sData.namespace, k8sData.name);

    const input: CreateCIInput = {
      ciId,
      tenantId: this.tenantId,
      ciType: ciTypeMap[k8sData.kind] || 'SERVICE',
      name: k8sData.name,
      description: `K8s ${k8sData.kind} in namespace ${k8sData.namespace}`,
      status: 'ACTIVE',
      environment: this.detectEnvironment(k8sData.labels),
      tags: this.extractTags(k8sData.labels),
      attributes: {
        namespace: k8sData.namespace,
        uid: k8sData.uid,
        resourceVersion: k8sData.resourceVersion,
        labels: k8sData.labels,
        annotations: k8sData.annotations,
        spec: k8sData.spec,
        status: k8sData.status,
        kind: k8sData.kind,
        createdAt: k8sData.createdAt,
        syncSource: 'k8s-reconciliation',
        lastSyncAt: new Date().toISOString(),
      },
      createdBy: 'k8s-reconciliation-service',
    };

    try {
      await this.cmdbService.createCI(input);
      logger.info({ ciId }, 'Created CI from K8s');
      return true;
    } catch (err) {
      logger.error({ ciId, err }, 'Failed to create CI from K8s');
      return false;
    }
  }

  /**
   * 将 CI 标记为退役
   */
  private async decommissionCI(ci: CI): Promise<boolean> {
    const update: UpdateCIInput = {
      status: 'DECOMMISSIONED',
      attributes: {
        ...ci.attributes,
        decommissionReason: 'Missing in K8s',
        decommissionAt: new Date().toISOString(),
      },
    };

    try {
      await this.cmdbService.updateCI(ci.id, update, 'k8s-reconciliation-service');
      logger.info({ ciId: ci.ciId }, 'Decommissioned CI missing in K8s');
      return true;
    } catch (err) {
      logger.error({ ciId: ci.ciId, err }, 'Failed to decommission CI');
      return false;
    }
  }

  /**
   * 解决冲突（根据策略合并）
   */
  private async resolveConflict(diff: ReconciliationDiff): Promise<boolean> {
    if (!diff.cmdbData || !diff.conflictFields) {
      return false;
    }

    const mergedAttributes: Record<string, any> = { ...diff.cmdbData.attributes };

    // 根据冲突字段的决定策略合并
    for (const [field, conflict] of Object.entries(diff.conflictFields)) {
      if (conflict.resolution === 'K8S') {
        // K8s 原生属性，以 K8s 为准
        const [category, key] = field.split('.');
        if (category && key && mergedAttributes[category]) {
          mergedAttributes[category][key] = conflict.k8sValue;
        } else if (category === 'labels' || category === 'annotations') {
          mergedAttributes[category] = {
            ...mergedAttributes[category],
            [key]: conflict.k8sValue,
          };
        } else if (category === 'spec') {
          mergedAttributes.spec = {
            ...mergedAttributes.spec,
            [key]: conflict.k8sValue,
          };
        }
      }
      // CMDB 扩展属性保持不变（以 CMDB 为准）
    }

    // 更新 resourceVersion 和 lastSyncAt
    mergedAttributes.resourceVersion = diff.k8sData?.resourceVersion;
    mergedAttributes.lastSyncAt = new Date().toISOString();
    mergedAttributes.syncSource = 'k8s-reconciliation';

    const update: UpdateCIInput = {
      attributes: mergedAttributes,
    };

    try {
      await this.cmdbService.updateCI(diff.cmdbData.id, update, 'k8s-reconciliation-service');
      logger.info(
        { ciId: diff.cmdbData.ciId, conflictsResolved: Object.keys(diff.conflictFields).length },
        'Resolved conflicts'
      );
      return true;
    } catch (err) {
      logger.error({ ciId: diff.cmdbData.ciId, err }, 'Failed to resolve conflicts');
      return false;
    }
  }

  /**
   * 根据 labels 推断环境
   */
  private detectEnvironment(labels: Record<string, string>): string {
    const envLabels = ['env', 'environment', 'stage'];
    for (const label of envLabels) {
      if (labels[label]) {
        return labels[label];
      }
    }
    return 'unknown';
  }

  /**
   * 从 labels 提取 tags
   */
  private extractTags(labels: Record<string, string>): string[] {
    const tagLabels = ['app', 'component', 'tier', 'team', 'version'];
    const tags: string[] = [];

    for (const label of tagLabels) {
      if (labels[label]) {
        tags.push(`${label}:${labels[label]}`);
      }
    }

    return tags;
  }

  /**
   * 获取最后一次对账结果
   */
  getLastResult(): ReconciliationResult | undefined {
    return this.lastReconciliationResult;
  }

  /**
   * 检查是否正在运行
   */
  isRunningState(): boolean {
    return this.isRunning;
  }

  /**
   * 获取同步状态（基于对账结果）
   */
  getSyncStatus(): SyncStatus {
    if (!this.lastReconciliationResult) {
      return 'L0_NORMAL';
    }

    if (this.lastReconciliationResult.status === 'FAILED') {
      return 'L3_DEGRADED';
    }

    if (this.lastReconciliationResult.errors.length > 0) {
      return 'L1_REDUCED';
    }

    return 'L0_NORMAL';
  }
}

export default K8sReconciliationService;