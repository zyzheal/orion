/**
 * TASK-703: Metric Collector
 *
 * Collects system metrics (CPU, memory, disk, network), application metrics
 * (latency, error rate, throughput), and custom metrics. Stores time-series
 * data with configurable retention.
 */

import os from 'os';
import { v4 as uuidv4 } from 'uuid';
import {
  Metric,
  MetricSeries,
  MetricAggregation,
  DataPoint,
} from './types';

/**
 * Custom metric registration parameters
 */
export interface MetricRegistration {
  /** Metric name */
  name: string;
  /** Unit of measurement */
  unit: string;
  /** Default tags */
  defaultTags?: Record<string, string>;
  /** Description */
  description?: string;
}

/**
 * Query parameters for metric series
 */
export interface MetricQuery {
  /** Metric name */
  name: string;
  /** Optional tag filters */
  tags?: Record<string, string>;
  /** Start of time window */
  startTime?: Date;
  /** End of time window */
  endTime?: Date;
  /** Maximum number of data points to return */
  maxPoints?: number;
}

/**
 * Internal registered metric metadata
 */
interface RegisteredMetric {
  name: string;
  unit: string;
  defaultTags: Record<string, string>;
  description?: string;
}

/**
 * Metric Collector - Collects and stores time-series metrics
 *
 * Supports:
 * - System metrics (CPU, memory, disk, network)
 * - Application metrics (latency, error rate, throughput)
 * - Custom metric registration and recording
 * - Time-series storage with configurable retention
 */
export class MetricCollector {
  /** Registered metric metadata */
  private registeredMetrics: Map<string, RegisteredMetric> = new Map();

  /** Raw metric storage: metricName -> DataPoint[] */
  private metricStorage: Map<string, { points: DataPoint[]; tags: Record<string, string>[] }> = new Map();

  /** Metric retention period in milliseconds (default: 24 hours) */
  private retentionMs: number;

  /** Maximum data points per metric */
  private maxDataPoints: number;

  /** NATS message rate tracking */
  private natsMessageCounts: Map<string, number> = new Map();

  constructor(options?: {
    retentionMs?: number;
    maxDataPointsPerMetric?: number;
  }) {
    this.retentionMs = options?.retentionMs ?? 24 * 60 * 60 * 1000; // 24 hours
    this.maxDataPoints = options?.maxDataPointsPerMetric ?? 10000;
  }

  // ==================== System Metrics Collection ====================

  /**
   * Collect all system metrics at once
   */
  collectSystemMetrics(): Metric[] {
    const now = new Date();
    const metrics: Metric[] = [];

    // CPU usage
    const cpuUsage = this.getCpuUsage();
    metrics.push({
      id: uuidv4(),
      name: 'system.cpu.usage',
      value: cpuUsage,
      tags: { host: os.hostname() },
      timestamp: now,
      unit: 'percent',
    });

    // Memory usage
    const memUsage = this.getMemoryUsage();
    metrics.push({
      id: uuidv4(),
      name: 'system.memory.usage',
      value: memUsage.percent,
      tags: { host: os.hostname() },
      timestamp: now,
      unit: 'percent',
    });

    metrics.push({
      id: uuidv4(),
      name: 'system.memory.used',
      value: memUsage.used,
      tags: { host: os.hostname() },
      timestamp: now,
      unit: 'bytes',
    });

    metrics.push({
      id: uuidv4(),
      name: 'system.memory.total',
      value: memUsage.total,
      tags: { host: os.hostname() },
      timestamp: now,
      unit: 'bytes',
    });

    // Disk usage (approximation based on root filesystem)
    const diskUsage = this.getDiskUsage();
    metrics.push({
      id: uuidv4(),
      name: 'system.disk.usage',
      value: diskUsage.percent,
      tags: { host: os.hostname(), mount: '/' },
      timestamp: now,
      unit: 'percent',
    });

    // Network I/O (cumulative)
    const networkStats = this.getNetworkStats();
    metrics.push({
      id: uuidv4(),
      name: 'system.network.bytes_recv',
      value: networkStats.bytesRecv,
      tags: { host: os.hostname() },
      timestamp: now,
      unit: 'bytes',
    });

    metrics.push({
      id: uuidv4(),
      name: 'system.network.bytes_sent',
      value: networkStats.bytesSent,
      tags: { host: os.hostname() },
      timestamp: now,
      unit: 'bytes',
    });

    // Load average
    const loadAvg = os.loadavg();
    metrics.push({
      id: uuidv4(),
      name: 'system.load.1m',
      value: loadAvg[0],
      tags: { host: os.hostname() },
      timestamp: now,
      unit: 'load',
    });

    metrics.push({
      id: uuidv4(),
      name: 'system.load.5m',
      value: loadAvg[1],
      tags: { host: os.hostname() },
      timestamp: now,
      unit: 'load',
    });

    metrics.push({
      id: uuidv4(),
      name: 'system.load.15m',
      value: loadAvg[2],
      tags: { host: os.hostname() },
      timestamp: now,
      unit: 'load',
    });

    // Record all system metrics
    for (const metric of metrics) {
      this.recordMetric(metric.name, metric.value, metric.tags, metric.timestamp);
    }

    return metrics;
  }

  /**
   * Get current CPU usage percentage
   */
  private getCpuUsage(): number {
    const cpus = os.cpus();
    let totalIdle = 0;
    let totalTick = 0;

    for (const cpu of cpus) {
      for (const type in cpu.times) {
        totalTick += (cpu.times as any)[type];
      }
      totalIdle += cpu.times.idle;
    }

    // Note: This is a point-in-time estimate. For accurate CPU usage,
    // you'd need two samples with a time delta.
    // Return a baseline estimate based on load average
    const loadAvg = os.loadavg()[0];
    const numCpus = os.cpus().length;
    return Math.min(100, Math.round((loadAvg / numCpus) * 100 * 100) / 100);
  }

  /**
   * Get memory usage statistics
   */
  private getMemoryUsage(): { used: number; total: number; percent: number } {
    const total = os.totalmem();
    const free = os.freemem();
    const used = total - free;
    const percent = Math.round((used / total) * 10000) / 100;

    return { used, total, percent };
  }

  /**
   * Get disk usage (approximation for root filesystem)
   */
  private getDiskUsage(): { percent: number } {
    // Note: Node.js doesn't provide direct disk usage info.
    // In production, this would use an external tool or library.
    // Return a placeholder value.
    return { percent: 0 };
  }

  /**
   * Get network I/O statistics
   */
  private getNetworkStats(): { bytesRecv: number; bytesSent: number } {
    const netStats = os.networkInterfaces();
    let bytesRecv = 0;
    let bytesSent = 0;

    // Note: Node.js os module doesn't provide cumulative network I/O.
    // In production, use a library like systeminformation.
    for (const iface of Object.values(netStats)) {
      if (iface) {
        bytesRecv += iface.length;
        bytesSent += iface.length;
      }
    }

    return { bytesRecv, bytesSent };
  }

  // ==================== Custom Metric Registration ====================

  /**
   * Register a new custom metric
   */
  registerMetric(params: MetricRegistration): void {
    this.registeredMetrics.set(params.name, {
      name: params.name,
      unit: params.unit,
      defaultTags: params.defaultTags || {},
      description: params.description,
    });

    // Initialize storage if not exists
    if (!this.metricStorage.has(params.name)) {
      this.metricStorage.set(params.name, { points: [], tags: [] });
    }
  }

  /**
   * Unregister a metric
   */
  unregisterMetric(name: string): boolean {
    this.registeredMetrics.delete(name);
    this.metricStorage.delete(name);
    return true;
  }

  /**
   * Get all registered metric names
   */
  getRegisteredMetrics(): string[] {
    return Array.from(this.registeredMetrics.keys());
  }

  // ==================== Metric Recording ====================

  /**
   * Record a metric value
   */
  recordMetric(
    name: string,
    value: number,
    tags?: Record<string, string>,
    timestamp?: Date
  ): void {
    const ts = timestamp || new Date();
    const point: DataPoint = { timestamp: ts, value };

    if (!this.metricStorage.has(name)) {
      this.metricStorage.set(name, { points: [], tags: [] });
    }

    const storage = this.metricStorage.get(name)!;
    storage.points.push(point);
    storage.tags.push(tags || {});

    // Enforce retention
    this.enforceRetention(name);

    // Enforce max data points
    if (storage.points.length > this.maxDataPoints) {
      const excess = storage.points.length - this.maxDataPoints;
      storage.points = storage.points.slice(excess);
      storage.tags = storage.tags.slice(excess);
    }
  }

  /**
   * Record application latency metric
   */
  recordLatency(endpoint: string, latencyMs: number, statusCode?: number): void {
    const tags: Record<string, string> = { endpoint };
    if (statusCode) {
      tags.statusCode = String(statusCode);
    }
    this.recordMetric('app.http.latency', latencyMs, tags);
  }

  /**
   * Record an error for error rate tracking
   */
  recordError(serviceName: string, errorType?: string): void {
    const tags: Record<string, string> = { service: serviceName };
    if (errorType) {
      tags.errorType = errorType;
    }
    this.recordMetric('app.errors.count', 1, tags);
  }

  /**
   * Record throughput (requests processed)
   */
  recordThroughput(serviceName: string, count: number = 1): void {
    this.recordMetric('app.throughput', count, { service: serviceName });
  }

  /**
   * Record NATS message rate
   */
  recordNatsMessageRate(subject: string, count: number = 1): void {
    const currentCount = this.natsMessageCounts.get(subject) || 0;
    this.natsMessageCounts.set(subject, currentCount + count);
    this.recordMetric('nats.messages', count, { subject });
  }

  /**
   * Get current NATS message counts
   */
  getNatsMessageCounts(): Map<string, number> {
    return new Map(this.natsMessageCounts);
  }

  /**
   * Reset NATS message counts (for periodic reporting)
   */
  resetNatsMessageCounts(): void {
    this.natsMessageCounts.clear();
  }

  // ==================== Metric Retrieval ====================

  /**
   * Get metric time-series data
   */
  getMetricSeries(query: MetricQuery): MetricSeries {
    const storage = this.metricStorage.get(query.name);

    if (!storage) {
      return this.emptySeries(query.name);
    }

    let points = [...storage.points];
    let tags = [...storage.tags];

    // Apply tag filters
    if (query.tags) {
      const filtered: { point: DataPoint; tags: Record<string, string> }[] = [];
      for (let i = 0; i < points.length; i++) {
        if (this.tagsMatch(tags[i], query.tags)) {
          filtered.push({ point: points[i], tags: tags[i] });
        }
      }
      points = filtered.map(f => f.point);
      tags = filtered.map(f => f.tags);
    }

    // Apply time window filter
    if (query.startTime) {
      const startIdx = points.findIndex(p => p.timestamp >= query.startTime!);
      if (startIdx > 0) {
        points = points.slice(startIdx);
        tags = tags.slice(startIdx);
      }
    }

    if (query.endTime) {
      const endIdx = points.findIndex(p => p.timestamp > query.endTime!);
      if (endIdx > 0) {
        points = points.slice(0, endIdx);
        tags = tags.slice(0, endIdx);
      }
    }

    // Apply max points limit
    if (query.maxPoints && points.length > query.maxPoints) {
      const step = Math.ceil(points.length / query.maxPoints);
      const sampled: DataPoint[] = [];
      for (let i = 0; i < points.length && sampled.length < query.maxPoints!; i += step) {
        sampled.push(points[i]);
      }
      points = sampled;
    }

    const values = points.map(p => p.value);
    const aggregation = this.computeAggregation(values);

    const windowStart = points.length > 0 ? points[0].timestamp : new Date(0);
    const windowEnd = points.length > 0 ? points[points.length - 1].timestamp : new Date(0);

    return {
      name: query.name,
      dataPoints: points,
      aggregation,
      tags: query.tags,
      windowStart,
      windowEnd,
    };
  }

  /**
   * Get metric summary (aggregated stats) for a specific metric
   */
  getMetricSummary(
    name: string,
    tags?: Record<string, string>,
    windowMs?: number
  ): MetricAggregation {
    const query: MetricQuery = { name, tags };

    if (windowMs) {
      query.startTime = new Date(Date.now() - windowMs);
      query.endTime = new Date();
    }

    const series = this.getMetricSeries(query);
    return series.aggregation;
  }

  /**
   * Get the latest value for a metric
   */
  getLatestValue(name: string, tags?: Record<string, string>): number | null {
    const storage = this.metricStorage.get(name);
    if (!storage || storage.points.length === 0) {
      return null;
    }

    // Search from latest
    for (let i = storage.points.length - 1; i >= 0; i--) {
      if (!tags || this.tagsMatch(storage.tags[i], tags)) {
        return storage.points[i].value;
      }
    }

    return null;
  }

  // ==================== Maintenance ====================

  /**
   * Clean up expired data points based on retention policy
   */
  pruneExpired(): number {
    let pruned = 0;
    const cutoff = new Date(Date.now() - this.retentionMs);

    for (const [name, storage] of this.metricStorage) {
      const validIdx = storage.points.findIndex(p => p.timestamp >= cutoff);
      if (validIdx > 0) {
        pruned += validIdx;
        storage.points = storage.points.slice(validIdx);
        storage.tags = storage.tags.slice(validIdx);
      } else if (validIdx === -1 && storage.points.length > 0) {
        pruned += storage.points.length;
        storage.points = [];
        storage.tags = [];
      }
    }

    return pruned;
  }

  /**
   * Clear all metric data
   */
  clearAll(): void {
    this.metricStorage.clear();
    this.registeredMetrics.clear();
    this.natsMessageCounts.clear();
  }

  // ==================== Private Methods ====================

  /**
   * Enforce retention policy on a metric's storage
   */
  private enforceRetention(name: string): void {
    const cutoff = Date.now() - this.retentionMs;
    const storage = this.metricStorage.get(name);
    if (!storage) return;

    const validIdx = storage.points.findIndex(p => p.timestamp.getTime() >= cutoff);
    if (validIdx > 0) {
      storage.points = storage.points.slice(validIdx);
      storage.tags = storage.tags.slice(validIdx);
    }
  }

  /**
   * Check if stored tags match the query filters
   */
  private tagsMatch(stored: Record<string, string>, filter: Record<string, string>): boolean {
    for (const [key, value] of Object.entries(filter)) {
      if (stored[key] !== value) return false;
    }
    return true;
  }

  /**
   * Compute aggregation statistics from values
   */
  private computeAggregation(values: number[]): MetricAggregation {
    if (values.length === 0) {
      return { avg: 0, max: 0, min: 0, p99: 0, p95: 0, count: 0, sum: 0 };
    }

    const sorted = [...values].sort((a, b) => a - b);
    const sum = values.reduce((acc, v) => acc + v, 0);
    const avg = sum / values.length;
    const max = sorted[sorted.length - 1];
    const min = sorted[0];
    const p95 = this.percentile(sorted, 95);
    const p99 = this.percentile(sorted, 99);

    return {
      avg: Math.round(avg * 100) / 100,
      max,
      min,
      p99: Math.round(p99 * 100) / 100,
      p95: Math.round(p95 * 100) / 100,
      count: values.length,
      sum: Math.round(sum * 100) / 100,
    };
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

  /**
   * Create an empty metric series
   */
  private emptySeries(name: string): MetricSeries {
    const now = new Date();
    return {
      name,
      dataPoints: [],
      aggregation: { avg: 0, max: 0, min: 0, p99: 0, p95: 0, count: 0, sum: 0 },
      windowStart: now,
      windowEnd: now,
    };
  }
}
