/**
 * CMDB 集成服务
 *
 * 提供主机/K8s/CI-CD/拓扑的 Read API
 * 支持 K8s 同步双机制（Watch + 定时对账）
 * 同步状态管理（L0正常→L1降频→L2暂停→L3降级）
 * 脚本执行能力
 */

import pino from 'pino';
import { DatabasePool } from './database';
import { EventBusService } from './event-bus-service';
import { CmdbService } from './cmdb/CmdbService';
import { K8sWatchClient, SyncStatus, WatchEvent, K8sResourceKind } from './cmdb/K8sWatchClient';
import { K8sReconciliationService, ReconciliationResult } from './cmdb/K8sReconciliationService';
import type { CI, CiType, CreateCIInput } from './cmdb/CmdbTypes';
import { Client as SSHClient, ConnectConfig } from 'ssh2';
import { OrionError, ErrorCode } from '../../errors';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

/**
 * K8s 资源信息
 */
export interface K8sResource {
  kind: string;
  apiVersion: string;
  metadata: {
    name: string;
    namespace: string;
    uid: string;
    resourceVersion: string;
    labels?: Record<string, string>;
    annotations?: Record<string, string>;
  };
  spec?: Record<string, any>;
  status?: Record<string, any>;
}

/**
 * 主机资源信息
 */
export interface HostResource {
  hostname: string;
  ip: string;
  os: string;
  cpu: number;
  memory: number;
  disk: number;
  status: 'online' | 'offline' | 'unknown';
  tags?: string[];
}

/**
 * CI/CD 资源信息
 */
export interface CICDResource {
  pipelineId: string;
  name: string;
  status: 'running' | 'success' | 'failed' | 'cancelled';
  duration?: number;
  triggeredBy?: string;
  createdAt: Date;
  updatedAt?: Date;
}

/**
 * 拓扑节点
 */
export interface TopologyNode {
  id: string;
  type: string;
  name: string;
  status?: string;
  metadata?: Record<string, any>;
}

/**
 * 拓扑边
 */
export interface TopologyEdge {
  source: string;
  target: string;
  type: string;
  metadata?: Record<string, any>;
}

/**
 * 拓扑响应
 */
export interface TopologyResponse {
  nodes: TopologyNode[];
  edges: TopologyEdge[];
}

/**
 * K8s 同步配置
 */
export interface K8sSyncConfig {
  apiServerUrl?: string;
  token?: string;
  caCert?: string;
  useClusterConfig?: boolean;
  watchEnabled: boolean;
  reconciliationIntervalMs: number; // 对账间隔（默认 5 分钟）
  namespaces?: string[];
  resourceKinds?: K8sResourceKind[];
}

/**
 * K8s 同步状态
 */
export interface K8sSyncState {
  overallStatus: SyncStatus;
  watchStatus: {
    connected: boolean;
    reconnectAttempts: number;
    lastConnectedAt?: Date;
    lastError?: string;
    resourcesWatched: K8sResourceKind[];
  };
  reconciliationStatus: {
    lastResult?: ReconciliationResult;
    isRunning: boolean;
    lastRunAt?: Date;
  };
  healthScore: number; // 0-100
}

/**
 * 脚本执行请求
 */
export interface ScriptExecutionRequest {
  targetCiIds: string[];
  script: string;
  scriptType: 'bash' | 'python' | 'powershell';
  timeout?: number;
  parameters?: Record<string, string>;
}

/**
 * 脚本执行结果
 */
export interface ScriptExecutionResult {
  executionId: string;
  ciId: string;
  status: 'success' | 'failed' | 'timeout';
  stdout?: string;
  stderr?: string;
  exitCode?: number;
  duration?: number;
  executedAt: Date;
}

/**
 * CMDB 集成服务
 */
export class CmdbIntegrationService {
  private cmdbService: CmdbService;
  private eventBus?: EventBusService;
  private k8sWatchClient: K8sWatchClient | null = null;
  private k8sReconciliationService: K8sReconciliationService | null = null;
  private k8sConfig: K8sSyncConfig | null = null;
  private tenantId: bigint = BigInt(0);
  private syncHealthCheckTimer: NodeJS.Timeout | null = null;

  constructor(options: {
    cmdbService?: CmdbService;
    eventBus?: EventBusService;
  } = {}) {
    this.cmdbService = options.cmdbService || new CmdbService();
    this.eventBus = options.eventBus;
  }

  // ==================== Read API ====================

  /**
   * 获取主机列表
   */
  async listHosts(options?: {
    tenantId: bigint;
    status?: string;
    tags?: string[];
    limit?: number;
    offset?: number;
  }): Promise<{ data: HostResource[]; total: number }> {
    logger.info({ options }, 'Listing hosts');

    // 从 CMDB 查询 SERVER 类型的 CI
    const hosts = await this.cmdbService.listCIs({
      tenantId: options?.tenantId || BigInt(0),
      ciType: 'SERVER',
      limit: options?.limit || 100,
      offset: options?.offset || 0,
    });

    const hostResources: HostResource[] = hosts.data.map((ci) => ({
      hostname: ci.attributes?.hostname || ci.name,
      ip: ci.attributes?.ip || '',
      os: ci.attributes?.os || 'unknown',
      cpu: ci.attributes?.cpu || 0,
      memory: ci.attributes?.memory || 0,
      disk: ci.attributes?.disk || 0,
      status: ci.status === 'ACTIVE' ? 'online' : 'offline',
      tags: ci.tags || [],
    }));

    return {
      data: hostResources,
      total: hosts.total,
    };
  }

  /**
   * 获取主机详情
   */
  async getHost(ciId: string): Promise<HostResource | null> {
    logger.info({ ciId }, 'Getting host details');

    const ci = await this.cmdbService.getCIByCiId(ciId);
    if (!ci || ci.ciType !== 'SERVER') {
      return null;
    }

    return {
      hostname: ci.attributes?.hostname || ci.name,
      ip: ci.attributes?.ip || '',
      os: ci.attributes?.os || 'unknown',
      cpu: ci.attributes?.cpu || 0,
      memory: ci.attributes?.memory || 0,
      disk: ci.attributes?.disk || 0,
      status: ci.status === 'ACTIVE' ? 'online' : 'offline',
      tags: ci.tags || [],
    };
  }

  /**
   * 获取 K8s 资源列表
   */
  async listK8sResources(options?: {
    tenantId: bigint;
    kind?: string;
    namespace?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ data: K8sResource[]; total: number }> {
    logger.info({ options }, 'Listing K8s resources');

    const ciTypeMap: Record<string, CiType> = {
      'Cluster': 'K8S_CLUSTER',
      'Deployment': 'K8S_DEPLOYMENT',
      'Pod': 'K8S_POD',
    };

    const ciType = options?.kind ? ciTypeMap[options.kind] : undefined;

    const cis = await this.cmdbService.listCIs({
      tenantId: options?.tenantId || BigInt(0),
      ciType,
      limit: options?.limit || 100,
      offset: options?.offset || 0,
    });

    const k8sResources: K8sResource[] = cis.data.map((ci) => ({
      kind: ci.ciType.replace('K8S_', ''),
      apiVersion: 'v1',
      metadata: {
        name: ci.name,
        namespace: ci.attributes?.namespace || 'default',
        uid: ci.id,
        resourceVersion: String(ci.version),
        labels: ci.attributes?.labels || {},
        annotations: ci.attributes?.annotations || {},
      },
      spec: ci.attributes?.spec || {},
      status: ci.attributes?.status || {},
    }));

    return {
      data: k8sResources,
      total: cis.total,
    };
  }

  /**
   * 获取 CI/CD 资源列表
   */
  async listCICDResources(options?: {
    tenantId: bigint;
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ data: CICDResource[]; total: number }> {
    logger.info({ options }, 'Listing CI/CD resources');

    const cis = await this.cmdbService.listCIs({
      tenantId: options?.tenantId || BigInt(0),
      ciType: 'PIPELINE',
      limit: options?.limit || 100,
      offset: options?.offset || 0,
    });

    const cicdResources: CICDResource[] = cis.data.map((ci) => ({
      pipelineId: ci.ciId,
      name: ci.name,
      status: (ci.attributes?.lastRunStatus as any) || 'unknown',
      duration: ci.attributes?.lastRunDuration,
      triggeredBy: ci.attributes?.lastTriggeredBy,
      createdAt: ci.createdAt,
      updatedAt: ci.updatedAt,
    }));

    return {
      data: cicdResources,
      total: cis.total,
    };
  }

  /**
   * 获取拓扑图
   */
  async getTopology(options?: {
    tenantId: bigint;
    ciType?: CiType;
    depth?: number;
  }): Promise<TopologyResponse> {
    logger.info({ options }, 'Getting topology');

    const cis = await this.cmdbService.listCIs({
      tenantId: options?.tenantId || BigInt(0),
      ciType: options?.ciType,
      limit: 1000,
      offset: 0,
    });

    const nodes: TopologyNode[] = cis.data.map((ci) => ({
      id: ci.ciId,
      type: ci.ciType,
      name: ci.name,
      status: ci.status,
      metadata: {
        environment: ci.environment,
        tags: ci.tags,
      },
    }));

    const edges: TopologyEdge[] = [];
    const processedRelations = new Set<string>();

    // 获取每个 CI 的关联关系，并去重
    for (const ci of cis.data) {
      const relations = await this.cmdbService.getCIRelations(ci.ciId);
      for (const relation of relations) {
        // 避免重复处理同一个关系
        if (processedRelations.has(relation.id)) {
          continue;
        }
        processedRelations.add(relation.id);

        edges.push({
          source: relation.fromCiId,
          target: relation.toCiId,
          type: relation.relationType,
          metadata: {
            description: relation.description,
          },
        });
      }
    }

    return { nodes, edges };
  }

  // ==================== K8s 同步 ====================

  /**
   * 启动 K8s 同步（Watch + 定时对账）
   */
  async startK8sSync(
    tenantId: bigint,
    config: K8sSyncConfig
  ): Promise<void> {
    logger.info({ config, tenantId }, 'Starting K8s sync');

    this.tenantId = tenantId;
    this.k8sConfig = config;

    // 初始化 Watch Client
    if (config.watchEnabled) {
      this.k8sWatchClient = new K8sWatchClient({
        apiServerUrl: config.apiServerUrl,
        token: config.token,
        caCert: config.caCert,
        useClusterConfig: config.useClusterConfig,
        namespace: config.namespaces?.join(','),
        reconnect: {
          initialDelayMs: 1000,
          maxDelayMs: 30000,
          maxRetries: 0, // 无限重试
        },
      });

      // 注册资源处理器
      const resourceKinds = config.resourceKinds || ['Deployment', 'Pod'];
      for (const kind of resourceKinds) {
        this.k8sWatchClient.registerHandler(kind, (event) =>
          this.handleWatchEvent(event, kind)
        );
      }

      // 启动 Watch
      await this.k8sWatchClient.start();
    }

    // 初始化对账服务
    this.k8sReconciliationService = new K8sReconciliationService(
      this.cmdbService,
      {
        apiServerUrl: config.apiServerUrl,
        token: config.token,
        caCert: config.caCert,
        useClusterConfig: config.useClusterConfig,
        intervalMs: config.reconciliationIntervalMs,
        namespaces: config.namespaces,
        resourceKinds: config.resourceKinds?.map((k) =>
          k === 'Namespace' ? 'Namespace' : k === 'Deployment' ? 'Deployment' : k === 'Pod' ? 'Pod' : 'Service'
        ) as any,
      }
    );
    this.k8sReconciliationService.setTenantId(tenantId);
    this.k8sReconciliationService.start(tenantId);

    // 启动健康检查定时器
    this.startHealthCheckTimer();

    // 发布同步启动事件
    if (this.eventBus) {
      await this.eventBus.publish(
        'cmdb.k8s.sync.started',
        {
          tenantId: String(tenantId),
          watchEnabled: config.watchEnabled,
          reconciliationIntervalMs: config.reconciliationIntervalMs,
          startedAt: new Date().toISOString(),
        },
        { source: 'cmdb-service' }
      );
    }

    logger.info({ tenantId }, 'K8s sync started');
  }

  /**
   * 停止 K8s 同步
   */
  stopK8sSync(): void {
    logger.info('Stopping K8s sync');

    if (this.k8sWatchClient) {
      this.k8sWatchClient.stop();
      this.k8sWatchClient = null;
    }

    if (this.k8sReconciliationService) {
      this.k8sReconciliationService.stop();
      this.k8sReconciliationService = null;
    }

    if (this.syncHealthCheckTimer) {
      clearInterval(this.syncHealthCheckTimer);
      this.syncHealthCheckTimer = null;
    }

    this.k8sConfig = null;

    logger.info('K8s sync stopped');
  }

  /**
   * 获取 K8s 同步状态
   */
  getK8sSyncState(): K8sSyncState {
    const watchStatus = this.k8sWatchClient?.getStatus() || {
      connected: false,
      reconnectAttempts: 0,
      resourcesWatched: [],
      syncStatus: 'L2_PAUSED' as SyncStatus,
    };

    const reconciliationStatus = {
      lastResult: this.k8sReconciliationService?.getLastResult(),
      isRunning: this.k8sReconciliationService?.isRunningState() || false,
      lastRunAt: this.k8sReconciliationService?.getLastResult()?.endedAt,
    };

    // 计算整体状态和健康分数
    const overallStatus = this.calculateOverallSyncStatus(
      watchStatus.syncStatus,
      reconciliationStatus.lastResult?.status
    );

    const healthScore = this.calculateHealthScore(
      watchStatus,
      reconciliationStatus
    );

    return {
      overallStatus,
      watchStatus,
      reconciliationStatus,
      healthScore,
    };
  }

  /**
   * 计算整体同步状态
   */
  private calculateOverallSyncStatus(
    watchStatus: SyncStatus,
    reconciliationStatus?: 'SUCCESS' | 'PARTIAL' | 'FAILED'
  ): SyncStatus {
    // Watch 状态优先级更高（实时）
    if (watchStatus === 'L3_DEGRADED') {
      return 'L3_DEGRADED';
    }

    if (watchStatus === 'L2_PAUSED') {
      // 如果对账成功，可以维持 L1
      if (reconciliationStatus === 'SUCCESS') {
        return 'L1_REDUCED';
      }
      return 'L2_PAUSED';
    }

    if (watchStatus === 'L1_REDUCED') {
      return 'L1_REDUCED';
    }

    // Watch 正常，检查对账状态
    if (reconciliationStatus === 'FAILED') {
      return 'L1_REDUCED';
    }

    return 'L0_NORMAL';
  }

  /**
   * 计算健康分数（0-100）
   */
  private calculateHealthScore(
    watchStatus: any,
    reconciliationStatus: any
  ): number {
    let score = 100;

    // Watch 连接健康度
    if (!watchStatus.connected) {
      score -= 30;
    }
    if (watchStatus.reconnectAttempts > 0) {
      score -= Math.min(watchStatus.reconnectAttempts * 5, 20);
    }

    // 对账健康度
    if (!reconciliationStatus.isRunning) {
      score -= 20;
    }
    if (reconciliationStatus.lastResult?.status === 'PARTIAL') {
      score -= 10;
    }
    if (reconciliationStatus.lastResult?.status === 'FAILED') {
      score -= 30;
    }
    if (reconciliationStatus.lastResult?.errors?.length > 0) {
      score -= reconciliationStatus.lastResult.errors.length * 2;
    }

    return Math.max(0, score);
  }

  /**
   * 启动健康检查定时器
   */
  private startHealthCheckTimer(): void {
    // 每 30 秒检查一次健康状态
    this.syncHealthCheckTimer = setInterval(() => {
      this.performHealthCheck();
    }, 30000);
  }

  /**
   * 执行健康检查
   */
  private async performHealthCheck(): Promise<void> {
    const state = this.getK8sSyncState();

    logger.info(
      {
        overallStatus: state.overallStatus,
        healthScore: state.healthScore,
        watchConnected: state.watchStatus.connected,
      },
      'K8s sync health check'
    );

    // 状态降级处理
    if (state.overallStatus === 'L3_DEGRADED') {
      // 严重降级，尝试重启
      logger.error('Sync severely degraded, attempting restart');
      if (this.k8sWatchClient) {
        await this.k8sWatchClient.reconnect();
      }
    }

    // 发布健康检查事件
    if (this.eventBus) {
      await this.eventBus.publish(
        'cmdb.k8s.sync.health',
        {
          tenantId: String(this.tenantId),
          overallStatus: state.overallStatus,
          healthScore: state.healthScore,
          watchStatus: state.watchStatus,
          reconciliationStatus: state.reconciliationStatus,
          checkedAt: new Date().toISOString(),
        },
        { source: 'cmdb-service' }
      );
    }
  }

  /**
   * 处理 Watch 事件
   */
  private async handleWatchEvent(
    event: WatchEvent,
    kind: K8sResourceKind
  ): Promise<void> {
    logger.info(
      { type: event.type, kind, name: event.object?.metadata?.name },
      'Received K8s watch event'
    );

    try {
      switch (event.type) {
        case 'ADDED':
          await this.handleResourceAdded(event.object, kind);
          break;
        case 'MODIFIED':
          await this.handleResourceModified(event.object, kind);
          break;
        case 'DELETED':
          await this.handleResourceDeleted(event.object, kind);
          break;
        case 'ERROR':
          logger.error({ event }, 'Watch error event received');
          break;
      }

      // 发布事件
      if (this.eventBus) {
        await this.eventBus.publish(
          `cmdb.k8s.resource.${event.type.toLowerCase()}`,
          {
            tenantId: String(this.tenantId),
            kind,
            name: event.object?.metadata?.name,
            namespace: event.object?.metadata?.namespace,
            uid: event.object?.metadata?.uid,
            resourceVersion: event.object?.metadata?.resourceVersion,
            occurredAt: new Date().toISOString(),
          },
          { source: 'cmdb-service' }
        );
      }
    } catch (err) {
      logger.error({ event, err }, 'Failed to handle watch event');
    }
  }

  /**
   * 处理资源新增
   */
  private async handleResourceAdded(obj: any, kind: K8sResourceKind): Promise<void> {
    const ciId = this.generateCiId(kind, obj.metadata.namespace, obj.metadata.name);

    // 检查是否已存在
    const existing = await this.cmdbService.getCIByCiId(ciId);
    if (existing) {
      logger.debug({ ciId }, 'CI already exists, updating instead');
      await this.handleResourceModified(obj, kind);
      return;
    }

    const ciTypeMap: Record<K8sResourceKind, CiType> = {
      'Namespace': 'K8S_CLUSTER',
      'Deployment': 'K8S_DEPLOYMENT',
      'Pod': 'K8S_POD',
      'Service': 'SERVICE',
      'ConfigMap': 'MIDDLEWARE',
      'Secret': 'MIDDLEWARE',
      'Cluster': 'K8S_CLUSTER',
    };

    const input: CreateCIInput = {
      ciId,
      tenantId: this.tenantId,
      ciType: ciTypeMap[kind] || 'SERVICE',
      name: obj.metadata.name,
      description: `K8s ${kind} synced via Watch`,
      status: 'ACTIVE',
      environment: this.detectEnvironment(obj.metadata.labels),
      tags: this.extractTags(obj.metadata.labels),
      attributes: {
        namespace: obj.metadata.namespace,
        uid: obj.metadata.uid,
        resourceVersion: obj.metadata.resourceVersion,
        labels: obj.metadata.labels,
        annotations: obj.metadata.annotations,
        spec: obj.spec,
        status: obj.status,
        kind,
        syncSource: 'k8s-watch',
        lastSyncAt: new Date().toISOString(),
      },
      createdBy: 'k8s-watch-client',
    };

    await this.cmdbService.createCI(input);
    logger.info({ ciId, kind }, 'Created CI from Watch event');
  }

  /**
   * 处理资源修改
   */
  private async handleResourceModified(obj: any, kind: K8sResourceKind): Promise<void> {
    const ciId = this.generateCiId(kind, obj.metadata.namespace, obj.metadata.name);

    const existing = await this.cmdbService.getCIByCiId(ciId);
    if (!existing) {
      logger.warn({ ciId }, 'CI not found for modification, creating instead');
      await this.handleResourceAdded(obj, kind);
      return;
    }

    // 合并更新：K8s原生属性以K8s为准，CMDB扩展属性保持不变
    const mergedAttributes = {
      ...existing.attributes,
      // K8s 原生属性更新
      resourceVersion: obj.metadata.resourceVersion,
      labels: obj.metadata.labels,
      annotations: obj.metadata.annotations,
      spec: obj.spec,
      status: obj.status,
      lastSyncAt: new Date().toISOString(),
      syncSource: 'k8s-watch',
    };

    await this.cmdbService.updateCI(
      existing.id,
      { attributes: mergedAttributes },
      'k8s-watch-client'
    );

    logger.info({ ciId, kind, resourceVersion: obj.metadata.resourceVersion }, 'Updated CI from Watch event');
  }

  /**
   * 处理资源删除
   */
  private async handleResourceDeleted(obj: any, kind: K8sResourceKind): Promise<void> {
    const ciId = this.generateCiId(kind, obj.metadata.namespace, obj.metadata.name);

    const existing = await this.cmdbService.getCIByCiId(ciId);
    if (!existing) {
      logger.debug({ ciId }, 'CI not found, already deleted');
      return;
    }

    // 软删除
    await this.cmdbService.updateCI(
      existing.id,
      {
        status: 'DECOMMISSIONED',
        attributes: {
          ...existing.attributes,
          deletedFromK8s: true,
          deletedAt: new Date().toISOString(),
        },
      },
      'k8s-watch-client'
    );

    logger.info({ ciId, kind }, 'Marked CI as decommissioned from Watch event');
  }

  /**
   * 生成 CI ID
   */
  private generateCiId(kind: string, namespace: string, name: string): string {
    return `k8s-${kind.toLowerCase()}-${namespace}-${name}`;
  }

  /**
   * 根据 labels 推断环境
   */
  private detectEnvironment(labels: Record<string, string>): string {
    const envLabels = ['env', 'environment', 'stage'];
    for (const label of envLabels) {
      if (labels?.[label]) {
        return labels[label];
      }
    }
    return 'unknown';
  }

  /**
   * 从 labels 提取 tags
   */
  private extractTags(labels: Record<string, string>): string[] {
    if (!labels) return [];
    const tagLabels = ['app', 'component', 'tier', 'team', 'version'];
    const tags: string[] = [];

    for (const label of tagLabels) {
      if (labels[label]) {
        tags.push(`${label}:${labels[label]}`);
      }
    }

    return tags;
  }

  // ==================== 脚本执行 ====================

  /**
   * 执行脚本
   */
  async executeScript(
    request: ScriptExecutionRequest
  ): Promise<ScriptExecutionResult[]> {
    logger.info({ request }, 'Executing script');

    const results: ScriptExecutionResult[] = [];

    for (const ciId of request.targetCiIds) {
      try {
        const result = await this.executeScriptOnCI(
          ciId,
          request.script,
          request.scriptType,
          request.timeout || 30000,
          request.parameters
        );
        results.push(result);
      } catch (err) {
        logger.error({ ciId, err }, 'Script execution failed');
        results.push({
          executionId: crypto.randomUUID(),
          ciId,
          status: 'failed',
          stderr: err instanceof Error ? err.message : String(err),
          executedAt: new Date(),
        });
      }
    }

    // 发布脚本执行完成事件
    if (this.eventBus) {
      for (const result of results) {
        await this.eventBus.publish(
          'cmdb.script.executed',
          result,
          { source: 'cmdb-service' }
        );
      }
    }

    return results;
  }

  /**
   * 在单个 CI 上执行脚本（真实 SSH 执行）
   */
  private async executeScriptOnCI(
    ciId: string,
    script: string,
    scriptType: 'bash' | 'python' | 'powershell',
    timeout: number,
    parameters?: Record<string, string>
  ): Promise<ScriptExecutionResult> {
    const executionId = crypto.randomUUID();
    const startTime = Date.now();

    logger.info(
      { executionId, ciId, scriptType, timeout },
      'Executing script on CI via SSH'
    );

    // 获取目标主机信息
    const ci = await this.cmdbService.getCIByCiId(ciId);
    if (!ci) {
      throw new OrionError(ErrorCode.NOT_FOUND, `CI ${ciId} not found`);
    }

    const host = ci.attributes?.ip || ci.attributes?.hostname;
    if (!host) {
      throw new Error(`CI ${ciId} has no IP or hostname for SSH connection`);
    }

    // 替换脚本中的参数
    let processedScript = script;
    if (parameters) {
      for (const [key, value] of Object.entries(parameters)) {
        processedScript = processedScript.replace(
          new RegExp(`\\$\\{${key}\\}`, 'g'),
          value
        );
      }
    }

    // 构建执行命令：通过 heredoc 安全传递脚本内容
    const scriptCommand = this.buildScriptCommand(processedScript, scriptType);

    // 构建 SSH 配置
    const sshConfig = this.buildSSHConfig(ci);
    if (!sshConfig) {
      throw new Error(`CI ${ciId} has no SSH credentials configured`);
    }

    // 执行 SSH 命令
    return this.executeSSHCommand(sshConfig, scriptCommand, timeout, executionId, ciId, startTime);
  }

  /**
   * 通过 heredoc 安全地传递脚本内容，防止命令注入
   * 脚本通过 stdin 传输，避免 shell 解析注入
   */
  private buildScriptCommand(script: string, scriptType: 'bash' | 'python' | 'powershell'): string {
    // 使用 heredoc 标记为随机字符串，降低冲突概率
    const heredoc = 'SCRIPT_EOF_' + crypto.randomUUID().replace(/-/g, '').substring(0, 8);

    switch (scriptType) {
      case 'bash':
        return `bash << '${heredoc}'\n${script}\n${heredoc}`;
      case 'python':
        return `python3 << '${heredoc}'\n${script}\n${heredoc}`;
      case 'powershell':
        return `pwsh -Command - << '${heredoc}'\n${script}\n${heredoc}`;
      default:
        return `bash << '${heredoc}'\n${script}\n${heredoc}`;
    }
  }

  /**
   * 从 CI 属性中构建 SSH 配置
   */
  private buildSSHConfig(ci: CI): ConnectConfig | null {
    const attrs = ci.attributes || {};
    const username = attrs.ssh_user || attrs.username || 'root';
    const password = attrs.ssh_password || attrs.password;
    const privateKey = attrs.ssh_private_key || attrs.private_key;
    const port = parseInt(attrs.ssh_port || attrs.port) || 22;

    if (!password && !privateKey) {
      return null;
    }

    const config: ConnectConfig = {
      host: attrs.ip || attrs.hostname,
      port,
      username,
      readyTimeout: 10000,
    };

    if (privateKey) {
      config.privateKey = privateKey;
      if (attrs.ssh_passphrase) {
        config.passphrase = attrs.ssh_passphrase;
      }
    } else if (password) {
      config.password = password;
    }

    return config;
  }

  /**
   * 通过 SSH 执行远程命令
   */
  private executeSSHCommand(
    sshConfig: ConnectConfig,
    command: string,
    timeout: number,
    executionId: string,
    ciId: string,
    startTime: number
  ): Promise<ScriptExecutionResult> {
    return new Promise((resolve) => {
      const conn = new SSHClient();
      let settled = false;

      const settle = (result: ScriptExecutionResult) => {
        if (!settled) {
          settled = true;
          conn.end();
          resolve(result);
        }
      };

      const timeoutTimer = setTimeout(() => {
        settle({
          executionId,
          ciId,
          status: 'timeout',
          stderr: `Command timed out after ${timeout}ms`,
          exitCode: -1,
          duration: Date.now() - startTime,
          executedAt: new Date(),
        });
      }, timeout);

      conn.on('error', (err: Error) => {
        clearTimeout(timeoutTimer);
        settle({
          executionId,
          ciId,
          status: 'failed',
          stderr: `SSH connection error: ${err.message}`,
          exitCode: -1,
          duration: Date.now() - startTime,
          executedAt: new Date(),
        });
      });

      conn.connect(sshConfig);

      conn.on('ready', () => {
        conn.exec(command, (err: Error | undefined, stream: any) => {
          if (err) {
            clearTimeout(timeoutTimer);
            settle({
              executionId,
              ciId,
              status: 'failed',
              stderr: `SSH exec error: ${err.message}`,
              exitCode: -1,
              duration: Date.now() - startTime,
              executedAt: new Date(),
            });
            return;
          }

          let stdoutBuf = '';
          let stderrBuf = '';

          stream.on('close', (code: number) => {
            clearTimeout(timeoutTimer);
            settle({
              executionId,
              ciId,
              status: code === 0 ? 'success' : 'failed',
              stdout: stdoutBuf || undefined,
              stderr: stderrBuf || undefined,
              exitCode: code,
              duration: Date.now() - startTime,
              executedAt: new Date(),
            });
          });

          stream.on('data', (data: Buffer) => {
            stdoutBuf += data.toString();
          });

          stream.stderr.on('data', (data: Buffer) => {
            stderrBuf += data.toString();
          });
        });
      });
    });
  }
}