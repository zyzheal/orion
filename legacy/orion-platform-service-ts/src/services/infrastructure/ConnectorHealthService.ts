/**
 * Connector Health Service
 *
 * 提供连接器健康检查、自动重连和状态报告能力。
 * 定期对所有连接器执行健康检查，失败时自动触发重连。
 */

import { createLogger } from '../../utils/logger';
import { OrionError, ErrorCode } from '../../errors';
import {
  InfrastructureService,
  ConnectorInfo,
  ConnectorStatus,
  ConnectionHealthMetrics,
  ConnectorType,
} from './InfrastructureService';

const logger = createLogger('Infrastructure-ConnectorHealth');

// ============================================================================
// Types
// ============================================================================

/**
 * 连接器健康状态报告
 */
export interface ConnectorHealthReport {
  connectorId: string;
  type: ConnectorType;
  name: string;
  status: ConnectorStatus;
  latencyMs: number;
  lastCheckAt: Date;
  consecutiveFailures: number;
  uptimePercentage: number;
  totalReconnects: number;
  lastError?: string;
}

/**
 * 健康检查服务配置
 */
export interface ConnectorHealthConfig {
  checkIntervalMs: number;
  autoReconnect: boolean;
  reconnectThreshold: number; // 连续失败多少次后触发重连
}

// ============================================================================
// ConnectorHealthService
// ============================================================================

const DEFAULT_HEALTH_CONFIG: ConnectorHealthConfig = {
  checkIntervalMs: 30000,
  autoReconnect: true,
  reconnectThreshold: 3,
};

/**
 * 连接器健康检查服务
 *
 * 职责：
 * 1. 定期对所有连接器执行健康检查（默认每 30 秒）
 * 2. 记录连接延迟和可用性指标
 * 3. 连续失败达到阈值后自动触发重连
 * 4. 提供连接器状态报告
 */
export class ConnectorHealthService {
  private infrastructureService: InfrastructureService;
  private config: ConnectorHealthConfig;
  private healthCheckInterval: ReturnType<typeof setInterval> | null = null;
  private readonly connectorId?: string;

  constructor(
    infrastructureService: InfrastructureService,
    config?: Partial<ConnectorHealthConfig>,
    connectorId?: string
  ) {
    this.infrastructureService = infrastructureService;
    this.config = { ...DEFAULT_HEALTH_CONFIG, ...config };
    this.connectorId = connectorId;
  }

  // ==========================================================================
  // Lifecycle
  // ==========================================================================

  /**
   * 启动健康检查定时器
   */
  start(): void {
    if (this.healthCheckInterval) {
      logger.warn('Health monitor already started');
      return;
    }

    this.healthCheckInterval = setInterval(async () => {
      await this.performHealthChecks();
    }, this.config.checkIntervalMs);

    // 允许进程退出时定时器不阻塞
    if (typeof this.healthCheckInterval.unref === 'function') {
      this.healthCheckInterval.unref();
    }

    logger.info({ checkIntervalMs: this.config.checkIntervalMs, autoReconnect: this.config.autoReconnect }, 'Connector health monitor started');
  }

  /**
   * 停止健康检查定时器
   */
  stop(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
      logger.info('Connector health monitor stopped');
    }
  }

  // ==========================================================================
  // Health Check Execution
  // ==========================================================================

  /**
   * 执行所有连接器的健康检查
   */
  async performHealthChecks(): Promise<ConnectorHealthReport[]> {
    const connectors = this.connectorId
      ? this.infrastructureService.getConnector(this.connectorId) ? [this.infrastructureService.getConnector(this.connectorId)!] : []
      : this.infrastructureService.listConnectors();

    const reports: ConnectorHealthReport[] = [];

    for (const connector of connectors) {
      if (!connector) continue;

      // 只检查已连接或错误的连接器
      if (connector.status !== ConnectorStatus.Connected && connector.status !== ConnectorStatus.Error) {
        continue;
      }

      const report = await this.checkConnector(connector.id);
      if (report) {
        reports.push(report);
      }
    }

    return reports;
  }

  /**
   * 检查单个连接器的健康状态
   *
   * @param connectorId - 连接器 ID
   * @returns 健康报告
   */
  async checkConnector(connectorId: string): Promise<ConnectorHealthReport | null> {
    const connector = this.infrastructureService.getConnector(connectorId);
    if (!connector) {
      logger.warn({ connectorId }, 'Connector not found for health check');
      return null;
    }

    const start = Date.now();
    let report: ConnectorHealthReport;

    try {
      // 执行健康检查（ping/轻量级操作）
      await this.executeHealthCheck(connector);
      const latencyMs = Date.now() - start;

      const metrics = this.infrastructureService.getHealthMetrics(connectorId);
      const totalReconnects = metrics?.totalReconnects ?? 0;

      report = {
        connectorId,
        type: connector.type,
        name: connector.name,
        status: ConnectorStatus.Connected,
        latencyMs,
        lastCheckAt: new Date(),
        consecutiveFailures: 0,
        uptimePercentage: 100,
        totalReconnects,
      };

      // 如果之前处于错误状态，自动重连
      if (connector.status === ConnectorStatus.Error && this.config.autoReconnect) {
        logger.info({ connectorId }, 'Auto-reconnecting after successful health check');
        this.triggerReconnect(connectorId).catch(err => {
          logger.warn({ connectorId, error: err }, 'Auto-reconnect failed after health check');
        });
      }
    } catch (err) {
      const latencyMs = Date.now() - start;
      const message = err instanceof Error ? err.message : String(err);
      const metrics = this.infrastructureService.getHealthMetrics(connectorId);
      const consecutiveFailures = (metrics?.consecutiveFailures ?? 0) + 1;
      const totalReconnects = metrics?.totalReconnects ?? 0;

      report = {
        connectorId,
        type: connector.type,
        name: connector.name,
        status: ConnectorStatus.Error,
        latencyMs,
        lastCheckAt: new Date(),
        consecutiveFailures,
        uptimePercentage: Math.max(0, 100 - consecutiveFailures * 10),
        totalReconnects,
        lastError: message,
      };

      // 连续失败达到阈值后自动重连
      if (consecutiveFailures >= this.config.reconnectThreshold && this.config.autoReconnect) {
        logger.warn({ connectorId, consecutiveFailures, threshold: this.config.reconnectThreshold }, 'Triggering auto-reconnect');
        this.triggerReconnect(connectorId).catch(err => {
          logger.warn({ connectorId, error: err }, 'Auto-reconnect failed');
        });
      }
    }

    logger.debug({ connectorId, status: report.status, latencyMs: report.latencyMs }, 'Health check completed');
    return report;
  }

  // ==========================================================================
  // Reconnection
  // ==========================================================================

  /**
   * 触发连接器重连（不等待结果）
   */
  private triggerReconnect(connectorId: string): Promise<void> {
    return this.infrastructureService.reconnect(connectorId).then(
      () => {
        logger.info({ connectorId }, 'Reconnect succeeded');
      },
      err => {
        logger.warn({ connectorId, error: err }, 'Reconnect failed');
      }
    );
  }

  // ==========================================================================
  // Query Methods
  // ==========================================================================

  /**
   * 获取连接器当前状态报告
   */
  getStatus(connectorId: string): ConnectorHealthReport | null {
    const connector = this.infrastructureService.getConnector(connectorId);
    if (!connector) {
      return null;
    }

    const metrics = this.infrastructureService.getHealthMetrics(connectorId);

    return {
      connectorId,
      type: connector.type,
      name: connector.name,
      status: connector.status,
      latencyMs: metrics?.latencyMs ?? 0,
      lastCheckAt: metrics?.lastCheckAt ?? new Date(),
      consecutiveFailures: metrics?.consecutiveFailures ?? 0,
      uptimePercentage: metrics?.uptimePercentage ?? 0,
      totalReconnects: metrics?.totalReconnects ?? 0,
      lastError: connector.lastError,
    };
  }

  /**
   * 列出所有连接器的健康报告
   */
  listAllReports(): ConnectorHealthReport[] {
    return this.infrastructureService.listConnectors()
      .filter(c => c.status === ConnectorStatus.Connected || c.status === ConnectorStatus.Error)
      .map(connector => {
        const metrics = this.infrastructureService.getHealthMetrics(connector.id);
        return {
          connectorId: connector.id,
          type: connector.type,
          name: connector.name,
          status: connector.status,
          latencyMs: metrics?.latencyMs ?? 0,
          lastCheckAt: metrics?.lastCheckAt ?? new Date(),
          consecutiveFailures: metrics?.consecutiveFailures ?? 0,
          uptimePercentage: metrics?.uptimePercentage ?? 0,
          totalReconnects: metrics?.totalReconnects ?? 0,
          lastError: connector.lastError,
        };
      });
  }

  // ==========================================================================
  // Health Check Execution
  // ==========================================================================

  /**
   * 执行健康检查操作（轻量级 ping/探测）
   */
  private async executeHealthCheck(connector: ConnectorInfo): Promise<void> {
    // 根据连接器类型执行不同的健康检查
    switch (connector.type) {
      case ConnectorType.Kubernetes:
        await this.pingKubernetes(connector);
        break;
      case ConnectorType.Docker:
        await this.pingDocker(connector);
        break;
      case ConnectorType.Aws:
      case ConnectorType.Azure:
      case ConnectorType.Gcp:
        await this.pingCloudProvider(connector);
        break;
      default:
        await this.pingGeneric(connector);
    }
  }

  private async pingKubernetes(connector: ConnectorInfo): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 50 + Math.random() * 100));
    // 模拟 K8s API 健康检查
    if (Math.random() < 0.05) {
      throw new OrionError('Kubernetes API server unreachable', ErrorCode.SERVICE_UNAVAILABLE);
    }
  }

  private async pingDocker(connector: ConnectorInfo): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 30 + Math.random() * 80));
    if (Math.random() < 0.05) {
      throw new OrionError('Docker daemon unreachable', ErrorCode.SERVICE_UNAVAILABLE);
    }
  }

  private async pingCloudProvider(connector: ConnectorInfo): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 80 + Math.random() * 150));
    if (Math.random() < 0.05) {
      throw new OrionError('Cloud provider API unreachable', ErrorCode.SERVICE_UNAVAILABLE);
    }
  }

  private async pingGeneric(connector: ConnectorInfo): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 30 + Math.random() * 80));
  }
}
