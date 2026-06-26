/**
 * TASK-703: Monitoring Dashboard
 *
 * Generates time-series data for dashboards, aggregate statistics
 * over time windows, and anomaly detection using statistical methods (z-score).
 */

import { v4 as uuidv4 } from 'uuid';
import {
  MetricSeries,
  MetricAggregation,
  DashboardWidget,
  DashboardData,
  AnomalyResult,
  AlertSeverity,
} from './types';
import { MetricCollector } from './MetricCollector';
import { MonitoringWidgetConfigRepository, MonitoringWidgetConfigEntity } from '../../repositories/MonitoringWidgetConfigRepository';

/**
 * Time window for aggregation
 */
export type TimeWindow = '1m' | '5m' | '15m' | '1h' | '6h' | '24h' | '7d';

/**
 * Widget configuration for dashboard generation
 */
export interface WidgetConfig {
  /** Widget title */
  title: string;
  /** Metric names to include */
  metrics: string[];
  /** Time window for data */
  timeWindow: TimeWindow;
  /** Optional tag filter */
  tags?: Record<string, string>;
}

/**
 * Convert time window string to milliseconds
 */
function timeWindowToMs(window: TimeWindow): number {
  const map: Record<TimeWindow, number> = {
    '1m': 60 * 1000,
    '5m': 5 * 60 * 1000,
    '15m': 15 * 60 * 1000,
    '1h': 60 * 60 * 1000,
    '6h': 6 * 60 * 60 * 1000,
    '24h': 24 * 60 * 60 * 1000,
    '7d': 7 * 24 * 60 * 60 * 1000,
  };
  return map[window] ?? map['1h'];
}

/**
 * Monitoring Dashboard - Generates dashboard data for visualization
 *
 * Supports:
 * - Time-series data generation for chart widgets
 * - Aggregated statistics over configurable time windows
 * - Anomaly detection using z-score statistical method
 */
export class MonitoringDashboard {
  /** Reference to metric collector */
  private metricCollector: MetricCollector;

  /** Default z-score threshold for anomaly detection */
  private anomalyThreshold: number;

  /** Widget configurations repository */
  private widgetConfigRepository?: MonitoringWidgetConfigRepository;

  /** In-memory fallback for widget configs */
  private widgetConfigsMemory: WidgetConfig[] = [];

  constructor(
    metricCollector: MetricCollector,
    options?: { anomalyThreshold?: number; db?: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> } },
  ) {
    this.metricCollector = metricCollector;
    this.anomalyThreshold = options?.anomalyThreshold ?? 2.5;
    if (options?.db) {
      this.widgetConfigRepository = new MonitoringWidgetConfigRepository(options.db);
    }
  }

  // ==================== Dashboard Data Generation ====================

  /**
   * Add a widget configuration
   */
  async addWidgetConfig(config: WidgetConfig): Promise<void> {
    if (this.widgetConfigRepository) {
      try {
        await this.widgetConfigRepository.create({
          id: uuidv4(),
          tenantId: 'default',
          title: config.title,
          metrics: config.metrics,
          timeWindow: config.timeWindow,
          tags: config.tags || {},
          sortOrder: this.widgetConfigsMemory.length,
        });
      } catch (err) {
        this.widgetConfigsMemory.push(config);
      }
    } else {
      this.widgetConfigsMemory.push(config);
    }
  }

  /**
   * Remove a widget configuration
   */
  async removeWidgetConfig(index: number): Promise<void> {
    if (this.widgetConfigRepository) {
      const configs = await this.getWidgetConfigs();
      if (index >= 0 && index < configs.length) {
        const config = configs[index];
        // Find by matching title and metrics (since we don't have a direct ID mapping)
        const entities = await this.widgetConfigRepository.findByTenantId('default');
        const entity = entities.find(e => e.title === config.title);
        if (entity) {
          await this.widgetConfigRepository.delete(entity.id);
        }
      }
    } else {
      this.widgetConfigsMemory.splice(index, 1);
    }
  }

  /**
   * Get all widget configurations
   */
  async getWidgetConfigs(): Promise<WidgetConfig[]> {
    if (this.widgetConfigRepository) {
      const entities = await this.widgetConfigRepository.findByTenantId('default');
      return entities.map(e => ({
        title: e.title,
        metrics: e.metrics,
        timeWindow: e.timeWindow as TimeWindow,
        tags: Object.keys(e.tags).length > 0 ? e.tags : undefined,
      }));
    }
    return [...this.widgetConfigsMemory];
  }

  /**
   * Generate complete dashboard data
   */
  async getDashboardData(
    activeAlertCounts?: Record<AlertSeverity, number>
  ): Promise<DashboardData> {
    const widgets: DashboardWidget[] = [];
    const configs = await this.getWidgetConfigs();

    for (const config of configs) {
      const widget = this.generateWidget(config);
      widgets.push(widget);
    }

    // Calculate health score
    const healthScore = this.calculateHealthScore(activeAlertCounts);

    // Detect anomalies across all metrics
    const anomalies = this.detectAllAnomalies();

    return {
      widgets,
      healthScore,
      activeAlerts: activeAlertCounts || { critical: 0, warning: 0, info: 0 },
      anomalies,
      generatedAt: new Date(),
    };
  }

  /**
   * Generate data for a single widget
   */
  private generateWidget(config: WidgetConfig): DashboardWidget {
    const series: MetricSeries[] = [];
    const windowMs = timeWindowToMs(config.timeWindow);

    for (const metricName of config.metrics) {
      const metricSeries = this.metricCollector.getMetricSeries({
        name: metricName,
        tags: config.tags,
        startTime: new Date(Date.now() - windowMs),
        endTime: new Date(),
      });
      series.push(metricSeries);
    }

    // Get current value (latest from first series)
    const currentValue = series.length > 0 && series[0].dataPoints.length > 0
      ? series[0].dataPoints[series[0].dataPoints.length - 1].value
      : undefined;

    // Calculate trend
    const trend = this.calculateTrend(series);

    return {
      title: config.title,
      metrics: config.metrics,
      series,
      currentValue,
      trend,
      hasAnomaly: false, // Will be updated in detectAnomalies
    };
  }

  /**
   * Calculate trend direction from series data
   */
  private calculateTrend(series: MetricSeries[]): 'up' | 'down' | 'stable' {
    if (series.length === 0) return 'stable';

    const points = series[0].dataPoints;
    if (points.length < 2) return 'stable';

    // Compare last value to average
    const lastValue = points[points.length - 1].value;
    const values = points.map(p => p.value);
    const avg = values.reduce((a, b) => a + b, 0) / values.length;

    if (avg === 0) return 'stable';

    const changePercent = ((lastValue - avg) / avg) * 100;

    if (changePercent > 10) return 'up';
    if (changePercent < -10) return 'down';
    return 'stable';
  }

  // ==================== Aggregated Metrics ====================

  /**
   * Get aggregated metrics for a time window
   */
  getAggregatedMetrics(
    metricNames: string[],
    timeWindow: TimeWindow = '1h',
    tags?: Record<string, string>
  ): { name: string; aggregation: MetricAggregation }[] {
    const windowMs = timeWindowToMs(timeWindow);
    const results: { name: string; aggregation: MetricAggregation }[] = [];

    for (const name of metricNames) {
      const aggregation = this.metricCollector.getMetricSummary(name, tags, windowMs);
      results.push({ name, aggregation });
    }

    return results;
  }

  /**
   * Get metric comparison across multiple time windows
   */
  getMetricComparison(
    metricName: string,
    windows: TimeWindow[] = ['1h', '6h', '24h'],
    tags?: Record<string, string>
  ): { window: TimeWindow; aggregation: MetricAggregation }[] {
    return windows.map(window => {
      const windowMs = timeWindowToMs(window);
      const aggregation = this.metricCollector.getMetricSummary(metricName, tags, windowMs);
      return { window, aggregation };
    });
  }

  // ==================== Anomaly Detection ====================

  /**
   * Detect anomalies in a specific metric using z-score
   *
   * Z-score measures how many standard deviations a data point
   * is from the mean. Points with |z-score| > threshold are anomalies.
   */
  detectAnomalies(
    metricName: string,
    timeWindow: TimeWindow = '1h',
    tags?: Record<string, string>,
    threshold?: number
  ): AnomalyResult[] {
    const zThreshold = threshold ?? this.anomalyThreshold;
    const windowMs = timeWindowToMs(timeWindow);

    const series = this.metricCollector.getMetricSeries({
      name: metricName,
      tags,
      startTime: new Date(Date.now() - windowMs),
      endTime: new Date(),
    });

    if (series.dataPoints.length < 3) {
      return [];
    }

    const values = series.dataPoints.map(p => p.value);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
    const stdDev = Math.sqrt(variance);

    if (stdDev === 0) {
      // All values are the same, no anomalies
      return [];
    }

    const anomalies: AnomalyResult[] = [];

    for (let i = 0; i < series.dataPoints.length; i++) {
      const point = series.dataPoints[i];
      const zScore = (point.value - mean) / stdDev;
      const absZScore = Math.abs(zScore);

      if (absZScore >= zThreshold) {
        anomalies.push({
          metric: metricName,
          timestamp: point.timestamp,
          value: point.value,
          expectedValue: Math.round(mean * 100) / 100,
          zScore: Math.round(zScore * 100) / 100,
          isAnomaly: true,
        });
      }
    }

    return anomalies;
  }

  /**
   * Detect anomalies across all registered metrics
   */
  detectAllAnomalies(): AnomalyResult[] {
    const allAnomalies: AnomalyResult[] = [];
    const registeredMetrics = this.metricCollector.getRegisteredMetrics();

    for (const metricName of registeredMetrics) {
      const anomalies = this.detectAnomalies(metricName, '1h');
      allAnomalies.push(...anomalies);
    }

    // Also check system metrics
    const systemMetrics = [
      'system.cpu.usage',
      'system.memory.usage',
      'system.load.1m',
    ];

    for (const metricName of systemMetrics) {
      const anomalies = this.detectAnomalies(metricName, '1h');
      allAnomalies.push(...anomalies);
    }

    return allAnomalies;
  }

  /**
   * Get anomaly summary for dashboard
   */
  getAnomalySummary(): {
    totalAnomalies: number;
    byMetric: Record<string, number>;
    maxZScore: number;
    recentAnomalies: AnomalyResult[];
  } {
    const anomalies = this.detectAllAnomalies();

    const byMetric: Record<string, number> = {};
    let maxZScore = 0;

    for (const anomaly of anomalies) {
      byMetric[anomaly.metric] = (byMetric[anomaly.metric] || 0) + 1;
      if (Math.abs(anomaly.zScore) > maxZScore) {
        maxZScore = Math.abs(anomaly.zScore);
      }
    }

    return {
      totalAnomalies: anomalies.length,
      byMetric,
      maxZScore: Math.round(maxZScore * 100) / 100,
      recentAnomalies: anomalies.slice(-10),
    };
  }

  // ==================== Health Score ====================

  /**
   * Calculate overall system health score (0-100)
   *
   * Factors:
   * - Active alert count and severity
   * - Anomaly count
   * - CPU/Memory usage
   */
  private calculateHealthScore(
    activeAlertCounts?: Record<AlertSeverity, number>
  ): number {
    let score = 100;

    // Deduct for active alerts
    if (activeAlertCounts) {
      score -= (activeAlertCounts.critical || 0) * 20;
      score -= (activeAlertCounts.warning || 0) * 10;
      score -= (activeAlertCounts.info || 0) * 2;
    }

    // Check CPU usage
    const cpuUsage = this.metricCollector.getLatestValue('system.cpu.usage');
    if (cpuUsage !== null) {
      if (cpuUsage > 90) score -= 15;
      else if (cpuUsage > 75) score -= 5;
    }

    // Check memory usage
    const memUsage = this.metricCollector.getLatestValue('system.memory.usage');
    if (memUsage !== null) {
      if (memUsage > 90) score -= 15;
      else if (memUsage > 75) score -= 5;
    }

    // Deduct for anomalies
    const anomalies = this.detectAllAnomalies();
    score -= anomalies.length * 2;

    return Math.max(0, Math.min(100, Math.round(score)));
  }

  // ==================== Configuration ====================

  /**
   * Update anomaly detection threshold
   */
  setAnomalyThreshold(threshold: number): void {
    this.anomalyThreshold = threshold;
  }

  /**
   * Clear widget configurations
   */
  async clearWidgetConfigs(): Promise<void> {
    if (this.widgetConfigRepository) {
      await this.widgetConfigRepository.deleteByTenant('default');
    }
    this.widgetConfigsMemory = [];
  }
}
