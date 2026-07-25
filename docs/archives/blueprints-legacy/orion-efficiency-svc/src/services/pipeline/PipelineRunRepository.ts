/**
 * PipelineRun Repository - stub for orion-efficiency-svc
 *
 * In production, this would be backed by PostgreSQL.
 * Here we provide a minimal in-memory implementation.
 */

import { DatabasePool } from '../../utils/database';

export interface PipelineRunRecord {
  id: string;
  pipeline_id: string;
  status: string;
  trigger_type: string;
  duration_ms?: number;
  completed_at?: Date;
  created_at?: Date;
  tenant_id: string;
}

export interface PipelineRunFindAllOptions {
  tenantId?: string;
  since?: Date;
  limit?: number;
}

export class PipelineRunRepository {
  private db: DatabasePool;
  private records: PipelineRunRecord[] = [];

  constructor(db: DatabasePool) {
    this.db = db;
  }

  async findAll(options: PipelineRunFindAllOptions = {}): Promise<PipelineRunRecord[]> {
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
