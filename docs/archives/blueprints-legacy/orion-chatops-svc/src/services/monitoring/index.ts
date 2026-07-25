/**
 * Monitoring Service - Stub
 */

import { DatabasePool } from '../../database';

export interface MonitoringRepository {
  db: DatabasePool;
}

export class MonitoringService {
  constructor(private repo: MonitoringRepository) {}

  async listAlerts?(options?: Record<string, any>): Promise<any[]> {
    return [];
  }
}
