/**
 * Capacity Planning Service (Phase 4 - Capacity Planning)
 * Resource capacity tracking, forecasting, bottleneck analysis
 */

import { v4 as uuidv4 } from 'uuid';

export interface CapacityMetric {
  id: string;
  tenantId: string;
  resourceType: string; // compute/storage/network/database
  resourceId: string;
  metricName: string; // cpu/memory/disk/iops/throughput
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

const metrics = new Map<string, CapacityMetric>();
const forecasts = new Map<string, CapacityForecast>();
const alerts = new Map<string, CapacityAlert>();
const reports = new Map<string, CapacityReport>();

export class CapacityService {
  // Metrics
  async recordMetric(input: {
    resourceType: string; resourceId: string; metricName: string;
    currentValue: number; maxValue: number; unit: string;
  }, tenantId: string): Promise<CapacityMetric> {
    const utilization = input.maxValue > 0 ? (input.currentValue / input.maxValue) * 100 : 0;
    const metric: CapacityMetric = {
      id: uuidv4(), tenantId,
      resourceType: input.resourceType, resourceId: input.resourceId,
      metricName: input.metricName, currentValue: input.currentValue,
      maxValue: input.maxValue, unit: input.unit,
      utilizationPercent: Math.round(utilization * 100) / 100,
      timestamp: new Date().toISOString(),
    };
    metrics.set(metric.id, metric);
    return metric;
  }

  async listMetrics(tenantId: string, params?: {
    resourceType?: string; metricName?: string;
  }): Promise<CapacityMetric[]> {
    let result = Array.from(metrics.values()).filter((m) => m.tenantId === tenantId);
    if (params?.resourceType) result = result.filter((m) => m.resourceType === params.resourceType);
    if (params?.metricName) result = result.filter((m) => m.metricName === params.metricName);
    return result.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  }

  async getLatestMetrics(tenantId: string): Promise<Map<string, CapacityMetric>> {
    const tenantMetrics = Array.from(metrics.values()).filter((m) => m.tenantId === tenantId);
    const latestMap = new Map<string, CapacityMetric>();
    for (const m of tenantMetrics) {
      const key = `${m.resourceType}:${m.resourceId}:${m.metricName}`;
      const existing = latestMap.get(key);
      if (!existing || m.timestamp > existing.timestamp) {
        latestMap.set(key, m);
      }
    }
    return latestMap;
  }

  // Forecasting
  async generateForecast(tenantId: string): Promise<CapacityForecast[]> {
    const latestMetrics = await this.getLatestMetrics(tenantId);
    const newForecasts: CapacityForecast[] = [];

    for (const [key, metric] of latestMetrics.entries()) {
      // Simple linear growth projection (simulated)
      const growthRate = 0.05 + Math.random() * 0.1; // 5-15% monthly growth
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

      const forecast: CapacityForecast = {
        id: uuidv4(), tenantId,
        resourceType: metric.resourceType, resourceId: metric.resourceId,
        metricName: metric.metricName,
        currentUtilization: metric.utilizationPercent,
        forecast30Days: Math.round(forecast30 * 100) / 100,
        forecast90Days: Math.round(forecast90 * 100) / 100,
        estimatedExhaustDate,
        recommendedAction,
        generatedAt: new Date().toISOString(),
      };
      forecasts.set(forecast.id, forecast);
      newForecasts.push(forecast);

      // Generate alerts for high utilization
      if (metric.utilizationPercent >= 80) {
        const alert: CapacityAlert = {
          id: uuidv4(), tenantId,
          resourceId: metric.resourceId, resourceType: metric.resourceType,
          metricName: metric.metricName,
          currentUtilization: metric.utilizationPercent,
          threshold: metric.utilizationPercent >= 90 ? 90 : 80,
          severity: metric.utilizationPercent >= 90 ? 'critical' : 'warning',
          message: `${metric.resourceId} 的 ${metric.metricName} 使用率达 ${metric.utilizationPercent.toFixed(1)}%`,
          createdAt: new Date().toISOString(),
        };
        alerts.set(alert.id, alert);
      }
    }

    return newForecasts;
  }

  async listForecasts(tenantId: string, params?: { resourceType?: string }): Promise<CapacityForecast[]> {
    let result = Array.from(forecasts.values()).filter((f) => f.tenantId === tenantId);
    if (params?.resourceType) result = result.filter((f) => f.resourceType === params.resourceType);
    return result.sort((a, b) => b.generatedAt.localeCompare(a.generatedAt));
  }

  // Alerts
  async listAlerts(tenantId: string, params?: { severity?: string }): Promise<CapacityAlert[]> {
    let result = Array.from(alerts.values()).filter((a) => a.tenantId === tenantId);
    if (params?.severity) result = result.filter((a) => a.severity === params.severity);
    return result.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async deleteAlert(id: string): Promise<boolean> {
    return alerts.delete(id);
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

    const report: CapacityReport = {
      id: uuidv4(), tenantId, title,
      summary: {
        totalResources: uniqueResources,
        healthyCount, warningCount, criticalCount, overallScore,
      },
      alerts: alertList,
      forecasts: forecastList,
      generatedAt: new Date().toISOString(),
    };
    reports.set(report.id, report);
    return report;
  }

  async listReports(tenantId: string): Promise<CapacityReport[]> {
    return Array.from(reports.values())
      .filter((r) => r.tenantId === tenantId)
      .sort((a, b) => b.generatedAt.localeCompare(a.generatedAt));
  }

  async getReport(id: string): Promise<CapacityReport | undefined> {
    return reports.get(id);
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
}
