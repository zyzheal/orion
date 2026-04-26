/**
 * MetricsService - Business logic layer for Metrics
 */
import { MetricsRepository, Metric } from './MetricsRepository';

export class MetricsServiceError extends Error {
  constructor(message: string, public code: string) { super(message); this.name = 'MetricsServiceError'; }
}

export class MetricsService {
  private repository: MetricsRepository;
  constructor(repository: MetricsRepository) { this.repository = repository; }

  async record(tenantId: string, name: string, value: number, unit: string): Promise<Metric> {
    return this.repository.record(tenantId, name, value, unit);
  }

  async query(tenantId: string, name: string, startTime: Date, endTime: Date): Promise<Metric[]> {
    return this.repository.query(tenantId, name, startTime, endTime);
  }

  async getStats(tenantId: string, name: string, startTime: Date, endTime: Date) {
    return this.repository.aggregate(tenantId, name, startTime, endTime);
  }
}