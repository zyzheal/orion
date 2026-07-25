/**
 * TicketWorkflowRepository & TicketSLARepository - PostgreSQL backed repositories
 */
interface WorkflowHistoryRow {
  id: string;
  ticket_id: string;
  from_status: string;
  to_status: string;
  performed_by: string;
  performed_at: Date;
  reason?: string;
}

interface SLARow {
  id: string;
  ticket_id: string;
  response_time_ms: number | null;
  resolution_time_ms: number | null;
  breached: boolean;
  target_response_ms: number;
  target_resolution_ms: number;
  created_at: Date;
}

interface DbPool {
  query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }>;
}

export class TicketWorkflowRepository {
  constructor(private db: DbPool) {}

  async findByTicketId(ticketId: string): Promise<WorkflowHistoryRow[]> {
    const result = await this.db.query(
      `SELECT * FROM ticket_workflow_history WHERE ticket_id = $1 ORDER BY performed_at DESC`,
      [ticketId]
    );
    return result.rows as WorkflowHistoryRow[];
  }

  async findAll(limit: number = 100): Promise<WorkflowHistoryRow[]> {
    const result = await this.db.query(
      `SELECT * FROM ticket_workflow_history ORDER BY performed_at DESC LIMIT $1`,
      [limit]
    );
    return result.rows as WorkflowHistoryRow[];
  }

  async create(data: {
    ticketId: string;
    fromStatus: string;
    toStatus: string;
    performedBy: string;
    reason?: string;
  }): Promise<WorkflowHistoryRow> {
    const result = await this.db.query(
      `INSERT INTO ticket_workflow_history (ticket_id, from_status, to_status, performed_by, reason)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [data.ticketId, data.fromStatus, data.toStatus, data.performedBy, data.reason || null]
    );
    return result.rows[0] as WorkflowHistoryRow;
  }

  async update(id: string, data: { reason?: string }): Promise<WorkflowHistoryRow | null> {
    const result = await this.db.query(
      `UPDATE ticket_workflow_history SET reason = $1 WHERE id = $2 RETURNING *`,
      [data.reason || null, id]
    );
    return result.rows[0] as WorkflowHistoryRow | undefined;
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.db.query(
      `DELETE FROM ticket_workflow_history WHERE id = $1`,
      [id]
    );
    return (result.rowCount || 0) > 0;
  }
}

export class TicketSLARepository {
  constructor(private db: DbPool) {}

  async findByTicketId(ticketId: string): Promise<SLARow | null> {
    const result = await this.db.query(
      `SELECT * FROM ticket_sla_records WHERE ticket_id = $1 LIMIT 1`,
      [ticketId]
    );
    return (result.rows[0] as SLARow) || null;
  }

  async findAll(limit: number = 100): Promise<SLARow[]> {
    const result = await this.db.query(
      `SELECT * FROM ticket_sla_records ORDER BY created_at DESC LIMIT $1`,
      [limit]
    );
    return result.rows as SLARow[];
  }

  async create(data: {
    ticketId: string;
    responseTimeMs?: number;
    resolutionTimeMs?: number;
    breached: boolean;
    targetResponseMs: number;
    targetResolutionMs: number;
  }): Promise<SLARow> {
    const result = await this.db.query(
      `INSERT INTO ticket_sla_records
       (ticket_id, response_time_ms, resolution_time_ms, breached, target_response_ms, target_resolution_ms)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        data.ticketId,
        data.responseTimeMs || null,
        data.resolutionTimeMs || null,
        data.breached,
        data.targetResponseMs,
        data.targetResolutionMs,
      ]
    );
    return result.rows[0] as SLARow;
  }

  async update(id: string, data: {
    responseTimeMs?: number;
    resolutionTimeMs?: number;
    breached?: boolean;
  }): Promise<SLARow | null> {
    const fields: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (data.responseTimeMs !== undefined) {
      fields.push(`response_time_ms = $${idx++}`);
      values.push(data.responseTimeMs);
    }
    if (data.resolutionTimeMs !== undefined) {
      fields.push(`resolution_time_ms = $${idx++}`);
      values.push(data.resolutionTimeMs);
    }
    if (data.breached !== undefined) {
      fields.push(`breached = $${idx++}`);
      values.push(data.breached);
    }

    if (fields.length === 0) return null;

    values.push(id);
    const result = await this.db.query(
      `UPDATE ticket_sla_records SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );
    return result.rows[0] as SLARow | undefined;
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.db.query(
      `DELETE FROM ticket_sla_records WHERE id = $1`,
      [id]
    );
    return (result.rowCount || 0) > 0;
  }
}
