/**
 * MySQL 读流量管理器
 *
 * 功能：
 * 1. 主从流量分配
 * 2. 读请求路由策略
 * 3. 延迟降级触发
 */

import { EventEmitter } from 'events';
import { DegradationLevel } from './ReplicationLagMonitor';

/**
 * 数据库节点类型
 */
export enum NodeType {
  PRIMARY = 'primary',
  REPLICA = 'replica',
}

/**
 * 数据库节点配置
 */
export interface DatabaseNode {
  id: string;
  type: NodeType;
  host: string;
  port: number;
  weight: number;        // 权重 0-100
  healthy: boolean;
  lastCheckTime?: Date;
  avgLatency?: number;   // 平均延迟（毫秒）
  connectionCount?: number;
}

/**
 * 流量分配配置
 */
export interface TrafficDistribution {
  primaryPercent: number;   // 主库流量百分比
  replicaPercent: number;   // 从库流量百分比
  degradationLevel: DegradationLevel;
  reason: string;
  updatedAt: Date;
}

/**
 * 路由策略
 */
export enum RoutingStrategy {
  ROUND_ROBIN = 'round_robin',           // 轮询
  WEIGHTED = 'weighted',                  // 加权
  LEAST_CONNECTIONS = 'least_connections', // 最少连接
  RANDOM = 'random',                     // 随机
  PRIMARY_ONLY = 'primary_only',         // 仅主库
  REPLICA_PREFERRED = 'replica_preferred', // 优先从库
}

/**
 * 读请求上下文
 */
export interface ReadRequestContext {
  queryType: 'select' | 'analyze' | 'count' | 'other';
  priority: 'high' | 'normal' | 'low';
  tenantId?: string;
  userId?: string;
  traceId?: string;
  canUseStaleData?: boolean;
  maxStaleness?: number; // 可接受的延迟秒数
}

/**
 * 路由决策
 */
export interface RoutingDecision {
  targetNode: DatabaseNode;
  strategy: RoutingStrategy;
  reason: string;
  degradationLevel: DegradationLevel;
  skippedReplicas: string[];
}

/**
 * 读流量管理器配置
 */
export interface ReadTrafficManagerConfig {
  /** 主库节点 */
  primaryNode: DatabaseNode;
  /** 从库节点列表 */
  replicaNodes: DatabaseNode[];
  /** 默认路由策略 */
  defaultStrategy: RoutingStrategy;
  /** 是否启用自动降级 */
  enableAutoDegradation: boolean;
  /** 恢复检查间隔（毫秒） */
  recoveryCheckInterval: number;
  /** 自动恢复所需的连续健康检查次数 */
  recoveryThreshold: number;
  /** 分析查询在降级时的处理方式 */
  analyzeQueryDegradationMode: 'reject' | 'primary_only' | 'delay';
}

const DEFAULT_CONFIG: Partial<ReadTrafficManagerConfig> = {
  defaultStrategy: RoutingStrategy.WEIGHTED,
  enableAutoDegradation: true,
  recoveryCheckInterval: 10000,
  recoveryThreshold: 3,
  analyzeQueryDegradationMode: 'primary_only',
};

/**
 * 读流量管理器
 */
export class ReadTrafficManager extends EventEmitter {
  private config: ReadTrafficManagerConfig;
  private currentDistribution: TrafficDistribution;
  private currentNodeIndex: number = 0;
  private healthCheckCounts: Map<string, number> = new Map();
  private lastRoutingTime: Map<string, Date> = new Map();

  constructor(config: Partial<ReadTrafficManagerConfig> & { primaryNode: DatabaseNode }) {
    super();
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
    } as ReadTrafficManagerConfig;

    // 初始化默认流量分配
    this.currentDistribution = this.calculateDistribution(DegradationLevel.LEVEL_0);
  }

  /**
   * 设置降级级别
   */
  setDegradationLevel(level: DegradationLevel, reason: string = ''): TrafficDistribution {
    const previousLevel = this.currentDistribution.degradationLevel;

    this.currentDistribution = this.calculateDistribution(level);
    this.currentDistribution.reason = reason;
    this.currentDistribution.updatedAt = new Date();

    // 发出级别变更事件
    if (previousLevel !== level) {
      this.emit('degradation-change', {
        previousLevel,
        newLevel: level,
        distribution: this.currentDistribution,
      });
    }

    return this.currentDistribution;
  }

  /**
   * 获取当前流量分配
   */
  getCurrentDistribution(): TrafficDistribution {
    return { ...this.currentDistribution };
  }

  /**
   * 为读请求选择目标节点
   */
  selectNode(context: ReadRequestContext): RoutingDecision {
    const level = this.currentDistribution.degradationLevel;
    const skippedReplicas: string[] = [];
    let reason = '';
    let targetNode: DatabaseNode;
    let strategy = this.config.defaultStrategy;

    // 先检查高优先级请求
    if (context.priority === 'high' || context.canUseStaleData === false) {
      targetNode = this.config.primaryNode;
      strategy = RoutingStrategy.PRIMARY_ONLY;
      reason = `High priority request routed to primary`;
      this.lastRoutingTime.set(targetNode.id, new Date());
      return {
        targetNode,
        strategy,
        reason,
        degradationLevel: level,
        skippedReplicas,
      };
    }

    // 根据降级级别和请求类型决策
    switch (level) {
      case DegradationLevel.LEVEL_0:
        // 正常模式
        targetNode = this.selectNodeNormal(context, strategy);
        reason = 'Normal operation';
        break;

      case DegradationLevel.LEVEL_1:
        // L1: 暂停从库分析查询
        if (context.queryType === 'analyze') {
          targetNode = this.config.primaryNode;
          reason = 'L1 degradation: analysis queries routed to primary';
          strategy = RoutingStrategy.PRIMARY_ONLY;
        } else {
          targetNode = this.selectNodeNormal(context, strategy);
          reason = 'L1 degradation: normal queries use standard routing';
        }
        break;

      case DegradationLevel.LEVEL_2:
        // L2: 从库读请求降至20%
        if (this.shouldUseReplica(0.2)) {
          const replica = this.selectReplica();
          if (replica && replica.healthy) {
            targetNode = replica;
            reason = 'L2 degradation: 20% traffic to replica';
          } else {
            targetNode = this.config.primaryNode;
            reason = 'L2 degradation: no healthy replica, using primary';
            if (replica) {
              skippedReplicas.push(replica.id);
            }
          }
        } else {
          targetNode = this.config.primaryNode;
          reason = 'L2 degradation: 80% traffic to primary';
        }
        break;

      case DegradationLevel.LEVEL_3:
        // L3: 从库读请求100%切断
        targetNode = this.config.primaryNode;
        reason = 'L3 degradation: all traffic to primary';
        strategy = RoutingStrategy.PRIMARY_ONLY;
        // 标记所有从库为跳过
        for (const replica of this.config.replicaNodes) {
          skippedReplicas.push(replica.id);
        }
        break;

      default:
        targetNode = this.config.primaryNode;
        reason = 'Unknown degradation level, using primary';
    }

    // 记录路由时间
    this.lastRoutingTime.set(targetNode.id, new Date());

    return {
      targetNode,
      strategy,
      reason,
      degradationLevel: level,
      skippedReplicas,
    };
  }

  /**
   * 更新节点健康状态
   */
  updateNodeHealth(nodeId: string, healthy: boolean, latency?: number): void {
    // 查找节点
    let node: DatabaseNode | undefined;
    if (this.config.primaryNode.id === nodeId) {
      node = this.config.primaryNode;
    } else {
      node = this.config.replicaNodes.find((n) => n.id === nodeId);
    }

    if (!node) {
      return;
    }

    const wasHealthy = node.healthy;
    node.healthy = healthy;
    node.lastCheckTime = new Date();
    if (latency !== undefined) {
      node.avgLatency = latency;
    }

    // 健康状态变化时发出事件
    if (wasHealthy !== healthy) {
      this.emit('node-health-change', {
        nodeId,
        healthy,
        previousHealthy: wasHealthy,
      });
    }

    // 更新健康检查计数
    if (healthy) {
      // 节点健康时增加计数（无论是状态变化还是持续健康）
      const count = (this.healthCheckCounts.get(nodeId) || 0) + 1;
      this.healthCheckCounts.set(nodeId, count);
    } else {
      // 节点不健康时重置计数
      this.healthCheckCounts.set(nodeId, 0);
    }
  }

  /**
   * 获取所有节点状态
   */
  getNodesStatus(): { primary: DatabaseNode; replicas: DatabaseNode[] } {
    return {
      primary: { ...this.config.primaryNode },
      replicas: this.config.replicaNodes.map((n) => ({ ...n })),
    };
  }

  /**
   * 获取路由统计
   */
  getRoutingStats(): {
    totalReplicas: number;
    healthyReplicas: number;
    currentDistribution: TrafficDistribution;
    lastRoutingTimes: Map<string, Date>;
  } {
    const healthyReplicas = this.config.replicaNodes.filter((n) => n.healthy).length;
    return {
      totalReplicas: this.config.replicaNodes.length,
      healthyReplicas,
      currentDistribution: this.currentDistribution,
      lastRoutingTimes: new Map(this.lastRoutingTime),
    };
  }

  /**
   * 检查是否可以从降级中恢复
   */
  canRecoverFromDegradation(currentLevel: DegradationLevel, replicaLag: number): boolean {
    if (currentLevel === DegradationLevel.LEVEL_0) {
      return false;
    }

    // 检查所有从库是否健康
    const allReplicasHealthy = this.config.replicaNodes.every((n) => n.healthy);
    if (!allReplicasHealthy) {
      return false;
    }

    // 检查连续健康检查次数
    for (const replica of this.config.replicaNodes) {
      const count = this.healthCheckCounts.get(replica.id) || 0;
      if (count < this.config.recoveryThreshold) {
        return false;
      }
    }

    // 检查延迟是否满足恢复条件
    const recoveryThresholds = {
      [DegradationLevel.LEVEL_1]: 5,   // 降到5秒以下可从L1恢复
      [DegradationLevel.LEVEL_2]: 10,  // 降到10秒以下可从L2恢复
      [DegradationLevel.LEVEL_3]: 15,   // 降到15秒以下可从L3恢复
    };

    return replicaLag < recoveryThresholds[currentLevel];
  }

  /**
   * 重置状态
   */
  reset(): void {
    this.currentDistribution = this.calculateDistribution(DegradationLevel.LEVEL_0);
    this.currentNodeIndex = 0;
    this.healthCheckCounts.clear();
    this.lastRoutingTime.clear();
    this.emit('reset');
  }

  /**
   * 计算流量分配
   */
  private calculateDistribution(level: DegradationLevel): TrafficDistribution {
    switch (level) {
      case DegradationLevel.LEVEL_0:
        return {
          primaryPercent: 20,
          replicaPercent: 80,
          degradationLevel: level,
          reason: 'Normal operation',
          updatedAt: new Date(),
        };
      case DegradationLevel.LEVEL_1:
        return {
          primaryPercent: 30,
          replicaPercent: 70,
          degradationLevel: level,
          reason: 'L1: Analysis queries paused on replicas',
          updatedAt: new Date(),
        };
      case DegradationLevel.LEVEL_2:
        return {
          primaryPercent: 80,
          replicaPercent: 20,
          degradationLevel: level,
          reason: 'L2: Replica traffic reduced to 20%',
          updatedAt: new Date(),
        };
      case DegradationLevel.LEVEL_3:
        return {
          primaryPercent: 100,
          replicaPercent: 0,
          degradationLevel: level,
          reason: 'L3: All replica traffic cut off',
          updatedAt: new Date(),
        };
      default:
        return {
          primaryPercent: 100,
          replicaPercent: 0,
          degradationLevel: level,
          reason: 'Unknown level, using primary only',
          updatedAt: new Date(),
        };
    }
  }

  /**
   * 正常模式下的节点选择
   */
  private selectNodeNormal(context: ReadRequestContext, strategy: RoutingStrategy): DatabaseNode {
    // 高优先级请求或者需要最新数据的请求，使用主库
    if (context.priority === 'high' || context.canUseStaleData === false) {
      return this.config.primaryNode;
    }

    // 可以使用从库
    if (context.canUseStaleData || context.queryType === 'analyze' || context.queryType === 'count') {
      const replica = this.selectReplica();
      if (replica && replica.healthy) {
        return replica;
      }
    }

    // 根据策略选择
    switch (strategy) {
      case RoutingStrategy.ROUND_ROBIN:
        return this.selectNodeRoundRobin();
      case RoutingStrategy.WEIGHTED:
        return this.selectNodeWeighted();
      case RoutingStrategy.LEAST_CONNECTIONS:
        return this.selectNodeLeastConnections();
      case RoutingStrategy.RANDOM:
        return this.selectNodeRandom();
      case RoutingStrategy.REPLICA_PREFERRED:
        const replica = this.selectReplica();
        return replica && replica.healthy ? replica : this.config.primaryNode;
      default:
        return this.selectNodeWeighted();
    }
  }

  /**
   * 轮询选择节点
   */
  private selectNodeRoundRobin(): DatabaseNode {
    const allNodes = [this.config.primaryNode, ...this.config.replicaNodes.filter((n) => n.healthy)];
    if (allNodes.length === 0) {
      return this.config.primaryNode;
    }
    const node = allNodes[this.currentNodeIndex % allNodes.length];
    this.currentNodeIndex++;
    return node;
  }

  /**
   * 加权选择节点
   */
  private selectNodeWeighted(): DatabaseNode {
    const allNodes = [this.config.primaryNode, ...this.config.replicaNodes].filter((n) => n.healthy);
    if (allNodes.length === 0) {
      return this.config.primaryNode;
    }

    const totalWeight = allNodes.reduce((sum, n) => sum + n.weight, 0);
    let random = Math.random() * totalWeight;

    for (const node of allNodes) {
      random -= node.weight;
      if (random <= 0) {
        return node;
      }
    }

    return allNodes[0];
  }

  /**
   * 最少连接选择节点
   */
  private selectNodeLeastConnections(): DatabaseNode {
    const allNodes = [this.config.primaryNode, ...this.config.replicaNodes].filter((n) => n.healthy);
    if (allNodes.length === 0) {
      return this.config.primaryNode;
    }

    return allNodes.reduce((min, node) => {
      const minConns = min.connectionCount || 0;
      const nodeConns = node.connectionCount || 0;
      return nodeConns < minConns ? node : min;
    }, allNodes[0]);
  }

  /**
   * 随机选择节点
   */
  private selectNodeRandom(): DatabaseNode {
    const allNodes = [this.config.primaryNode, ...this.config.replicaNodes].filter((n) => n.healthy);
    if (allNodes.length === 0) {
      return this.config.primaryNode;
    }
    return allNodes[Math.floor(Math.random() * allNodes.length)];
  }

  /**
   * 选择从库节点
   */
  private selectReplica(): DatabaseNode | undefined {
    const healthyReplicas = this.config.replicaNodes.filter((n) => n.healthy);
    if (healthyReplicas.length === 0) {
      return undefined;
    }

    // 使用加权选择
    const totalWeight = healthyReplicas.reduce((sum, n) => sum + n.weight, 0);
    let random = Math.random() * totalWeight;

    for (const replica of healthyReplicas) {
      random -= replica.weight;
      if (random <= 0) {
        return replica;
      }
    }

    return healthyReplicas[0];
  }

  /**
   * 决定是否使用从库（基于概率）
   */
  private shouldUseReplica(probability: number): boolean {
    return Math.random() < probability;
  }

  /**
   * 设置节点连接数
   */
  setNodeConnectionCount(nodeId: string, count: number): void {
    let node: DatabaseNode | undefined;
    if (this.config.primaryNode.id === nodeId) {
      node = this.config.primaryNode;
    } else {
      node = this.config.replicaNodes.find((n) => n.id === nodeId);
    }

    if (node) {
      node.connectionCount = count;
    }
  }
}