/**
 * MetricStreamService - Real-time metrics streaming via SSE
 *
 * Provides:
 * - streamMetrics(serviceName, metricType) - SSE stream of real-time metrics
 * - getMetricHistory(serviceName, metricType, timeRange) - historical metrics
 * - aggregateMetrics(metricType, aggregation, timeRange) - avg/min/max/sum aggregation
 *
 * Uses MetricCollector for in-memory real-time access and PostgreSQL
 * for historical data (30-day retention).
 */

import { EventEmitter } from 'events';
import { FastifyReply } from 'fastify';
import { v4 as uuidv4 } from 'uuid';
import { createLogger } from '../../utils/logger';
import { MetricCollector } from './MetricCollector';
import { PostgresMetricStorageRepository } from './MetricStorageRepository';
import { getCurrentTenantId, getCurrentTraceId } from '../../db/tenant-context-storage';

const logger = createLogger('LMetric-LStream-LService');

// ==================== Types ====================

export type MetricType =
  | 'cpu_usage'
  | 'memory_usage'
  | 'disk_usage'
  | 'network_io'
  | 'request_count'
  | 'request_duration'
  | 'error_rate'
  | 'pipeline_duration'
  | 'stage_duration'
  | 'task_duration';

export type AggregationType = 'avg' | 'min' | 'max' | 'sum' | 'p95' | 'p99' | 'count';

export interface MetricStreamOptions {
  /** Metric name to stream */
  metric: string;
  /** Tags filter */
  tags?: Record<string, string>;
  /** Polling interval in ms (default 5000) */
  intervalMs?: number;
}

export interface MetricHistoryOptions {
  /** Metric name */
  metric: string;
  /** Start time */
  startTime: Date;
  /** End time */
  endTime: Date;
  /** Tags filter */
  tags?: Record<string, string>;
  /** Max data points */
  maxPoints?: number;
}

export interface MetricAggregateOptions {
  /** Metric name */
  metric: string;
  /** Aggregation type */
  aggregation: AggregationType;
  /** Start time */
  startTime: Date;
  /** End time */
  endTime: Date;
  /** Tags filter */
  tags?: Record<string, string>;
  /** Bucket size in ms (default: 1 minute) */
  bucketMs?: number;
}

export interface MetricDataPoint {
  timestamp: Date;
  value: number;
  tags?: Record<string, string>;
}

export interface MetricAggregatedBucket {
  bucket: Date;
  value: number;
  count: number;
}

export interface SSEConnection {
  id: string;
  reply: FastifyReply;
  connectedAt: Date;
  lastEventAt: Date;
}

// ==================== MetricStreamService ====================

export class MetricStreamService extends EventEmitter {
  private metricCollector: MetricCollector;
  private metricRepo?: PostgresMetricStorageRepository;

  // SSE connections: connectionId -> connection
  private connections: Map<string, SSEConnection> = new Map();

  // Active streaming intervals: connectionId -> timer
  private streamIntervals: Map<string, ReturnType<typeof setInterval>> = new Map();

  // Default intervals
  private readonly DEFAULT_STREAM_INTERVAL_MS = 5000;
  private readonly HEARTBEAT_INTERVAL_MS = 30_000;
  private readonly MAX_CONNECTIONS = 500;

  constructor(
    metricCollector: MetricCollector,
    metricRepo?: PostgresMetricStorageRepository
  ) {
    super();
    this.metricCollector = metricCollector;
    this.metricRepo = metricRepo;
  }

  // ==================== SSE Streaming ====================

  /**
   * Create an SSE connection for real-time metric streaming.
   * Returns the connection ID for cleanup.
   */
  async createStreamConnection(
    options: MetricStreamOptions,
    reply: FastifyReply
  ): Promise<string> {
    // Enforce connection limit
    if (this.connections.size >= this.MAX_CONNECTIONS) {
      // Close oldest connection
      const oldestId = this.connections.keys().next().value;
      if (oldestId) {
        await this.closeConnection(oldestId);
      }
    }

    const connId = `metric-stream-${uuidv4()}`;
    const now = new Date();

    const conn: SSEConnection = {
      id: connId,
      reply,
      connectedAt: now,
      lastEventAt: now,
    };

    this.connections.set(connId, conn);

    // Set SSE headers
    reply.header('Content-Type', 'text/event-stream');
    reply.header('Cache-Control', 'no-cache');
    reply.header('Connection', 'keep-alive');
    reply.header('X-Accel-Buffering', 'no');

    // Send initial connection event
    this.sendSSEEvent(reply, 'connected', {
      connectionId: connId,
      metric: options.metric,
      timestamp: now,
    });

    // Start streaming interval
    const intervalMs = options.intervalMs ?? this.DEFAULT_STREAM_INTERVAL_MS;
    const interval = setInterval(async () => {
      await this.streamMetricDataPoint(connId, options);
    }, intervalMs);

    this.streamIntervals.set(connId, interval);

    // Send initial data point immediately
    await this.streamMetricDataPoint(connId, options);

    // Setup disconnect handler
    reply.raw.on('close', async () => {
      await this.closeConnection(connId);
    });

    logger.info({ traceId: getCurrentTraceId(), connId, metric: options.metric }, '[MetricStreamService] SSE connection created');

    return connId;
  }

  /**
   * Close an SSE connection and clean up interval
   */
  async closeConnection(connId: string): Promise<void> {
    const conn = this.connections.get(connId);
    if (conn) {
      const raw = conn.reply.raw;
      if (raw && !raw.writableEnded) {
        try {
          raw.end();
        } catch (err) {
          // ignore
        }
      }
      this.connections.delete(connId);
    }

    const interval = this.streamIntervals.get(connId);
    if (interval) {
      clearInterval(interval);
      this.streamIntervals.delete(connId);
    }
  }

  /**
   * Close all SSE connections
   */
  async closeAllConnections(): Promise<void> {
    const ids = Array.from(this.connections.keys());
    for (const id of ids) {
      await this.closeConnection(id);
    }
  }

  /**
   * Stream a single data point to a specific connection
   */
  private async streamMetricDataPoint(connId: string, options: MetricStreamOptions): Promise<void> {
    const conn = this.connections.get(connId);
    if (!conn) return;

    const raw = conn.reply.raw;
    if (raw?.writableEnded) {
      await this.closeConnection(connId);
      return;
    }

    try {
      const point = await this.getCurrentMetricPoint(options.metric, options.tags);
      if (point) {
        this.sendSSEEvent(conn.reply, 'metric', point);
        conn.lastEventAt = new Date();
      }
    } catch (err) {
      logger.warn({ traceId: getCurrentTraceId(), err, connId }, '[MetricStreamService] Failed to stream metric data point');
    }
  }

  /**
   * Get the current metric data point from in-memory cache or repository
   */
  private async getCurrentMetricPoint(metricName: string, tags?: Record<string, string>): Promise<MetricDataPoint | null> {
    // Try in-memory first (real-time)
    const latestValue = this.metricCollector.getLatestValue(metricName, tags);
    if (latestValue !== null) {
      return {
        timestamp: new Date(),
        value: latestValue,
        tags,
      };
    }

    // Fall back to repository
    if (this.metricRepo) {
      try {
        const value = await this.metricRepo.getLatestValue(metricName, tags, getCurrentTenantId());
        if (value !== null) {
          return {
            timestamp: new Date(),
            value,
            tags,
          };
        }
      } catch (err) {
        // ignore
      }
    }

    return null;
  }

  // ==================== Historical Data ====================

  /**
   * Get metric history for a time range from PostgreSQL
   */
  async getMetricHistory(options: MetricHistoryOptions): Promise<MetricDataPoint[]> {
    if (!this.metricRepo) {
      // Fall back to in-memory
      const series = this.metricCollector.getMetricSeries({
        name: options.metric,
        tags: options.tags,
        startTime: options.startTime,
        endTime: options.endTime,
        maxPoints: options.maxPoints,
      });
      return series.dataPoints.map(p => ({
        timestamp: p.timestamp,
        value: p.value,
        tags: options.tags,
      }));
    }

    try {
      const series = await this.metricRepo.queryMetricSeries(
        {
          name: options.metric,
          tags: options.tags,
          startTime: options.startTime,
          endTime: options.endTime,
          maxPoints: options.maxPoints,
        },
        getCurrentTenantId()
      );

      return series.dataPoints.map(p => ({
        timestamp: p.timestamp,
        value: p.value,
        tags: options.tags,
      }));
    } catch (err) {
      logger.error({ traceId: getCurrentTraceId(), err, metric: options.metric }, '[MetricStreamService] Failed to get metric history');
      return [];
    }
  }

  // ==================== Aggregation ====================

  /**
   * Aggregate metrics over a time range
   */
  async aggregateMetrics(options: MetricAggregateOptions): Promise<MetricAggregatedBucket[]> {
    if (!this.metricRepo) {
      // Fall back to in-memory
      return this.aggregateInMemory(options);
    }

    try {
      const history = await this.getMetricHistory({
        metric: options.metric,
        startTime: options.startTime,
        endTime: options.endTime,
        tags: options.tags,
      });

      return this.computeBuckets(history, options);
    } catch (err) {
      logger.error({ traceId: getCurrentTraceId(), err, metric: options.metric }, '[MetricStreamService] Failed to aggregate metrics');
      return [];
    }
  }

  /**
   * Aggregate using in-memory data
   */
  private aggregateInMemory(options: MetricAggregateOptions): MetricAggregatedBucket[] {
    const series = this.metricCollector.getMetricSeries({
      name: options.metric,
      tags: options.tags,
      startTime: options.startTime,
      endTime: options.endTime,
    });

    return this.computeBuckets(
      series.dataPoints.map(p => ({ timestamp: p.timestamp, value: p.value, tags: options.tags })),
      options
    );
  }

  /**
   * Compute aggregation buckets from data points
   */
  private computeBuckets(points: MetricDataPoint[], options: MetricAggregateOptions): MetricAggregatedBucket[] {
    if (points.length === 0) {
      return [];
    }

    const bucketMs = options.bucketMs || 60_000; // 1 minute default
    const buckets = new Map<number, number[]>();

    // Assign points to buckets
    for (const point of points) {
      const bucketKey = Math.floor(point.timestamp.getTime() / bucketMs) * bucketMs;
      if (!buckets.has(bucketKey)) {
        buckets.set(bucketKey, []);
      }
      buckets.get(bucketKey)!.push(point.value);
    }

    // Compute aggregation per bucket
    const result: MetricAggregatedBucket[] = [];
    for (const [bucketKey, values] of buckets) {
      const aggregated = this.computeAggregation(values, options.aggregation);
      result.push({
        bucket: new Date(bucketKey),
        value: aggregated,
        count: values.length,
      });
    }

    // Sort by bucket time
    result.sort((a, b) => a.bucket.getTime() - b.bucket.getTime());

    return result;
  }

  /**
   * Compute a single aggregation value from a set of values
   */
  private computeAggregation(values: number[], type: AggregationType): number {
    if (values.length === 0) return 0;

    const sorted = [...values].sort((a, b) => a - b);
    const sum = values.reduce((acc, v) => acc + v, 0);
    const avg = sum / values.length;

    switch (type) {
      case 'avg':
        return Math.round(avg * 100) / 100;
      case 'sum':
        return Math.round(sum * 100) / 100;
      case 'min':
        return sorted[0];
      case 'max':
        return sorted[sorted.length - 1];
      case 'count':
        return values.length;
      case 'p95':
        return this.percentile(sorted, 95);
      case 'p99':
        return this.percentile(sorted, 99);
      default:
        return avg;
    }
  }

  /**
   * Calculate percentile from sorted array
   */
  private percentile(sorted: number[], p: number): number {
    if (sorted.length === 0) return 0;
    if (sorted.length === 1) return sorted[0];

    const index = (p / 100) * (sorted.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);

    if (lower === upper) return sorted[lower];

    const weight = index - lower;
    return sorted[lower] * (1 - weight) + sorted[upper] * weight;
  }

  // ==================== Utility Methods ====================

  /**
   * Send an SSE event to the client
   */
  private sendSSEEvent(reply: FastifyReply, event: string, data: unknown): void {
    const raw = reply.raw;
    if (raw?.writableEnded) return;

    try {
      const payload = JSON.stringify(data);
      raw.write(`event: ${event}\n`);
      raw.write(`data: ${payload}\n\n`);
    } catch (err) {
      logger.warn({ traceId: getCurrentTraceId(), err }, '[MetricStreamService] Failed to send SSE event');
    }
  }

  /**
   * Get active connection count
   */
  getConnectionCount(): number {
    return this.connections.size;
  }

  /**
   * Get all active connection IDs
   */
  getConnectionIds(): string[] {
    return Array.from(this.connections.keys());
  }
}
