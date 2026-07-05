/**
 * DependencyCoordinationService - Pipeline依赖协调服务
 *
 * 管理pipeline之间的依赖关系，支持:
 * - 注册/注销pipeline依赖
 * - 解析依赖是否已满足
 * - 构建依赖图
 * - 检测循环依赖
 * - 获取拓扑排序顺序
 *
 * PostgreSQL is the primary data source. In-memory Map acts as a read-through
 * cache for hot-path graph operations. All mutations are persisted to the DB
 * first, then reflected in the cache.
 */

import { PipelineDependencyRepository } from '../../repositories/PipelineDependencyRepository';
import { createLogger } from '../../utils/logger';
import { getCurrentTraceId } from '../../db/tenant-context-storage';

const logger = createLogger('dependency-coordination-service');

export interface PipelineDependency {
  pipelineId: string;
  dependsOn: string[];
  requiredInputs: Record<string, unknown>;
  blockingStatus: ('success' | 'failed' | 'any')[];
}

export interface DependencyResolution {
  resolved: boolean;
  pipelineId: string;
  blockedBy: string[];
  readyAt?: Date;
  error?: string;
}

export interface DependencyGraph {
  nodes: string[];
  edges: { from: string; to: string }[];
}

export interface PipelineResult {
  status: string;
  outputs: Record<string, unknown>;
}

export class DependencyCoordinationService {
  private repository: PipelineDependencyRepository;
  // Read-through cache for hot-path graph operations
  private dependencies: Map<string, PipelineDependency> = new Map();

  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    this.repository = new PipelineDependencyRepository(db);
  }

  /**
   * 注册pipeline依赖关系
   * DB is the primary store; cache is updated on success.
   */
  async registerDependency(
    pipelineId: string,
    dependsOn: string[],
    requiredInputs?: Record<string, unknown>,
    blockingStatus?: ('success' | 'failed' | 'any')[]
  ): Promise<void> {
    const dep: PipelineDependency = {
      pipelineId,
      dependsOn,
      requiredInputs: requiredInputs || {},
      blockingStatus: blockingStatus || ['success'],
    };

    // Persist to database first (primary store)
    await this.repository.upsertDependency(
      pipelineId,
      dependsOn,
      'sequential',
      'default'
    );

    // Update cache after successful persistence
    this.dependencies.set(pipelineId, dep);
  }

  /**
   * 注销pipeline依赖关系
   * Deletes from DB first, then removes from cache.
   */
  async unregisterDependency(pipelineId: string): Promise<boolean> {
    await this.repository.deleteByPipelineId(pipelineId);
    return this.dependencies.delete(pipelineId);
  }

  /**
   * 获取指定pipeline的依赖信息
   * Read-through: cache first, DB fallback, cache result.
   */
  async getDependency(pipelineId: string): Promise<PipelineDependency | undefined> {
    // Try cache first
    const cached = this.dependencies.get(pipelineId);
    if (cached) return cached;

    // Fallback to database
    const entity = await this.repository.findByPipelineId(pipelineId);
    if (entity) {
      const dep: PipelineDependency = {
        pipelineId: entity.pipelineId,
        dependsOn: entity.dependsOn,
        requiredInputs: {},
        blockingStatus: ['success'],
      };
      // Populate cache
      this.dependencies.set(pipelineId, dep);
      return dep;
    }

    return undefined;
  }

  /**
   * 获取所有已注册的依赖
   * Loads from DB (source of truth) and refreshes cache.
   */
  async getAllDependencies(): Promise<PipelineDependency[]> {
    try {
      const entities = await this.repository.findByTenantId('default');
      // Refresh cache from DB
      this.dependencies.clear();
      for (const entity of entities) {
        this.dependencies.set(entity.pipelineId, {
          pipelineId: entity.pipelineId,
          dependsOn: entity.dependsOn,
          requiredInputs: {},
          blockingStatus: ['success'],
        });
      }
    } catch (err) {
      logger.warn({ traceId: getCurrentTraceId(), err }, 'Failed to load dependencies from database, using cache');
    }
    return Array.from(this.dependencies.values());
  }

  /**
   * 解析依赖是否已满足
   * Uses getDependency for DB-backed lookup.
   */
  async resolveDependencies(
    pipelineId: string,
    pipelineResults: Map<string, PipelineResult>
  ): Promise<DependencyResolution> {
    const dep = await this.getDependency(pipelineId);

    // 没有依赖关系，视为已满足
    if (!dep) {
      return { resolved: true, pipelineId, blockedBy: [], readyAt: new Date() };
    }

    // 没有依赖其他pipeline，视为已满足
    if (dep.dependsOn.length === 0) {
      return { resolved: true, pipelineId, blockedBy: [], readyAt: new Date() };
    }

    const blockedBy: string[] = [];

    for (const parentId of dep.dependsOn) {
      const result = pipelineResults.get(parentId);

      // 父pipeline尚未运行，视为阻塞
      if (!result) {
        blockedBy.push(parentId);
        continue;
      }

      // blockingStatus 定义了"不阻塞"的状态（即可以继续执行的状态）
      // 默认 ['success'] 表示只有父pipeline成功时才不阻塞
      // 特殊值 'any' 表示任何状态都不阻塞
      const isUnblocking = dep.blockingStatus.includes('any') ||
        dep.blockingStatus.includes(result.status as 'success' | 'failed' | 'any');

      if (!isUnblocking) {
        blockedBy.push(parentId);
      }
    }

    return {
      resolved: blockedBy.length === 0,
      pipelineId,
      blockedBy,
      readyAt: blockedBy.length === 0 ? new Date() : undefined,
    };
  }

  /**
   * 获取依赖图
   * Loads all dependencies from DB first, then builds graph.
   */
  async getDependencyGraph(): Promise<DependencyGraph> {
    await this.ensureCacheLoaded();

    const nodes = new Set<string>();
    const edges: { from: string; to: string }[] = [];

    for (const [pipelineId, dep] of this.dependencies) {
      nodes.add(pipelineId);
      for (const parentId of dep.dependsOn) {
        nodes.add(parentId);
        edges.push({ from: parentId, to: pipelineId });
      }
    }

    return { nodes: Array.from(nodes), edges };
  }

  /**
   * 检测循环依赖
   * Loads all dependencies from DB first, then runs DFS.
   */
  async findCycles(): Promise<string[][]> {
    await this.ensureCacheLoaded();

    const cycles: string[][] = [];
    const visited = new Set<string>();
    const recStack = new Set<string>();

    const dfs = (node: string, path: string[]): void => {
      visited.add(node);
      recStack.add(node);

      const dep = this.dependencies.get(node);
      if (dep) {
        for (const parentId of dep.dependsOn) {
          if (!visited.has(parentId)) {
            dfs(parentId, [...path, parentId]);
          } else if (recStack.has(parentId)) {
            const startIdx = path.indexOf(parentId);
            if (startIdx >= 0) {
              cycles.push([...path.slice(startIdx), parentId]);
            } else {
              cycles.push([parentId]);
            }
          }
        }
      }

      recStack.delete(node);
    };

    for (const [pipelineId] of this.dependencies) {
      if (!visited.has(pipelineId)) {
        dfs(pipelineId, [pipelineId]);
      }
    }

    return cycles;
  }

  /**
   * 获取拓扑排序的执行顺序
   * Loads all dependencies from DB first, then computes topological order.
   */
  async getTopologicalOrder(): Promise<string[]> {
    await this.ensureCacheLoaded();

    const inDegree = new Map<string, number>();
    const graph = new Map<string, string[]>();

    // 初始化所有节点的入度为0
    for (const [pipelineId, dep] of this.dependencies) {
      inDegree.set(pipelineId, 0);
      // 同时添加所有依赖的父节点
      for (const parentId of dep.dependsOn) {
        if (!inDegree.has(parentId)) {
          inDegree.set(parentId, 0);
        }
      }
    }

    // 重新遍历，计算真正的入度
    // 边是: parentId -> pipelineId (父节点执行完后，子节点才能执行)
    for (const [pipelineId, dep] of this.dependencies) {
      for (const parentId of dep.dependsOn) {
        // 当前节点的入度加1（因为有一个父节点指向它）
        const currentDegree = inDegree.get(pipelineId) || 0;
        inDegree.set(pipelineId, currentDegree + 1);

        // 构建邻接表: 父节点 -> 子节点列表
        if (!graph.has(parentId)) {
          graph.set(parentId, []);
        }
        graph.get(parentId)!.push(pipelineId);
      }
    }

    const queue: string[] = [];
    const result: string[] = [];

    // 将所有入度为0的节点加入队列
    for (const [node, degree] of inDegree) {
      if (degree === 0) {
        queue.push(node);
      }
    }

    // 处理队列
    while (queue.length > 0) {
      const node = queue.shift()!;
      result.push(node);

      const children = graph.get(node) || [];
      for (const child of children) {
        const newDegree = (inDegree.get(child) || 0) - 1;
        inDegree.set(child, newDegree);
        if (newDegree === 0) {
          queue.push(child);
        }
      }
    }

    return result;
  }

  /**
   * 批量解析多个pipeline的依赖状态
   * Loads all dependencies from DB first.
   */
  async resolveAllDependencies(
    pipelineResults: Map<string, PipelineResult>
  ): Promise<Map<string, DependencyResolution>> {
    await this.ensureCacheLoaded();

    const results = new Map<string, DependencyResolution>();

    for (const [pipelineId] of this.dependencies) {
      const resolution = await this.resolveDependencies(pipelineId, pipelineResults);
      results.set(pipelineId, resolution);
    }

    return results;
  }

  /**
   * 清除所有依赖关系
   * Clears both DB (via repository) and cache.
   */
  async clearAllDependencies(): Promise<void> {
    // Delete all from DB for the default tenant
    const entities = await this.repository.findByTenantId('default');
    for (const entity of entities) {
      await this.repository.deleteByPipelineId(entity.pipelineId);
    }
    this.dependencies.clear();
  }

  /**
   * Ensure cache is populated from DB.
   * Called by graph-operation methods to guarantee complete data.
   */
  private async ensureCacheLoaded(): Promise<void> {
    if (this.dependencies.size === 0) {
      try {
        const entities = await this.repository.findByTenantId('default');
        for (const entity of entities) {
          this.dependencies.set(entity.pipelineId, {
            pipelineId: entity.pipelineId,
            dependsOn: entity.dependsOn,
            requiredInputs: {},
            blockingStatus: ['success'],
          });
        }
      } catch (err) {
        logger.warn({ traceId: getCurrentTraceId(), err }, 'Failed to load dependencies from database');
      }
    }
  }
}