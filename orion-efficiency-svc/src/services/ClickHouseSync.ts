/**
 * ClickHouse 同步服务
 *
 * 负责：
 * - ClickHouse 连接管理
 * - 数据表创建（DDL）
 * - 批量数据同步
 * - 同步失败重试
 * - 连接失败时降级到本地存储
 */

import { EventEmitter } from 'events';
import {
  EfficiencyMetricsRow,
  EfficiencyEventRow,
  ClickHouseSyncStatus,
  PipelineCompletionRecord,
  DeploymentRecord,
} from '../types/efficiency';

/**
 * ClickHouse 连接配置
 */
export interface ClickHouseConfig {
  /** 服务器 URL */
  host: string;
  /** 端口 */
  port: number;
  /** 用户名 */
  username: string;
  /** 密码 */
  password: string;
  /** 数据库名 */
  database: string;
  /** 是否启用 HTTPS */
  https?: boolean;
  /** 连接超时（毫秒） */
  connectTimeout?: number;
  /** 请求超时（毫秒） */
  requestTimeout?: number;
}

/**
 * ClickHouse 客户端接口（用于 Mock）
 */
export interface ClickHouseClient {
  /** 执行 SQL 命令 */
  command(params: { query: string }): Promise<void>;
  /** 执行查询 */
  query(params: { query: string }): Promise<{ json: () => Promise<any[]> }>;
  /** 插入数据 */
  insert(params: {
    table: string;
    values: Record<string, any>[];
    format?: string;
  }): Promise<void>;
  /** 关闭连接 */
  close(): Promise<void>;
}

/**
 * ClickHouse 同步服务
 *
 * 使用 EventEmitter 模式便于 Mock 和测试
 */
export class ClickHouseSync extends EventEmitter {
  private config: ClickHouseConfig;
  private client: ClickHouseClient | null = null;
  private connected: boolean = false;
  private tablesCreated: boolean = false;
  private pendingMetricsRecords: EfficiencyMetricsRow[] = [];
  private pendingEventRecords: EfficiencyEventRow[] = [];
  private lastSyncAt?: Date;
  private lastError?: string;
  private consecutiveFailures: number = 0;
  private maxPendingRecords: number = 1000;
  private batchSize: number = 100;
  private syncInterval?: ReturnType<typeof setInterval>;

  constructor(config: ClickHouseConfig) {
    super();
    this.config = config;
  }

  /**
   * 连接到 ClickHouse
   */
  async connect(client?: ClickHouseClient): Promise<boolean> {
    try {
      if (client) {
        this.client = client;
      } else {
        this.client = await this.createClient();
      }

      if (!this.client) {
        this.connected = false;
        this.emit('connection_failed', new Error('Failed to create ClickHouse client'));
        return false;
      }

      this.connected = true;
      this.consecutiveFailures = 0;
      this.emit('connected');
      return true;
    } catch (error) {
      this.connected = false;
      this.lastError = error instanceof Error ? error.message : String(error);
      this.consecutiveFailures++;
      this.emit('connection_failed', error);
      return false;
    }
  }

  /**
   * 创建 ClickHouse 客户端（实际环境中使用 @clickhouse/client）
   */
  private async createClient(): Promise<ClickHouseClient | null> {
    // 尝试动态导入 ClickHouse 客户端
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { createClient } = require('@clickhouse/client');
      const client = createClient({
        url: `${this.config.https ? 'https' : 'http'}://${this.config.host}:${this.config.port}`,
        username: this.config.username,
        password: this.config.password,
        database: this.config.database,
        request_timeout: this.config.requestTimeout || 30000,
        connection: {
          connect_timeout: this.config.connectTimeout || 10000,
        },
      });

      return {
        command: async (params: { query: string }) => {
          await client.command({ query: params.query });
        },
        query: async (params: { query: string }) => {
          const resultSet = await client.query({
            query: params.query,
            format: 'JSONEachRow',
          });
          return {
            json: async () => {
              const result = await resultSet.json();
              return result as any[];
            },
          };
        },
        insert: async (params: { table: string; values: Record<string, any>[] }) => {
          await client.insert({
            table: params.table,
            values: params.values,
            format: 'JSONEachRow',
          });
        },
        close: async () => {
          await client.close();
        },
      };
    } catch {
      console.warn('[ClickHouseSync] @clickhouse/client not available, running in degraded mode');
      return null;
    }
  }

  /**
   * 创建数据表（DDL）
   */
  async createTables(): Promise<boolean> {
    if (!this.client || !this.connected) {
      this.emit('error', new Error('Not connected to ClickHouse'));
      return false;
    }

    try {
      // 创建效能指标表
      await this.client.command({
        query: `
          CREATE TABLE IF NOT EXISTS ${this.config.database}.efficiency_metrics (
            id String,
            tenant_id String,
            metric_type String,
            window_type String,
            window_start DateTime,
            window_end DateTime,
            metric_value String,
            created_at DateTime DEFAULT now()
          ) ENGINE = MergeTree()
          PARTITION BY toYYYYMM(window_start)
          ORDER BY (tenant_id, metric_type, window_start)
          TTL created_at + INTERVAL 1 YEAR
        `,
      });

      // 创建原始事件表
      await this.client.command({
        query: `
          CREATE TABLE IF NOT EXISTS ${this.config.database}.efficiency_events (
            id String,
            tenant_id String,
            event_type String,
            event_data String,
            event_time DateTime,
            created_at DateTime DEFAULT now()
          ) ENGINE = MergeTree()
          PARTITION BY toYYYYMM(event_time)
          ORDER BY (tenant_id, event_type, event_time)
          TTL created_at + INTERVAL 90 DAY
        `,
      });

      // 创建 Pipeline 完成记录表
      await this.client.command({
        query: `
          CREATE TABLE IF NOT EXISTS ${this.config.database}.pipeline_completions (
            id String,
            tenant_id String,
            run_id String,
            pipeline_id String,
            status String,
            trigger_type String,
            git_ref String,
            git_sha String,
            duration_ms UInt64,
            completed_at DateTime,
            created_at DateTime DEFAULT now()
          ) ENGINE = MergeTree()
          PARTITION BY toYYYYMM(completed_at)
          ORDER BY (tenant_id, completed_at, run_id)
          TTL created_at + INTERVAL 1 YEAR
        `,
      });

      // 创建部署记录表
      await this.client.command({
        query: `
          CREATE TABLE IF NOT EXISTS ${this.config.database}.deployment_records (
            id String,
            tenant_id String,
            deployment_id String,
            service String,
            environment String,
            status String,
            version String,
            duration_ms UInt64,
            deployed_at DateTime,
            recovery_time_ms UInt64,
            created_at DateTime DEFAULT now()
          ) ENGINE = MergeTree()
          PARTITION BY toYYYYMM(deployed_at)
          ORDER BY (tenant_id, service, deployed_at)
          TTL created_at + INTERVAL 1 YEAR
        `,
      });

      this.tablesCreated = true;
      this.emit('tables_created');
      return true;
    } catch (error) {
      this.lastError = error instanceof Error ? error.message : String(error);
      this.consecutiveFailures++;
      this.emit('error', error);
      return false;
    }
  }

  /**
   * 同步 Pipeline 完成记录
   */
  async syncPipelineRecords(records: PipelineCompletionRecord[]): Promise<boolean> {
    if (!this.client || !this.connected) {
      // 降级：添加到本地待同步队列
      for (const record of records) {
        const eventRow: EfficiencyEventRow = {
          id: record.id,
          tenant_id: record.tenantId || 'default',
          event_type: 'pipeline.run.completed',
          event_data: JSON.stringify(record),
          event_time: record.completedAt.toISOString(),
          created_at: new Date().toISOString(),
        };
        this.pendingEventRecords.push(eventRow);
      }
      this.emit('degraded', { type: 'pipeline_records', count: records.length });
      return false;
    }

    try {
      const values = records.map((r) => ({
        id: r.id,
        tenant_id: r.tenantId || 'default',
        run_id: r.runId,
        pipeline_id: r.pipelineId,
        status: r.status,
        trigger_type: r.triggerType,
        git_ref: r.gitRef || '',
        git_sha: r.gitSha || '',
        duration_ms: r.durationMs,
        completed_at: r.completedAt.toISOString(),
      }));

      await this.client.insert({
        table: `${this.config.database}.pipeline_completions`,
        values,
      });

      // 标记为已同步
      for (const record of records) {
        record.syncedToClickHouse = true;
        record.syncedAt = new Date();
      }

      this.consecutiveFailures = 0;
      this.lastSyncAt = new Date();
      this.emit('synced', { type: 'pipeline_records', count: records.length });
      return true;
    } catch (error) {
      this.lastError = error instanceof Error ? error.message : String(error);
      this.consecutiveFailures++;
      this.emit('sync_failed', { type: 'pipeline_records', error });
      return false;
    }
  }

  /**
   * 同步部署记录
   */
  async syncDeploymentRecords(records: DeploymentRecord[]): Promise<boolean> {
    if (!this.client || !this.connected) {
      // 降级：添加到本地待同步队列
      for (const record of records) {
        const eventRow: EfficiencyEventRow = {
          id: record.id,
          tenant_id: record.tenantId || 'default',
          event_type: `deployment.${record.status}`,
          event_data: JSON.stringify(record),
          event_time: record.deployedAt.toISOString(),
          created_at: new Date().toISOString(),
        };
        this.pendingEventRecords.push(eventRow);
      }
      this.emit('degraded', { type: 'deployment_records', count: records.length });
      return false;
    }

    try {
      const values = records.map((r) => ({
        id: r.id,
        tenant_id: r.tenantId || 'default',
        deployment_id: r.deploymentId,
        service: r.service,
        environment: r.environment,
        status: r.status,
        version: r.version || '',
        duration_ms: r.durationMs || 0,
        deployed_at: r.deployedAt.toISOString(),
        recovery_time_ms: r.recoveryTimeMs || 0,
      }));

      await this.client.insert({
        table: `${this.config.database}.deployment_records`,
        values,
      });

      // 标记为已同步
      for (const record of records) {
        record.syncedToClickHouse = true;
        record.syncedAt = new Date();
      }

      this.consecutiveFailures = 0;
      this.lastSyncAt = new Date();
      this.emit('synced', { type: 'deployment_records', count: records.length });
      return true;
    } catch (error) {
      this.lastError = error instanceof Error ? error.message : String(error);
      this.consecutiveFailures++;
      this.emit('sync_failed', { type: 'deployment_records', error });
      return false;
    }
  }

  /**
   * 同步效能指标
   */
  async syncMetrics(metrics: EfficiencyMetricsRow[]): Promise<boolean> {
    if (!this.client || !this.connected) {
      this.pendingMetricsRecords.push(...metrics);
      this.emit('degraded', { type: 'metrics', count: metrics.length });
      return false;
    }

    try {
      await this.client.insert({
        table: `${this.config.database}.efficiency_metrics`,
        values: metrics,
      });

      this.consecutiveFailures = 0;
      this.lastSyncAt = new Date();
      this.emit('synced', { type: 'metrics', count: metrics.length });
      return true;
    } catch (error) {
      this.lastError = error instanceof Error ? error.message : String(error);
      this.consecutiveFailures++;
      this.emit('sync_failed', { type: 'metrics', error });
      return false;
    }
  }

  /**
   * 批量刷新待同步记录
   *
   * 在连接恢复后调用，将本地队列中的记录批量写入
   */
  async flushPendingRecords(): Promise<{ metrics: boolean; events: boolean }> {
    let metricsSuccess = true;
    let eventsSuccess = true;

    // 刷新指标记录
    if (this.pendingMetricsRecords.length > 0) {
      const batches = this.splitIntoBatches(this.pendingMetricsRecords, this.batchSize);
      for (const batch of batches) {
        const success = await this.syncMetrics(batch);
        if (!success) {
          metricsSuccess = false;
          break;
        }
      }
      if (metricsSuccess) {
        this.pendingMetricsRecords = [];
      }
    }

    // 刷新事件记录
    if (this.pendingEventRecords.length > 0) {
      const batches = this.splitIntoBatches(this.pendingEventRecords, this.batchSize);
      for (const batch of batches) {
        const success = await this.syncEvents(batch);
        if (!success) {
          eventsSuccess = false;
          break;
        }
      }
      if (eventsSuccess) {
        this.pendingEventRecords = [];
      }
    }

    return { metrics: metricsSuccess, events: eventsSuccess };
  }

  /**
   * 同步事件记录
   */
  private async syncEvents(records: EfficiencyEventRow[]): Promise<boolean> {
    if (!this.client || !this.connected) {
      return false;
    }

    try {
      await this.client.insert({
        table: `${this.config.database}.efficiency_events`,
        values: records,
      });
      return true;
    } catch (error) {
      this.lastError = error instanceof Error ? error.message : String(error);
      this.emit('sync_failed', { type: 'events', error });
      return false;
    }
  }

  /**
   * 获取同步状态
   */
  getStatus(): ClickHouseSyncStatus {
    return {
      connected: this.connected,
      tablesCreated: this.tablesCreated,
      pendingRecords: this.pendingMetricsRecords.length + this.pendingEventRecords.length,
      lastSyncAt: this.lastSyncAt,
      lastError: this.lastError,
      consecutiveFailures: this.consecutiveFailures,
    };
  }

  /**
   * 检查是否健康
   */
  isHealthy(): boolean {
    return this.connected && this.consecutiveFailures < 5;
  }

  /**
   * 关闭连接
   */
  async close(): Promise<void> {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = undefined;
    }

    if (this.client) {
      try {
        await this.client.close();
      } catch {
        // 忽略关闭错误
      }
      this.client = null;
    }

    this.connected = false;
    this.emit('closed');
  }

  /**
   * 获取待同步记录数量
   */
  getPendingCount(): number {
    return this.pendingMetricsRecords.length + this.pendingEventRecords.length;
  }

  /**
   * 将数组分割为多个批次
   */
  private splitIntoBatches<T>(records: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < records.length; i += batchSize) {
      batches.push(records.slice(i, i + batchSize));
    }
    return batches;
  }
}
