/**
 * Capacity Planning Service (Phase 4 - Capacity Planning)
 * Resource capacity tracking, forecasting, bottleneck analysis
 *
 * Migrated from Map() to PostgreSQL Repository pattern (2026-06-26)
 */

import { v4 as uuidv4 } from 'uuid';
import {
  CapacityMetricRepository,
  CapacityForecastRepository,
  CapacityAlertRepository,
  CapacityReportRepository,
  CapacityMetricEntity,
  CapacityForecastEntity,
  CapacityAlertEntity,
  CapacityReportEntity,
} from '../../repositories/CapacityRepository';

export interface CapacityMetric {
  id: string;
  tenantId: string;
  resourceType: string;
  resourceId: string;
  metricName: string;
  currentValue: number;
  maxValue: number;
  unit: string;
  utilizationPercent: number;
  timestamp: string;
}

export interface CapacityForecast {
  id: string;
  tenantId: string;
  resourceType: string;
  resourceId: string;
  metricName: string;
  currentUtilization: number;
  forecast30Days: number;
  forecast90Days: number;
  estimatedExhaustDate?: string;
  recommendedAction?: string;
  generatedAt: string;
}

export interface CapacityAlert {
  id: string;
  tenantId: string;
  resourceId: string;
  resourceType: string;
  metricName: string;
  currentUtilization: number;
  threshold: number;
  severity: 'info' | 'warning' | 'critical';
  message: string;
  createdAt: string;
}

export interface CapacityReport {
  id: string;
  tenantId: string;
  title: string;
  summary: {
    totalResources: number;
    healthyCount: number;
    warningCount: number;
    criticalCount: number;
    overallScore: number;
  };
  alerts: CapacityAlert[];
  forecasts: CapacityForecast[];
  generatedAt: string;
}

export class CapacityService {
  private metricRepo: CapacityMetricRepository;
  private forecastRepo: CapacityForecastRepository;
  private alertRepo: CapacityAlertRepository;
  private reportRepo: CapacityReportRepository;

  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    this.metricRepo = new CapacityMetricRepository(db);
    this.forecastRepo = new CapacityForecastRepository(db);
    this.alertRepo = new CapacityAlertRepository(db);
    this.reportRepo = new CapacityReportRepository(db);
  }

  // Metrics
  async recordMetric(input: {
    resourceType: string; resourceId: string; metricName: string;
    currentValue: number; maxValue: number; unit: string;
  }, tenantId: string): Promise<CapacityMetric> {
    const utilization = input.maxValue > 0 ? (input.currentValue / input.maxValue) * 100 : 0;
    const entity = await this.metricRepo.create({
      id: uuidv4(),
      tenantId,
      resourceType: input.resourceType,
      resourceId: input.resourceId,
      metricName: input.metricName,
      currentValue: input.currentValue,
      maxValue: input.maxValue,
      unit: input.unit,
      utilizationPercent: Math.round(utilization * 100) / 100,
    });
    return this.metricToDTO(entity);
  }

  async listMetrics(tenantId: string, params?: {
    resourceType?: string; metricName?: string;
  }): Promise<CapacityMetric[]> {
    const entities = await this.metricRepo.findByTenant(tenantId, params);
    return entities.map(e => this.metricToDTO(e));
  }

  async getLatestMetrics(tenantId: string): Promise<Map<string, CapacityMetric>> {
    const entities = await this.metricRepo.findLatestByTenant(tenantId);
    const latestMap = new Map<string, CapacityMetric>();
    for (const e of entities) {
      const key = `${e.resourceType}:${e.resourceId}:${e.metricName}`;
      latestMap.set(key, this.metricToDTO(e));
    }
    return latestMap;
  }

  // Forecasting
  async generateForecast(tenantId: string): Promise<CapacityForecast[]> {
    const latestMetrics = await this.getLatestMetrics(tenantId);
    const newForecasts: CapacityForecast[] = [];

    for (const [, metric] of latestMetrics.entries()) {
      const growthRate = 0.05 + Math.random() * 0.1;
      const forecast30 = Math.min(metric.utilizationPercent * (1 + growthRate), 100);
      const forecast90 = Math.min(metric.utilizationPercent * (1 + growthRate * 3), 100);

      let estimatedExhaustDate: string | undefined;
      let recommendedAction: string | undefined;

      if (forecast90 >= 90) {
        const daysToExhaust = Math.ceil((100 - metric.utilizationPercent) / (growthRate * metric.utilizationPercent / 30));
        const exhaustDate = new Date();
        exhaustDate.setDate(exhaustDate.getDate() + daysToExhaust);
        estimatedExhaustDate = exhaustDate.toISOString();
        recommendedAction = metric.utilizationPercent >= 80
          ? '立即扩容：资源使用率已超过 80%，预计短期内耗尽'
          : '计划扩容：资源使用率增长较快，建议提前规划扩容';
      }

      const entity = await this.forecastRepo.create({
        id: uuidv4(),
        tenantId,
        resourceType: metric.resourceType,
        resourceId: metric.resourceId,
        metricName: metric.metricName,
        currentUtilization: metric.utilizationPercent,
        forecast30Days: Math.round(forecast30 * 100) / 100,
        forecast90Days: Math.round(forecast90 * 100) / 100,
        estimatedExhaustDate: estimatedExhaustDate ? new Date(estimatedExhaustDate) : null,
        recommendedAction: recommendedAction ?? null,
      });

      newForecasts.push(this.forecastToDTO(entity));

      if (metric.utilizationPercent >= 80) {
        await this.alertRepo.create({
          id: uuidv4(),
          tenantId,
          resourceId: metric.resourceId,
          resourceType: metric.resourceType,
          metricName: metric.metricName,
          currentUtilization: metric.utilizationPercent,
          threshold: metric.utilizationPercent >= 90 ? 90 : 80,
          severity: metric.utilizationPercent >= 90 ? 'critical' : 'warning',
          message: `${metric.resourceId} 的 ${metric.metricName} 使用率达 ${metric.utilizationPercent.toFixed(1)}%`,
        });
      }
    }

    return newForecasts;
  }

  async listForecasts(tenantId: string, params?: { resourceType?: string }): Promise<CapacityForecast[]> {
    const entities = await this.forecastRepo.findByTenant(tenantId, params);
    return entities.map(e => this.forecastToDTO(e));
  }

  // Alerts
  async listAlerts(tenantId: string, params?: { severity?: string }): Promise<CapacityAlert[]> {
    const entities = await this.alertRepo.findByTenant(tenantId, params);
    return entities.map(e => this.alertToDTO(e));
  }

  async deleteAlert(id: string): Promise<boolean> {
    const existing = await this.alertRepo.findById(id);
    if (!existing) return false;
    await this.alertRepo.delete(id);
    return true;
  }

  // Reports
  async generateReport(title: string, tenantId: string): Promise<CapacityReport> {
    const forecastList = await this.listForecasts(tenantId);
    const alertList = await this.listAlerts(tenantId);

    const criticalCount = alertList.filter((a) => a.severity === 'critical').length;
    const warningCount = alertList.filter((a) => a.severity === 'warning').length;
    const uniqueResources = new Set(alertList.map((a) => a.resourceId)).size;
    const healthyCount = Math.max(0, uniqueResources - criticalCount - warningCount);
    const overallScore = uniqueResources > 0
      ? Math.round((healthyCount / uniqueResources) * 100)
      : 100;

    const entity = await this.reportRepo.create({
      id: uuidv4(),
      tenantId,
      title,
      summary: {
        totalResources: uniqueResources,
        healthyCount, warningCount, criticalCount, overallScore,
      },
      alerts: alertList,
      forecasts: forecastList,
    });

    return this.reportToDTO(entity);
  }

  async listReports(tenantId: string): Promise<CapacityReport[]> {
    const entities = await this.reportRepo.findByTenant(tenantId);
    return entities.map(e => this.reportToDTO(e));
  }

  async getReport(id: string): Promise<CapacityReport | undefined> {
    const entity = await this.reportRepo.findById(id);
    return entity ? this.reportToDTO(entity) : undefined;
  }

  // Bottleneck Analysis
  async analyzeBottlenecks(tenantId: string): Promise<Array<{
    resourceId: string;
    resourceType: string;
    metricName: string;
    utilization: number;
    impact: 'high' | 'medium' | 'low';
    recommendation: string;
  }>> {
    const latestMetrics = await this.getLatestMetrics(tenantId);
    const bottlenecks: Array<{
      resourceId: string; resourceType: string; metricName: string;
      utilization: number; impact: 'high' | 'medium' | 'low'; recommendation: string;
    }> = [];

    for (const metric of latestMetrics.values()) {
      if (metric.utilizationPercent < 50) continue;

      const impact = metric.utilizationPercent >= 80 ? 'high'
        : metric.utilizationPercent >= 60 ? 'medium' : 'low';

      let recommendation = '';
      if (metric.metricName === 'cpu' && metric.utilizationPercent >= 80) {
        recommendation = '考虑水平扩展或增加 CPU 核心数';
      } else if (metric.metricName === 'memory' && metric.utilizationPercent >= 80) {
        recommendation = '检查内存泄漏或增加内存配置';
      } else if (metric.metricName === 'disk' && metric.utilizationPercent >= 80) {
        recommendation = '清理无用文件或扩容磁盘';
      } else if (metric.metricName === 'iops' && metric.utilizationPercent >= 80) {
        recommendation = '优化数据库查询或升级到 SSD';
      } else {
        recommendation = `监控 ${metric.metricName} 使用趋势`;
      }

      bottlenecks.push({
        resourceId: metric.resourceId,
        resourceType: metric.resourceType,
        metricName: metric.metricName,
        utilization: metric.utilizationPercent,
        impact,
        recommendation,
      });
    }

    return bottlenecks.sort((a, b) => b.utilization - a.utilization);
  }

  // DTO converters
  private metricToDTO(e: CapacityMetricEntity): CapacityMetric {
    return {
      id: e.id,
      tenantId: e.tenantId,
      resourceType: e.resourceType,
      resourceId: e.resourceId,
      metricName: e.metricName,
      currentValue: e.currentValue,
      maxValue: e.maxValue,
      unit: e.unit,
      utilizationPercent: e.utilizationPercent,
      timestamp: e.createdAt.toISOString(),
    };
  }

  private forecastToDTO(e: CapacityForecastEntity): CapacityForecast {
    return {
      id: e.id,
      tenantId: e.tenantId,
      resourceType: e.resourceType,
      resourceId: e.resourceId,
      metricName: e.metricName,
      currentUtilization: e.currentUtilization,
      forecast30Days: e.forecast30Days,
      forecast90Days: e.forecast90Days,
      estimatedExhaustDate: e.estimatedExhaustDate?.toISOString(),
      recommendedAction: e.recommendedAction ?? undefined,
      generatedAt: e.generatedAt.toISOString(),
    };
  }

  private alertToDTO(e: CapacityAlertEntity): CapacityAlert {
    return {
      id: e.id,
      tenantId: e.tenantId,
      resourceId: e.resourceId,
      resourceType: e.resourceType,
      metricName: e.metricName,
      currentUtilization: e.currentUtilization,
      threshold: e.threshold,
      severity: e.severity as 'info' | 'warning' | 'critical',
      message: e.message,
      createdAt: e.createdAt.toISOString(),
    };
  }

  private reportToDTO(e: CapacityReportEntity): CapacityReport {
    return {
      id: e.id,
      tenantId: e.tenantId,
      title: e.title,
      summary: e.summary as CapacityReport['summary'],
      alerts: e.alerts as CapacityAlert[],
      forecasts: e.forecasts as CapacityForecast[],
      generatedAt: e.generatedAt.toISOString(),
    };
  }
}
