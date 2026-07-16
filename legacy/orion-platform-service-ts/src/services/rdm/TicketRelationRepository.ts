/**
 * Ticket Relation Repository
 * Data access layer for ticket_relation table
 */
import { getCurrentTenantId } from '../../db/tenant-context-storage';

export interface TicketRelationEntity {
  id: string;
  tenant_id: string;
  source_ticket_id: string;
  target_ticket_id: string;
  relation_type: string;
  created_at: string;
}

export class TicketRelationRepository {
  constructor(private pool: { query: (text: string, params?: any[]) => Promise<{ rows: any[]; rowCount: number }> }) {}

  async getRelations(ticketId: string): Promise<TicketRelationEntity[]> {
    const tenantId = getCurrentTenantId();
    const { rows } = await this.pool.query(
      `SELECT * FROM ticket_relation
       WHERE (source_ticket_id = $1 OR target_ticket_id = $1) AND tenant_id = $2`,
      [ticketId, tenantId]
    );
    return rows;
  }

  async addRelation(data: { source_ticket_id: string; target_ticket_id: string; relation_type: string }): Promise<TicketRelationEntity> {
    const tenantId = getCurrentTenantId();
    const { rows } = await this.pool.query(
      `INSERT INTO ticket_relation (tenant_id, source_ticket_id, target_ticket_id, relation_type)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [tenantId, data.source_ticket_id, data.target_ticket_id, data.relation_type]
    );
    return rows[0];
  }

  async removeRelation(id: string): Promise<boolean> {
    const tenantId = getCurrentTenantId();
    const { rowCount } = await this.pool.query(
      'DELETE FROM ticket_relation WHERE id = $1 AND tenant_id = $2',
      [id, tenantId]
    );
    return (rowCount ?? 0) > 0;
  }

  async getRelated(ticketId: string, relationType?: string): Promise<TicketRelationEntity[]> {
    const tenantId = getCurrentTenantId();
    let query = `SELECT * FROM ticket_relation WHERE (source_ticket_id = $1 OR target_ticket_id = $1) AND tenant_id = $2`;
    const params: any[] = [ticketId, tenantId];
    if (relationType) {
      query += ' AND relation_type = $3';
      params.push(relationType);
    }
    const { rows } = await this.pool.query(query, params);
    return rows;
  }
}
