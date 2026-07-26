/**
 * Deploy Repository - stub for orion-efficiency-svc
 *
 * In production, this would be backed by PostgreSQL.
 * Here we provide a minimal in-memory implementation.
 */

import { DatabasePool } from '../../utils/database';

export interface DeployRecord {
  id: string;
  tenant_id: string;
  environment: string;
  status: string;
  completed_at?: Date;
  created_at?: Date;
  duration_ms?: number;
  commit_sha?: string;
  commit_committed_at?: Date;
}

export interface DeployFindAllOptions {
  tenantId?: string;
  since?: Date;
  limit?: number;
}

export class DeployRepository {
  private db: DatabasePool;
  private records: DeployRecord[] = [];

  constructor(db: DatabasePool) {
    this.db = db;
  }

  async findAll(options: DeployFindAllOptions = {}): Promise<DeployRecord[]> {
    let records = [...this.records];
    if (options.tenantId) {
      records = records.filter((r) => r.tenant_id === options.tenantId);
    }
    if (options.since) {
      records = records.filter((r) => {
        const d = r.completed_at || r.created_at;
        return d && d >= options.since!;
      });
    }
    if (options.limit) {
      records = records.slice(0, options.limit);
    }
    return records;
  }
}
