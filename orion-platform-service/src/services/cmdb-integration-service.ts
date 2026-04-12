/**
 * CMDB 集成服务
 *
 * 提供主机/K8s/CI-CD/拓扑的 Read API
 * 支持 K8s 同步双机制（Watch + 定时对账）
 * 脚本执行能力
 */

import pino from 'pino';
import { EventBusService } from './event-bus-service';
import { CmdbService } from './cmdb/CmdbService';
import type { CI, CiType, CreateCIInput } from './cmdb/CmdbTypes';

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
  apiServerUrl: string;
  token: string;
  caCert?: string;
  watchEnabled: boolean;
  reconciliationIntervalMs: number; // 对账间隔（默认 5 分钟）
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
  private k8sWatchAbortController: AbortController | null = null;
  private reconciliationTimer: NodeJS.Timeout | null = null;
  private k8sConfig: K8sSyncConfig | null = null;

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
    logger.info({ config }, 'Starting K8s sync');

    this.k8sConfig = config;

    // 立即执行一次全量同步
    await this.fullReconciliation(tenantId);

    // 启动 Watch
    if (config.watchEnabled) {
      this.startK8sWatch(tenantId, config).catch((err) => {
        logger.error({ err }, 'K8s watch failed');
      });
    }

    // 启动定时对账
    this.startReconciliationTimer(tenantId, config.reconciliationIntervalMs);
  }

  /**
   * 停止 K8s 同步
   */
  stopK8sSync(): void {
    logger.info('Stopping K8s sync');

    if (this.k8sWatchAbortController) {
      this.k8sWatchAbortController.abort();
      this.k8sWatchAbortController = null;
    }

    if (this.reconciliationTimer) {
      clearInterval(this.reconciliationTimer);
      this.reconciliationTimer = null;
    }

    this.k8sConfig = null;
  }

  /**
   * 启动 K8s Watch
   */
  private async startK8sWatch(
    tenantId: bigint,
    config: K8sSyncConfig
  ): Promise<void> {
    logger.info({ tenantId }, 'Starting K8s watch');

    this.k8sWatchAbortController = new AbortController();

    // 实际场景中，这里会连接 K8s API Server 的 Watch 端点
    // 由于是模拟实现，我们仅记录日志
    logger.info(
      { url: config.apiServerUrl },
      'K8s Watch connected (simulated)'
    );

    // 模拟接收 Watch 事件
    // 实际实现中需要通过 https + token 连接 K8s API Server
  }

  /**
   * 启动定时对账
   */
  private startReconciliationTimer(
    tenantId: bigint,
    intervalMs: number
  ): void {
    logger.info({ intervalMs }, 'Starting reconciliation timer');

    this.reconciliationTimer = setInterval(async () => {
      try {
        await this.fullReconciliation(tenantId);
      } catch (err) {
        logger.error({ err }, 'Reconciliation failed');
      }
    }, intervalMs);
  }

  /**
   * 全量对账
   */
  private async fullReconciliation(tenantId: bigint): Promise<void> {
    logger.info({ tenantId }, 'Running full reconciliation');

    // 实际场景中：
    // 1. 从 K8s API Server 获取当前资源列表
    // 2. 与 CMDB 中的资源对比
    // 3. 创建/更新/删除 CI

    // 发布对账完成事件
    if (this.eventBus) {
      await this.eventBus.publish(
        'cmdb.k8s.reconciliation.completed',
        {
          tenantId: String(tenantId),
          reconciledAt: new Date().toISOString(),
        },
        { source: 'cmdb-service' }
      );
    }

    logger.info({ tenantId }, 'Reconciliation completed');
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
   * 在单个 CI 上执行脚本
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
      'Executing script on CI'
    );

    // 实际场景中，这里会通过 SSH/WinRM/Agent 执行脚本
    // 由于是模拟实现，我们返回一个模拟结果

    // 替换参数
    let processedScript = script;
    if (parameters) {
      for (const [key, value] of Object.entries(parameters)) {
        processedScript = processedScript.replace(
          new RegExp(`\\$\\{${key}\\}`, 'g'),
          value
        );
      }
    }

    // 模拟执行结果
    const result: ScriptExecutionResult = {
      executionId,
      ciId,
      status: 'success',
      stdout: `Script executed successfully on ${ciId}\nOutput: ${processedScript.substring(0, 100)}...`,
      stderr: undefined,
      exitCode: 0,
      duration: Date.now() - startTime,
      executedAt: new Date(),
    };

    logger.info({ result }, 'Script execution completed');

    return result;
  }
}
