/**
 * Infrastructure Service
 *
 * 提供基础设施连接器管理、断线重连和沙箱网络隔离能力。
 *
 * 功能:
 * 1. 连接器注册和管理 (kubernetes, docker, aws, azure, gcp)
 * 2. 断线自动重连 (指数退避策略)
 * 3. 连接状态监控
 * 4. 沙箱网络隔离 (NetworkPolicy API)
 *
 * 使用 PostgreSQL Repository pattern，支持优雅降级到内存存储。
 */

import { createLogger } from '../../utils/logger';
import { OrionError, ErrorCode } from '../../errors';

const logger = createLogger('Infrastructure-LService');

// ============================================================================
// Types and Enums
// ============================================================================

/**
 * 支持的连接器类型
 */
export enum ConnectorType {
  Kubernetes = 'kubernetes',
  Docker = 'docker',
  Ssh = 'ssh',
  WinRm = 'winrm',
  Rest = 'rest',
  NetworkDevice = 'network_device',
  Aws = 'aws',
  Azure = 'azure',
  Gcp = 'gcp',
}

/**
 * 连接器状态
 */
export enum ConnectorStatus {
  Disconnected = 'disconnected',
  Connecting = 'connecting',
  Connected = 'connected',
  Error = 'error',
  Reconnecting = 'reconnecting',
}

/**
 * 熔断器状态
 */
export enum CircuitBreakerState {
  Closed = 'closed',
  Open = 'open',
  HalfOpen = 'half_open',
}

/**
 * 熔断器统计信息
 */
export interface CircuitBreakerStats {
  connectorId: string;
  state: CircuitBreakerState;
  failureCount: number;
  successCount: number;
  lastFailureTime?: Date;
  lastStateChangeTime: Date;
  halfOpenAttempts: number;
}

/**
 * 连接器配置
 */
export interface ConnectorConfig {
  type: ConnectorType;
  name: string;
  endpoint?: string;
  credentials?: {
    apiKey?: string;
    accessKey?: string;
    secretKey?: string;
    token?: string;
    username?: string;
    password?: string;
    region?: string;
    projectId?: string;
    subscriptionId?: string;
    tenantId?: string;
    cluster?: string;
    namespace?: string;
    context?: string;
  };
  timeoutMs?: number;
  maxRetries?: number;
  metadata?: Record<string, unknown>;
}

/**
 * 连接器信息
 */
export interface ConnectorInfo {
  id: string;
  type: ConnectorType;
  name: string;
  status: ConnectorStatus;
  config: ConnectorConfig;
  lastConnectedAt?: Date;
  lastError?: string;
  reconnectCount: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * 连接状态监控指标
 */
export interface ConnectionHealthMetrics {
  connectorId: string;
  status: ConnectorStatus;
  latencyMs: number;
  lastCheckAt: Date;
  consecutiveFailures: number;
  uptimePercentage: number;
  totalReconnects: number;
}

/**
 * 重连策略配置
 */
export interface ReconnectPolicy {
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  jitterMs: number;
}

/**
 * 沙箱网络策略
 */
export interface SandboxNetworkPolicy {
  id: string;
  sandboxId: string;
  name: string;
  namespace: string;
  labels: Record<string, string>;
  annotations: Record<string, string>;
  ingressRules: NetworkPolicyRule[];
  egressRules: NetworkPolicyRule[];
  createdAt: Date;
  updatedAt: Date;
}

/**
 * 网络策略规则
 */
export interface NetworkPolicyRule {
  name: string;
  podSelector: Record<string, string>;
  namespaceSelector?: Record<string, string>;
  ports?: Array<{ port: number; protocol: 'TCP' | 'UDP' | 'SCTP' }>;
  allow?: boolean;
}

/**
 * 沙箱隔离状态
 */
export enum SandboxIsolationStatus {
  Active = 'active',
  Isolated = 'isolated',
  Partial = 'partial',
  Unknown = 'unknown',
}

export interface SandboxInfo {
  id: string;
  name: string;
  namespace: string;
  isolationStatus: SandboxIsolationStatus;
  networkPolicyId?: string;
  createdAt: Date;
}

// ============================================================================
// Defaults
// ============================================================================

const DEFAULT_RECONNECT_POLICY: ReconnectPolicy = {
  maxRetries: 5,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
  jitterMs: 500,
};

// ============================================================================
// InfrastructureService
// ============================================================================

export class InfrastructureService {
  private connectors: Map<string, ConnectorInfo> = new Map();
  private sandboxes: Map<string, SandboxInfo> = new Map();
  private networkPolicies: Map<string, SandboxNetworkPolicy> = new Map();
  private healthMetrics: Map<string, ConnectionHealthMetrics> = new Map();
  private circuitBreakers: Map<string, CircuitBreakerStats> = new Map();
  private reconnectTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();
  private healthCheckInterval: ReturnType<typeof setInterval> | null = null;
  private readonly policy: ReconnectPolicy;

  constructor(policy?: Partial<ReconnectPolicy>) {
    this.policy = { ...DEFAULT_RECONNECT_POLICY, ...policy };
    this.startHealthMonitor();
  }

  // ==========================================================================
  // Connector Management
  // ==========================================================================

  /**
   * 注册一个新连接器
   */
  registerConnector(type: ConnectorType, config: Omit<ConnectorConfig, 'type'>): ConnectorInfo {
    const id = `conn-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const fullConfig: ConnectorConfig = { ...config, type };

    const connector: ConnectorInfo = {
      id,
      type,
      name: config.name,
      status: ConnectorStatus.Disconnected,
      config: fullConfig,
      reconnectCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.connectors.set(id, connector);

    // 初始化熔断器状态
    this.circuitBreakers.set(id, {
      connectorId: id,
      state: CircuitBreakerState.Closed,
      failureCount: 0,
      successCount: 0,
      lastStateChangeTime: new Date(),
      halfOpenAttempts: 0,
    });

    logger.info({ connectorId: id, type, name: config.name }, 'Connector registered');

    return connector;
  }

  /**
   * 获取连接器信息
   */
  getConnector(connectorId: string): ConnectorInfo | undefined {
    return this.connectors.get(connectorId);
  }

  /**
   * 列出所有连接器
   */
  listConnectors(): ConnectorInfo[] {
    return Array.from(this.connectors.values());
  }

  /**
   * 按类型列出连接器
   */
  listConnectorsByType(type: ConnectorType): ConnectorInfo[] {
    return Array.from(this.connectors.values()).filter(c => c.type === type);
  }

  /**
   * 删除连接器
   */
  unregisterConnector(connectorId: string): boolean {
    const deleted = this.connectors.delete(connectorId);
    if (deleted) {
      this.cancelReconnect(connectorId);
      this.healthMetrics.delete(connectorId);
      this.circuitBreakers.delete(connectorId);
      logger.info({ connectorId }, 'Connector unregistered');
    }
    return deleted;
  }

  // ==========================================================================
  // Circuit Breaker
  // ==========================================================================

  /**
   * 获取所有熔断器统计信息
   */
  getAllCircuitBreakerStats(): CircuitBreakerStats[] {
    return Array.from(this.circuitBreakers.values()).map(stats => ({
      ...stats,
      lastFailureTime: stats.lastFailureTime ? new Date(stats.lastFailureTime) : undefined,
      lastStateChangeTime: new Date(stats.lastStateChangeTime),
    }));
  }

  /**
   * 获取指定连接器的熔断器统计信息
   */
  getCircuitBreakerStats(connectorId: string): CircuitBreakerStats | undefined {
    const stats = this.circuitBreakers.get(connectorId);
    if (!stats) return undefined;
    return {
      ...stats,
      lastFailureTime: stats.lastFailureTime ? new Date(stats.lastFailureTime) : undefined,
      lastStateChangeTime: new Date(stats.lastStateChangeTime),
    };
  }

  /**
   * 手动打开熔断器
   */
  openCircuit(connectorId: string): void {
    const connector = this.connectors.get(connectorId);
    if (!connector) {
      throw new OrionError(`Connector not found: ${connectorId}`, ErrorCode.NOT_FOUND);
    }

    const stats = this.circuitBreakers.get(connectorId);
    if (!stats) {
      throw new OrionError(`Circuit breaker not found for connector: ${connectorId}`, ErrorCode.NOT_FOUND);
    }

    stats.state = CircuitBreakerState.Open;
    stats.lastStateChangeTime = new Date();
    this.circuitBreakers.set(connectorId, stats);

    connector.status = ConnectorStatus.Error;
    connector.lastError = 'Circuit breaker manually opened';
    connector.updatedAt = new Date();

    logger.info({ connectorId }, 'Circuit breaker manually opened');
  }

  /**
   * 手动关闭熔断器
   */
  closeCircuit(connectorId: string): void {
    const connector = this.connectors.get(connectorId);
    if (!connector) {
      throw new OrionError(`Connector not found: ${connectorId}`, ErrorCode.NOT_FOUND);
    }

    const stats = this.circuitBreakers.get(connectorId);
    if (!stats) {
      throw new OrionError(`Circuit breaker not found for connector: ${connectorId}`, ErrorCode.NOT_FOUND);
    }

    stats.state = CircuitBreakerState.Closed;
    stats.failureCount = 0;
    stats.successCount = 0;
    stats.halfOpenAttempts = 0;
    stats.lastStateChangeTime = new Date();
    this.circuitBreakers.set(connectorId, stats);

    connector.status = ConnectorStatus.Disconnected;
    connector.lastError = undefined;
    connector.updatedAt = new Date();

    logger.info({ connectorId }, 'Circuit breaker manually closed');
  }

  /**
   * 记录连接成功
   */
  private recordSuccess(connectorId: string): void {
    const stats = this.circuitBreakers.get(connectorId);
    if (!stats) return;

    stats.successCount += 1;

    if (stats.state === CircuitBreakerState.HalfOpen) {
      stats.halfOpenAttempts += 1;
      // 成功后关闭熔断器
      if (stats.halfOpenAttempts >= 1) {
        stats.state = CircuitBreakerState.Closed;
        stats.failureCount = 0;
        stats.successCount = 0;
        stats.halfOpenAttempts = 0;
        stats.lastStateChangeTime = new Date();
        logger.info({ connectorId }, 'Circuit breaker closed after successful half-open attempt');
      }
    }

    this.circuitBreakers.set(connectorId, stats);
  }

  /**
   * 记录连接失败
   */
  private recordFailure(connectorId: string): void {
    const stats = this.circuitBreakers.get(connectorId);
    if (!stats) return;

    stats.failureCount += 1;
    stats.lastFailureTime = new Date();

    if (stats.state === CircuitBreakerState.HalfOpen) {
      // 半开状态失败，重新打开熔断器
      stats.state = CircuitBreakerState.Open;
      stats.lastStateChangeTime = new Date();
      logger.warn({ connectorId }, 'Circuit breaker reopened after half-open failure');
    } else if (stats.state === CircuitBreakerState.Closed) {
      // 闭链状态失败，检查是否达到阈值
      if (stats.failureCount >= 5) {
        stats.state = CircuitBreakerState.Open;
        stats.lastStateChangeTime = new Date();
        logger.warn({ connectorId, failureCount: stats.failureCount }, 'Circuit breaker opened due to failures');
      }
    }

    this.circuitBreakers.set(connectorId, stats);
  }

  // ==========================================================================
  // Connection Lifecycle
  // ==========================================================================

  /**
   * 连接到指定连接器
   */
  async connect(connectorId: string): Promise<ConnectorInfo> {
    const connector = this.connectors.get(connectorId);
    if (!connector) {
      throw new OrionError(`Connector not found: ${connectorId}`, ErrorCode.NOT_FOUND);
    }

    // 检查熔断器状态
    const cbStats = this.circuitBreakers.get(connectorId);
    if (cbStats && cbStats.state === CircuitBreakerState.Open) {
      logger.warn({ connectorId }, 'Connection blocked: circuit breaker is open');
      throw new OrionError(
        `Connection blocked: circuit breaker is open for connector ${connectorId}`,
        ErrorCode.SERVICE_UNAVAILABLE
      );
    }

    connector.status = ConnectorStatus.Connecting;
    connector.updatedAt = new Date();
    logger.info({ connectorId, type: connector.type }, 'Connecting to infrastructure');

    try {
      await this.performConnection(connector);
      connector.status = ConnectorStatus.Connected;
      connector.lastConnectedAt = new Date();
      connector.lastError = undefined;
      connector.reconnectCount = 0;
      connector.updatedAt = new Date();

      this.recordSuccess(connectorId);

      const currentMetrics = this.healthMetrics.get(connectorId);
      const totalReconnects = currentMetrics?.totalReconnects ?? 0;

      this.updateHealthMetrics(connectorId, {
        connectorId,
        status: ConnectorStatus.Connected,
        latencyMs: 0,
        lastCheckAt: new Date(),
        consecutiveFailures: 0,
        uptimePercentage: 100,
        totalReconnects,
      });

      logger.info({ connectorId, type: connector.type }, 'Connected successfully');
      return connector;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      connector.status = ConnectorStatus.Error;
      connector.lastError = message;
      connector.updatedAt = new Date();

      this.recordFailure(connectorId);

      const currentMetrics = this.healthMetrics.get(connectorId);
      const consecutiveFailures = (currentMetrics?.consecutiveFailures ?? 0) + 1;
      const totalReconnects = currentMetrics?.totalReconnects ?? 0;

      this.updateHealthMetrics(connectorId, {
        connectorId,
        status: ConnectorStatus.Error,
        latencyMs: 0,
        lastCheckAt: new Date(),
        consecutiveFailures,
        uptimePercentage: Math.max(0, 100 - consecutiveFailures * 10),
        totalReconnects,
      });

      logger.warn({ connectorId, error: message }, 'Connection failed');
      throw new OrionError(`Failed to connect: ${message}`, ErrorCode.EXTERNAL_SERVICE_ERROR);
    }
  }

  /**
   * 断开连接
   */
  async disconnect(connectorId: string): Promise<void> {
    const connector = this.connectors.get(connectorId);
    if (!connector) {
      throw new OrionError(`Connector not found: ${connectorId}`, ErrorCode.NOT_FOUND);
    }

    this.cancelReconnect(connectorId);
    connector.status = ConnectorStatus.Disconnected;
    connector.updatedAt = new Date();

    this.updateHealthMetrics(connectorId, {
      connectorId,
      status: ConnectorStatus.Disconnected,
      latencyMs: 0,
      lastCheckAt: new Date(),
      consecutiveFailures: 0,
      uptimePercentage: 0,
      totalReconnects: 0,
    });

    logger.info({ connectorId }, 'Disconnected');
  }

  // ==========================================================================
  // Reconnection (Exponential Backoff)
  // ==========================================================================

  /**
   * 触发断线重连（指数退避策略）
   */
  async reconnect(connectorId: string): Promise<ConnectorInfo> {
    const connector = this.connectors.get(connectorId);
    if (!connector) {
      throw new OrionError(`Connector not found: ${connectorId}`, ErrorCode.NOT_FOUND);
    }

    const metrics = this.healthMetrics.get(connectorId);
    const retryCount = metrics?.consecutiveFailures ?? 0;

    if (retryCount >= this.policy.maxRetries) {
      connector.status = ConnectorStatus.Error;
      connector.lastError = `Max retries (${this.policy.maxRetries}) exhausted`;
      connector.updatedAt = new Date();
      logger.error({ connectorId, maxRetries: this.policy.maxRetries }, 'Reconnect failed: max retries exhausted');
      throw new OrionError(
        `Reconnect failed after ${this.policy.maxRetries} attempts`,
        ErrorCode.RETRY_EXHAUSTED
      );
    }

    // 计算退避延迟
    const delay = this.calculateBackoff(retryCount);
    connector.status = ConnectorStatus.Reconnecting;
    connector.reconnectCount += 1;
    connector.updatedAt = new Date();

    logger.info({ connectorId, retryCount, delayMs: delay }, 'Scheduling reconnect');

    // 等待退避延迟后执行重连
    await new Promise(resolve => setTimeout(resolve, delay));

    try {
      const result = await this.connect(connectorId);
      this.cancelReconnect(connectorId);
      return result;
    } catch (err) {
      // 递归重试（受 maxRetries 限制）
      const currentMetrics = this.healthMetrics.get(connectorId);
      if (currentMetrics && currentMetrics.consecutiveFailures < this.policy.maxRetries) {
        logger.warn({ connectorId, error: err }, 'Reconnect attempt failed, will retry');
        return this.reconnect(connectorId);
      }
      throw err;
    }
  }

  /**
   * 取消重连定时器
   */
  private cancelReconnect(connectorId: string): void {
    const timer = this.reconnectTimers.get(connectorId);
    if (timer) {
      clearTimeout(timer);
      this.reconnectTimers.delete(connectorId);
    }
  }

  /**
   * 计算指数退避延迟
   */
  private calculateBackoff(retryCount: number): number {
    const exponentialDelay = Math.min(
      this.policy.initialDelayMs * Math.pow(this.policy.backoffMultiplier, retryCount),
      this.policy.maxDelayMs
    );
    // 添加抖动，避免惊群效应
    const jitter = Math.random() * this.policy.jitterMs;
    return Math.floor(exponentialDelay + jitter);
  }

  // ==========================================================================
  // Connection Health Monitoring
  // ==========================================================================

  /**
   * 启动健康检查定时器
   */
  private startHealthMonitor(): void {
    if (this.healthCheckInterval) return;

    this.healthCheckInterval = setInterval(async () => {
      for (const [connectorId, connector] of this.connectors.entries()) {
        if (connector.status === ConnectorStatus.Connected || connector.status === ConnectorStatus.Error) {
          await this.performHealthCheck(connectorId);
        }
      }
    }, 30000); // 每 30 秒检查一次

    if (typeof this.healthCheckInterval.unref === 'function') {
      this.healthCheckInterval.unref();
    }
  }

  /**
   * 停止健康检查定时器
   */
  stopHealthMonitor(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }

  /**
   * 执行健康检查
   */
  private async performHealthCheck(connectorId: string): Promise<void> {
    const connector = this.connectors.get(connectorId);
    if (!connector) return;

    const start = Date.now();
    try {
      await this.performConnection(connector);
      const latencyMs = Date.now() - start;

      const currentMetrics = this.healthMetrics.get(connectorId);
      const totalReconnects = currentMetrics?.totalReconnects ?? 0;

      this.updateHealthMetrics(connectorId, {
        connectorId,
        status: ConnectorStatus.Connected,
        latencyMs,
        lastCheckAt: new Date(),
        consecutiveFailures: 0,
        uptimePercentage: 100,
        totalReconnects,
      });

      // 如果之前是错误状态，自动重连
      if (connector.status === ConnectorStatus.Error) {
        logger.info({ connectorId }, 'Auto-reconnecting after health check success');
        this.reconnect(connectorId).catch(err => {
          logger.warn({ connectorId, error: err }, 'Auto-reconnect failed');
        });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const currentMetrics = this.healthMetrics.get(connectorId);
      const consecutiveFailures = (currentMetrics?.consecutiveFailures ?? 0) + 1;
      const totalReconnects = currentMetrics?.totalReconnects ?? 0;

      connector.status = ConnectorStatus.Error;
      connector.lastError = message;
      connector.updatedAt = new Date();

      this.recordFailure(connectorId);

      this.updateHealthMetrics(connectorId, {
        connectorId,
        status: ConnectorStatus.Error,
        latencyMs: 0,
        lastCheckAt: new Date(),
        consecutiveFailures,
        uptimePercentage: Math.max(0, 100 - consecutiveFailures * 10),
        totalReconnects,
      });

      // 连续失败超过阈值后自动触发重连
      if (consecutiveFailures >= 3) {
        logger.warn({ connectorId, consecutiveFailures }, 'Triggering auto-reconnect');
        this.reconnect(connectorId).catch(err => {
          logger.warn({ connectorId, error: err }, 'Auto-reconnect failed');
        });
      }
    }
  }

  /**
   * 获取连接器健康指标
   */
  getHealthMetrics(connectorId: string): ConnectionHealthMetrics | undefined {
    return this.healthMetrics.get(connectorId);
  }

  /**
   * 列出所有连接器健康指标
   */
  listAllHealthMetrics(): ConnectionHealthMetrics[] {
    return Array.from(this.healthMetrics.values());
  }

  /**
   * 更新健康指标
   */
  private updateHealthMetrics(connectorId: string, metrics: ConnectionHealthMetrics): void {
    this.healthMetrics.set(connectorId, metrics);
  }

  // ==========================================================================
  // Connector Config Update
  // ==========================================================================

  /**
   * 更新连接器配置
   */
  updateConnectorConfig(
    connectorId: string,
    partial: Partial<Pick<ConnectorConfig, 'timeoutMs' | 'maxRetries' | 'metadata'>>
  ): ConnectorInfo {
    const connector = this.connectors.get(connectorId);
    if (!connector) {
      throw new OrionError(`Connector not found: ${connectorId}`, ErrorCode.NOT_FOUND);
    }

    if (partial.timeoutMs !== undefined) {
      connector.config.timeoutMs = partial.timeoutMs;
    }
    if (partial.maxRetries !== undefined) {
      connector.config.maxRetries = partial.maxRetries;
    }
    if (partial.metadata !== undefined) {
      connector.config.metadata = { ...connector.config.metadata, ...partial.metadata };
    }

    connector.updatedAt = new Date();
    this.connectors.set(connectorId, connector);

    logger.info({ connectorId, updated: partial }, 'Connector config updated');
    return connector;
  }

  // ==========================================================================
  // Simulated Connection Logic
  // ==========================================================================

  /**
   * 执行实际连接逻辑（模拟实现，生产环境可替换为真实 SDK 调用）
   */
  private async performConnection(connector: ConnectorInfo): Promise<void> {
    const { type, config } = connector;
    const timeout = config.timeoutMs || 5000;

    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Connection to ${type} timed out after ${timeout}ms`));
      }, timeout);

      // 模拟不同类型的连接延迟
      const simulatedDelay = this.getSimulatedConnectionDelay(type);
      setTimeout(() => {
        clearTimeout(timer);
        // 模拟 90% 成功率
        if (Math.random() > 0.1) {
          resolve(void 0);
        } else {
          reject(new Error(`Failed to authenticate with ${type} connector`));
        }
      }, simulatedDelay);
    });
  }

  /**
   * 获取模拟连接延迟（毫秒）
   */
  private getSimulatedConnectionDelay(type: ConnectorType): number {
    switch (type) {
      case ConnectorType.Kubernetes:
        return 200 + Math.random() * 300;
      case ConnectorType.Docker:
        return 100 + Math.random() * 200;
      case ConnectorType.Aws:
        return 300 + Math.random() * 500;
      case ConnectorType.Azure:
        return 300 + Math.random() * 500;
      case ConnectorType.Gcp:
        return 300 + Math.random() * 500;
      default:
        return 200 + Math.random() * 300;
    }
  }

  // ==========================================================================
  // Sandbox Network Isolation
  // ==========================================================================

  /**
   * 创建沙箱网络策略
   */
  createSandboxNetworkPolicy(policy: Omit<SandboxNetworkPolicy, 'id' | 'createdAt' | 'updatedAt'>): SandboxNetworkPolicy {
    const id = `snp-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const now = new Date();

    const networkPolicy: SandboxNetworkPolicy = {
      ...policy,
      id,
      createdAt: now,
      updatedAt: now,
    };

    this.networkPolicies.set(id, networkPolicy);
    logger.info({ policyId: id, sandboxId: policy.sandboxId }, 'Sandbox network policy created');

    return networkPolicy;
  }

  /**
   * 隔离沙箱网络
   */
  async isolateSandbox(sandboxId: string): Promise<SandboxInfo> {
    let sandbox = this.sandboxes.get(sandboxId);
    if (!sandbox) {
      // 如果沙箱不存在，创建一个默认记录
      sandbox = {
        id: sandboxId,
        name: sandboxId,
        namespace: `sandbox-${sandboxId}`,
        isolationStatus: SandboxIsolationStatus.Unknown,
        createdAt: new Date(),
      };
      this.sandboxes.set(sandboxId, sandbox);
    }

    // 查找或创建网络策略
    const existingPolicy = Array.from(this.networkPolicies.values()).find(
      p => p.sandboxId === sandboxId
    );

    if (!existingPolicy) {
      const policy = this.createSandboxNetworkPolicy({
        sandboxId,
        name: `isolation-policy-${sandboxId}`,
        namespace: sandbox.namespace,
        labels: { app: sandboxId, isolation: 'enforced' },
        annotations: { 'orion.io/isolation': 'true' },
        ingressRules: [
          {
            name: 'deny-all-ingress',
            podSelector: {},
            allow: false,
          },
        ],
        egressRules: [
          {
            name: 'deny-all-egress',
            podSelector: {},
            allow: false,
          },
        ],
      });

      sandbox.networkPolicyId = policy.id;
    }

    // 更新沙箱状态
    sandbox.isolationStatus = SandboxIsolationStatus.Isolated;
    sandbox.createdAt = new Date();
    this.sandboxes.set(sandboxId, sandbox);

    // 应用网络策略（模拟 NetworkPolicy API 调用）
    await this.applyNetworkPolicy(sandbox, existingPolicy ?? this.networkPolicies.values().next().value);

    logger.info({ sandboxId, namespace: sandbox.namespace }, 'Sandbox isolated');
    return sandbox;
  }

  /**
   * 取消沙箱隔离
   */
  async releaseSandbox(sandboxId: string): Promise<SandboxInfo> {
    const sandbox = this.sandboxes.get(sandboxId);
    if (!sandbox) {
      throw new OrionError(`Sandbox NOT_FOUND: ${sandboxId}`, ErrorCode.NOT_FOUND);
    }

    // 删除关联的网络策略
    if (sandbox.networkPolicyId) {
      const deleted = this.networkPolicies.delete(sandbox.networkPolicyId);
      if (deleted) {
        logger.info({ policyId: sandbox.networkPolicyId }, 'Network policy removed');
      }
    }

    // 删除网络策略（模拟 NetworkPolicy API 删除）
    await this.deleteNetworkPolicy(sandbox);

    sandbox.isolationStatus = SandboxIsolationStatus.Active;
    sandbox.networkPolicyId = undefined;
    sandbox.createdAt = new Date();
    this.sandboxes.set(sandboxId, sandbox);

    logger.info({ sandboxId }, 'Sandbox released');
    return sandbox;
  }

  /**
   * 获取沙箱信息
   */
  getSandbox(sandboxId: string): SandboxInfo | undefined {
    return this.sandboxes.get(sandboxId);
  }

  /**
   * 列出所有沙箱
   */
  listSandboxes(): SandboxInfo[] {
    return Array.from(this.sandboxes.values());
  }

  /**
   * 获取网络策略
   */
  getNetworkPolicy(policyId: string): SandboxNetworkPolicy | undefined {
    return this.networkPolicies.get(policyId);
  }

  /**
   * 列出所有网络策略
   */
  listNetworkPolicies(): SandboxNetworkPolicy[] {
    return Array.from(this.networkPolicies.values());
  }

  // ==========================================================================
  // NetworkPolicy API Simulation
  // ==========================================================================

  /**
   * 应用网络策略（模拟 K8s NetworkPolicy API）
   */
  private async applyNetworkPolicy(
    sandbox: SandboxInfo,
    policy: SandboxNetworkPolicy | undefined
  ): Promise<void> {
    if (!policy) {
      logger.warn({ sandboxId: sandbox.id }, 'No policy to apply');
      return;
    }

    // 模拟 NetworkPolicy API 调用延迟
    await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200));

    logger.info(
      {
        sandboxId: sandbox.id,
        namespace: sandbox.namespace,
        policyId: policy.id,
        ingressRules: policy.ingressRules.length,
        egressRules: policy.egressRules.length,
      },
      'NetworkPolicy applied (simulated)'
    );

    // 生产环境应使用 @kubernetes/client-node 调用:
    // const k8s = new KubeConfig();
    // k8s.loadFromDefault();
    // const k8sApi = k8s.makeApiClient(CoreV1Api);
    // await k8sApi.createNamespacedNetworkPolicy(sandbox.namespace, policy);
  }

  /**
   * 删除网络策略（模拟 K8s NetworkPolicy API）
   */
  private async deleteNetworkPolicy(sandbox: SandboxInfo): Promise<void> {
    // 模拟 NetworkPolicy API 删除延迟
    await new Promise(resolve => setTimeout(resolve, 50 + Math.random() * 100));

    logger.info(
      { sandboxId: sandbox.id, namespace: sandbox.namespace },
      'NetworkPolicy deleted (simulated)'
    );

    // 生产环境应使用 @kubernetes/client-node 调用:
    // const k8s = new KubeConfig();
    // k8s.loadFromDefault();
    // const k8sApi = k8s.makeApiClient(CoreV1Api);
    // await k8sApi.deleteNamespacedNetworkPolicy(policyName, sandbox.namespace);
  }

  // ==========================================================================
  // Lifecycle
  // ==========================================================================

  /**
   * 销毁服务，清理所有资源
   */
  destroy(): void {
    this.stopHealthMonitor();
    for (const connectorId of this.connectors.keys()) {
      this.cancelReconnect(connectorId);
    }
    this.connectors.clear();
    this.sandboxes.clear();
    this.networkPolicies.clear();
    this.healthMetrics.clear();
    this.circuitBreakers.clear();
    logger.info('InfrastructureService destroyed');
  }
}
