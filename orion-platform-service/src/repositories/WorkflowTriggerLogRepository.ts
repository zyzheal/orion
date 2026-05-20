export interface WorkflowTriggerLog {
  id: string;
  trigger_id: string;
  workflow_instance_id?: string;
  event_type?: string;
  event_payload?: Record<string, any>;
  status: 'pending' | 'success' | 'failed' | 'skipped';
  error_message?: string;
  execution_time_ms?: number;
  triggered_at: Date;
}

export class WorkflowTriggerLogRepository {
  constructor(private db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {}

  private mapRowToEntity(row: any): WorkflowTriggerLog {
    return {
      id: row.id,
      trigger_id: row.trigger_id,
      workflow_instance_id: row.workflow_instance_id,
      event_type: row.event_type,
      event_payload: row.event_payload,
      status: row.status,
      error_message: row.error_message,
      execution_time_ms: row.execution_time_ms,
      triggered_at: row.triggered_at,
    };
  }

  async create(data: Partial<WorkflowTriggerLog>): Promise<WorkflowTriggerLog> {
    const result = await this.db.query(
      `INSERT INTO workflow_trigger_logs (trigger_id, workflow_instance_id, event_type, event_payload, status, error_message, execution_time_ms)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [data.trigger_id, data.workflow_instance_id, data.event_type, JSON.stringify(data.event_payload || {}), data.status, data.error_message, data.execution_time_ms]
    );
    return this.mapRowToEntity(result.rows[0]);
  }

  async findByTriggerId(triggerId: string, limit = 50): Promise<WorkflowTriggerLog[]> {
    const result = await this.db.query(
      'SELECT * FROM workflow_trigger_logs WHERE trigger_id = $1 ORDER BY triggered_at DESC LIMIT $2',
      [triggerId, limit]
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }
}