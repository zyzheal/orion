import { MetricsRepository, Metric } from './MetricsRepository';
import { getCurrentTenantId } from '../../db/tenant-context-storage';
import { createLogger } from '../utils/logger';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });
/**
 * MetricsService - Business logic layer for Metrics
 *
 * Records and queries time-series metrics with automatic tenant isolation.
 */

export class MetricsServiceError extends Error {
  constructor(message: string, public code: string) { super(message); this.name = 'MetricsServiceError'; }
}

export class MetricsService {
  private repository: MetricsRepository;

  constructor(repository: MetricsRepository) {
    this.repository = repository;
  }

  async record(tenantId: string, name: string, value: number, unit: string): Promise<Metric> {
    const tid = tenantId || getCurrentTenantId();
    const result = await this.repository.record(tid, name, value, unit);
    logger.debug({ metricName: name, value, unit, tenantId: tid }, 'Metric recorded');
    return result;
  }

  async query(tenantId: string, name: string, startTime: Date, endTime: Date): Promise<Metric[]> {
    const tid = tenantId || getCurrentTenantId();
    return this.repository.query(tid, name, startTime, endTime);
  }

  async getStats(tenantId: string, name: string, startTime: Date, endTime: Date) {
    const tid = tenantId || getCurrentTenantId();
    return this.repository.aggregate(tid, name, startTime, endTime);
  }

  /**
   * Record a metric using current tenant context (no explicit tenantId required)
   */
  async recordCurrent(name: string, value: number, unit: string): Promise<Metric> {
    const tid = getCurrentTenantId();
    return this.repository.record(tid, name, value, unit);
  }

  /**
   * Query latest N metrics for a name within a time window
   */
  async queryLatest(tenantId: string, name: string, limit: number = 100): Promise<Metric[]> {
    const tid = tenantId || getCurrentTenantId();
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - 24 * 60 * 60 * 1000); // last 24h
    return this.repository.query(tid, name, startTime, endTime);
  }
}
