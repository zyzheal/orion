/**
 * CostAnomalyDetectionService - 成本异常检测服务
 *
 * Phase 2: 检测成本数据中的异常点，使用统计方法（Z-score、移动平均）
 * 识别成本突增、异常波动等场景。
 */
import pino from 'pino';
import { DatabasePool } from '../database';
import { v4 as uuidv4 } from 'uuid';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

export enum AnomalyType {
  SPIKE = 'spike',          // 成本突增
  DROP = 'drop',            // 成本突降
  TREND_CHANGE = 'trend_change', // 趋势变化
  SUSTAINED_HIGH = 'sustained_high', // 持续高位
}

export interface CostRecord {
  id: string;
  tenantId: string;
  amount: number;
  category: string;
  resourceId?: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface AnomalyRecord {
  id: string;
  tenantId: string;
  type: AnomalyType;
  severity: 'low' | 'medium' | 'high' | 'critical';
  value: number;
  expectedValue: number;
  deviation: number; // percentage deviation
  detectedAt: Date;
  timeWindowStart: Date;
  timeWindowEnd: Date;
  description: string;
  metadata?: Record<string, any>;
}

export interface AnomalyDetectionResult {
  anomalies: AnomalyRecord[];
  timeWindow: { start: Date; end: Date };
  dataPointsAnalyzed: number;
  detectedAt: Date;
}

export interface CostTrendPoint {
  date: string;
  cost: number;
}

export interface CostTrendResult {
  points: CostTrendPoint[];
  totalCost: number;
  averageCost: number;
  trend: 'increasing' | 'decreasing' | 'stable';
  changeRate: number;
}

export interface CostForecastResult {
  predictedEndOfMonthCost: number;
  currentSpend: number;
  projectedOverage: number;
  confidence: number; // 0-1
  dailyForecast: Array<{ date: string; predicted: number }>;
  generatedAt: Date;
}

export class CostAnomalyDetectionService {
  private pool: DatabasePool;
  private zScoreThreshold: number;
  private spikeThreshold: number;

  constructor(
    db: DatabasePool,
    options?: { zScoreThreshold?: number; spikeThreshold?: number },
  ) {
    this.pool = db;
    this.zScoreThreshold = options?.zScoreThreshold ?? 2.0;
    this.spikeThreshold = options?.spikeThreshold ?? 50; // percentage
    this.ensureTable();
  }

  /**
   * 记录成本数据
   */
  async recordCost(
    tenantId: string,
    cost: { amount: number; category: string; resourceId?: string; metadata?: Record<string, any> },
  ): Promise<CostRecord> {
    const id = `cost_${uuidv4()}`;
    const now = new Date();

    await this.pool.query(
      `INSERT INTO cost_records (id, tenant_id, amount, category, resource_id, timestamp, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        id,
        tenantId,
        cost.amount,
        cost.category,
        cost.resourceId || null,
        now,
        cost.metadata ? JSON.stringify(cost.metadata) : null,
      ],
    );

    return {
      id,
      tenantId,
      amount: cost.amount,
      category: cost.category,
      resourceId: cost.resourceId,
      timestamp: now,
      metadata: cost.metadata,
    };
  }

  /**
   * 检测成本异常
   * 使用 Z-score 方法检测统计异常点
   */
  async detectAnomalies(
    tenantId: string,
    timeWindow: { start: Date; end: Date },
  ): Promise<AnomalyDetectionResult> {
    const records = await this.getCostRecords(tenantId, timeWindow.start, timeWindow.end);

    if (records.length < 3) {
      return {
        anomalies: [],
        timeWindow,
        dataPointsAnalyzed: records.length,
        detectedAt: new Date(),
      };
    }

    const anomalies: AnomalyRecord[] = [];

    // Group by day for analysis
    const dailyMap = new Map<string, { total: number; count: number; records: typeof records }>();
    for (const record of records) {
      const dayKey = record.timestamp.toISOString().split('T')[0];
      if (!dailyMap.has(dayKey)) {
        dailyMap.set(dayKey, { total: 0, count: 0, records: [] });
      }
      const day = dailyMap.get(dayKey)!;
      day.total += record.amount;
      day.count++;
      day.records.push(record);
    }

    const dailyPoints = Array.from(dailyMap.entries())
      .map(([date, data]) => ({ date, total: data.total, count: data.count, records: data.records }))
      .sort((a, b) => a.date.localeCompare(b.date));

    if (dailyPoints.length < 3) {
      return {
        anomalies: [],
        timeWindow,
        dataPointsAnalyzed: records.length,
        detectedAt: new Date(),
      };
    }

    const costs = dailyPoints.map(p => p.total);
    const mean = costs.reduce((sum, c) => sum + c, 0) / costs.length;
    const variance = costs.reduce((sum, c) => sum + Math.pow(c - mean, 2), 0) / costs.length;
    const stdDev = Math.sqrt(variance);

    for (let i = 0; i < dailyPoints.length; i++) {
      const point = dailyPoints[i];
      const zScore = stdDev > 0 ? (point.total - mean) / stdDev : 0;

      if (Math.abs(zScore) > this.zScoreThreshold) {
        const deviation = mean > 0 ? ((point.total - mean) / mean) * 100 : 0;
        const isSpike = zScore > 0;

        const severity = this.calculateSeverity(Math.abs(zScore), Math.abs(deviation));
        const anomalyType = isSpike ? AnomalyType.SPIKE : AnomalyType.DROP;

        // Check for sustained high costs (3+ consecutive days above threshold)
        if (isSpike && this.isSustainedHigh(dailyPoints, i, mean, stdDev)) {
          // Will be handled by sustained high detection below
        }

        const anomaly: AnomalyRecord = {
          id: `anomaly_${uuidv4()}`,
          tenantId,
          type: anomalyType,
          severity,
          value: point.total,
          expectedValue: Math.round(mean * 100) / 100,
          deviation: Math.round(deviation * 100) / 100,
          detectedAt: new Date(),
          timeWindowStart: new Date(point.date),
          timeWindowEnd: new Date(point.date + 'T23:59:59Z'),
          description: `${isSpike ? 'Cost spike' : 'Cost drop'} detected on ${point.date}: $${point.total.toFixed(2)} (expected ~$${mean.toFixed(2)}, z-score: ${zScore.toFixed(2)})`,
          metadata: { zScore: Math.round(zScore * 100) / 100, dataPoints: point.count },
        };

        anomalies.push(anomaly);
      }
    }

    // Check for sustained high costs
    const sustainedAnomalies = this.detectSustainedHigh(dailyPoints, tenantId, mean, stdDev);
    anomalies.push(...sustainedAnomalies);

    // Store anomalies in DB
    for (const anomaly of anomalies) {
      await this.storeAnomaly(anomaly);
    }

    if (anomalies.length > 0) {
      logger.warn(
        { tenantId, anomalyCount: anomalies.length, timeWindow },
        'Cost anomalies detected',
      );
    }

    return {
      anomalies,
      timeWindow,
      dataPointsAnalyzed: records.length,
      detectedAt: new Date(),
    };
  }

  /**
   * 获取成本趋势
   */
  async getCostTrend(tenantId: string, days: number): Promise<CostTrendResult> {
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000);

    const records = await this.getCostRecords(tenantId, startDate, endDate);

    // Group by day
    const dailyMap = new Map<string, number>();
    for (const record of records) {
      const dayKey = record.timestamp.toISOString().split('T')[0];
      dailyMap.set(dayKey, (dailyMap.get(dayKey) || 0) + record.amount);
    }

    const points: CostTrendPoint[] = Array.from(dailyMap.entries())
      .map(([date, cost]) => ({ date, cost: Math.round(cost * 100) / 100 }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const costs = points.map(p => p.cost);
    const totalCost = costs.reduce((sum, c) => sum + c, 0);
    const averageCost = costs.length > 0 ? totalCost / costs.length : 0;

    // Calculate trend using linear regression
    let trend: 'increasing' | 'decreasing' | 'stable' = 'stable';
    let changeRate = 0;

    if (costs.length >= 2) {
      const firstHalf = costs.slice(0, Math.floor(costs.length / 2));
      const secondHalf = costs.slice(Math.floor(costs.length / 2));
      const firstAvg = firstHalf.reduce((s, c) => s + c, 0) / firstHalf.length;
      const secondAvg = secondHalf.reduce((s, c) => s + c, 0) / secondHalf.length;

      changeRate = firstAvg > 0 ? ((secondAvg - firstAvg) / firstAvg) * 100 : 0;

      if (changeRate > 10) trend = 'increasing';
      else if (changeRate < -10) trend = 'decreasing';
    }

    return {
      points,
      totalCost: Math.round(totalCost * 100) / 100,
      averageCost: Math.round(averageCost * 100) / 100,
      trend,
      changeRate: Math.round(changeRate * 100) / 100,
    };
  }

  /**
   * 成本预测 - 预测月末花费
   * 使用线性回归预测月末成本
   */
  async forecastCost(tenantId: string, daysOfHistory: number = 30): Promise<CostForecastResult> {
    const now = new Date();
    const startDate = new Date(now.getTime() - daysOfHistory * 24 * 60 * 60 * 1000);
    const records = await this.getCostRecords(tenantId, startDate, now);

    // Group by day
    const dailyMap = new Map<string, number>();
    for (const record of records) {
      const dayKey = record.timestamp.toISOString().split('T')[0];
      dailyMap.set(dayKey, (dailyMap.get(dayKey) || 0) + record.amount);
    }

    const dailyPoints = Array.from(dailyMap.entries())
      .map(([date, cost]) => ({ date: new Date(date), cost }))
      .sort((a, b) => a.date.getTime() - b.date.getTime());

    if (dailyPoints.length < 3) {
      const currentSpend = dailyPoints.reduce((sum, p) => sum + p.cost, 0);
      return {
        predictedEndOfMonthCost: currentSpend * 2,
        currentSpend: Math.round(currentSpend * 100) / 100,
        projectedOverage: 0,
        confidence: 0.2,
        dailyForecast: [],
        generatedAt: new Date(),
      };
    }

    // Simple linear regression: y = mx + b
    const n = dailyPoints.length;
    const values = dailyPoints.map(p => p.cost);
    const sumX = values.reduce((s, _, i) => s + i, 0);
    const sumY = values.reduce((s, v) => s + v, 0);
    const sumXY = values.reduce((s, v, i) => s + i * v, 0);
    const sumX2 = values.reduce((s, _, i) => s + i * i, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    // Calculate R-squared for confidence
    const meanY = sumY / n;
    const ssTot = values.reduce((s, v) => s + (v - meanY) ** 2, 0);
    const ssRes = values.reduce((s, v, i) => s + (v - (slope * i + intercept)) ** 2, 0);
    const rSquared = ssTot > 0 ? 1 - ssRes / ssTot : 0;

    // Current month-to-date spend
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthToDateRecords = dailyPoints.filter(p => p.date >= monthStart);
    const currentSpend = monthToDateRecords.reduce((sum, p) => sum + p.cost, 0);

    // Days elapsed and remaining in month
    const daysElapsed = Math.max(1, Math.floor((now.getTime() - monthStart.getTime()) / (24 * 60 * 60 * 1000)));
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const daysRemaining = Math.ceil((monthEnd.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));

    // Predict remaining days
    const dailyForecast: Array<{ date: string; predicted: number }> = [];
    for (let d = 1; d <= daysRemaining; d++) {
      const forecastDate = new Date(now.getTime() + d * 24 * 60 * 60 * 1000);
      const predicted = Math.max(0, slope * (n + d) + intercept);
      dailyForecast.push({
        date: forecastDate.toISOString().split('T')[0],
        predicted: Math.round(predicted * 100) / 100,
      });
    }

    const predictedRemaining = dailyForecast.reduce((sum, d) => sum + d.predicted, 0);
    const predictedEndOfMonthCost = currentSpend + predictedRemaining;
    const projectedOverage = Math.max(0, predictedEndOfMonthCost - currentSpend * (daysElapsed + daysRemaining) / daysElapsed);

    return {
      predictedEndOfMonthCost: Math.round(predictedEndOfMonthCost * 100) / 100,
      currentSpend: Math.round(currentSpend * 100) / 100,
      projectedOverage: Math.round(projectedOverage * 100) / 100,
      confidence: Math.max(0.1, Math.min(0.95, rSquared)),
      dailyForecast,
      generatedAt: new Date(),
    };
  }

  // ==================== Private Helpers ====================

  private async getCostRecords(
    tenantId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<CostRecord[]> {
    const result = await this.pool.query(
      `SELECT * FROM cost_records WHERE tenant_id = $1 AND timestamp >= $2 AND timestamp <= $3 ORDER BY timestamp ASC`,
      [tenantId, startDate, endDate],
    );

    return result.rows.map(row => ({
      id: row.id,
      tenantId: row.tenant_id,
      amount: row.amount,
      category: row.category,
      resourceId: row.resource_id,
      timestamp: new Date(row.timestamp),
      metadata: row.metadata ? (typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata) : undefined,
    }));
  }

  private calculateSeverity(zScore: number, deviation: number): 'low' | 'medium' | 'high' | 'critical' {
    if (zScore > 3 || deviation > 200) return 'critical';
    if (zScore > 2.5 || deviation > 100) return 'high';
    if (zScore > 2 || deviation > 50) return 'medium';
    return 'low';
  }

  private isSustainedHigh(
    dailyPoints: Array<{ date: string; total: number; count: number; records: any[] }>,
    index: number,
    mean: number,
    stdDev: number,
  ): boolean {
    if (index < 2) return false;
    const threshold = mean + 2 * stdDev;
    return (
      dailyPoints[index].total > threshold &&
      dailyPoints[index - 1].total > threshold &&
      dailyPoints[index - 2].total > threshold
    );
  }

  private detectSustainedHigh(
    dailyPoints: Array<{ date: string; total: number; count: number; records: any[] }>,
    tenantId: string,
    mean: number,
    stdDev: number,
  ): AnomalyRecord[] {
    const anomalies: AnomalyRecord[] = [];
    const threshold = mean + 2 * stdDev;
    let streakStart = -1;

    for (let i = 0; i < dailyPoints.length; i++) {
      if (dailyPoints[i].total > threshold) {
        if (streakStart === -1) streakStart = i;
      } else {
        if (streakStart !== -1 && i - streakStart >= 3) {
          // 3+ consecutive days above threshold
          const streakCost = dailyPoints.slice(streakStart, i).reduce((s, p) => s + p.total, 0);
          anomalies.push({
            id: `anomaly_${uuidv4()}`,
            tenantId,
            type: AnomalyType.SUSTAINED_HIGH,
            severity: 'high',
            value: Math.round(streakCost * 100) / 100,
            expectedValue: Math.round(mean * (i - streakStart) * 100) / 100,
            deviation: Math.round(((streakCost - mean * (i - streakStart)) / (mean * (i - streakStart))) * 10000) / 100,
            detectedAt: new Date(),
            timeWindowStart: new Date(dailyPoints[streakStart].date),
            timeWindowEnd: new Date(dailyPoints[i - 1].date + 'T23:59:59Z'),
            description: `Sustained high cost detected: ${i - streakStart} consecutive days above threshold ($${threshold.toFixed(2)})`,
            metadata: { streakDays: i - streakStart, threshold },
          });
        }
        streakStart = -1;
      }
    }

    // Check final streak
    if (streakStart !== -1 && dailyPoints.length - streakStart >= 3) {
      const streakCost = dailyPoints.slice(streakStart).reduce((s, p) => s + p.total, 0);
      const streakDays = dailyPoints.length - streakStart;
      anomalies.push({
        id: `anomaly_${uuidv4()}`,
        tenantId,
        type: AnomalyType.SUSTAINED_HIGH,
        severity: 'high',
        value: Math.round(streakCost * 100) / 100,
        expectedValue: Math.round(mean * streakDays * 100) / 100,
        deviation: Math.round(((streakCost - mean * streakDays) / (mean * streakDays)) * 10000) / 100,
        detectedAt: new Date(),
        timeWindowStart: new Date(dailyPoints[streakStart].date),
        timeWindowEnd: new Date(dailyPoints[dailyPoints.length - 1].date + 'T23:59:59Z'),
        description: `Sustained high cost detected: ${streakDays} consecutive days above threshold ($${threshold.toFixed(2)})`,
        metadata: { streakDays, threshold },
      });
    }

    return anomalies;
  }

  private async storeAnomaly(anomaly: AnomalyRecord): Promise<void> {
    try {
      await this.pool.query(
        `INSERT INTO cost_anomalies (id, tenant_id, type, severity, value, expected_value, deviation, detected_at, time_window_start, time_window_end, description, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [
          anomaly.id,
          anomaly.tenantId,
          anomaly.type,
          anomaly.severity,
          anomaly.value,
          anomaly.expectedValue,
          anomaly.deviation,
          anomaly.detectedAt,
          anomaly.timeWindowStart,
          anomaly.timeWindowEnd,
          anomaly.description,
          anomaly.metadata ? JSON.stringify(anomaly.metadata) : null,
        ],
      );
    } catch (err: any) {
      logger.warn({ error: err.message }, 'Failed to store cost anomaly');
    }
  }

  private async ensureTable(): Promise<void> {
    try {
      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS cost_records (
          id VARCHAR(64) PRIMARY KEY,
          tenant_id VARCHAR(64) NOT NULL,
          amount NUMERIC(12, 2) NOT NULL,
          category VARCHAR(64) NOT NULL,
          resource_id VARCHAR(64),
          timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
          metadata JSONB
        )
      `);
      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS cost_anomalies (
          id VARCHAR(64) PRIMARY KEY,
          tenant_id VARCHAR(64) NOT NULL,
          type VARCHAR(30) NOT NULL,
          severity VARCHAR(20) NOT NULL,
          value NUMERIC(12, 2) NOT NULL,
          expected_value NUMERIC(12, 2) NOT NULL,
          deviation NUMERIC(8, 2) NOT NULL,
          detected_at TIMESTAMP NOT NULL DEFAULT NOW(),
          time_window_start TIMESTAMP NOT NULL,
          time_window_end TIMESTAMP NOT NULL,
          description TEXT,
          metadata JSONB
        )
      `);
      logger.info('cost_records and cost_anomalies tables ensured');
    } catch (err: any) {
      logger.warn({ error: err.message }, 'Could not ensure cost tables (may need migration)');
    }
  }
}
