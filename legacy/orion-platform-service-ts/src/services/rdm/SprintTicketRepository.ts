/**
 * Sprint Ticket Repository
 * Data access layer for sprint_ticket junction table
 */
import { getCurrentTenantId } from '../../db/tenant-context-storage';

export interface SprintTicketEntity {
  id: string;
  tenant_id: string;
  sprint_id: string;
  ticket_id: string;
  sort_order: number;
  created_at: string;
}

export class SprintTicketRepository {
  constructor(private pool: { query: (text: string, params?: any[]) => Promise<{ rows: any[]; rowCount: number }> }) {}

  async listBySprint(sprintId: string): Promise<SprintTicketEntity[]> {
    const tenantId = getCurrentTenantId();
    const { rows } = await this.pool.query(
      'SELECT * FROM sprint_ticket WHERE sprint_id = $1 AND tenant_id = $2 ORDER BY sort_order',
      [sprintId, tenantId]
    );
    return rows;
  }

  async addTicket(sprintId: string, ticketId: string, sortOrder?: number): Promise<SprintTicketEntity> {
    const tenantId = getCurrentTenantId();
    const { rows } = await this.pool.query(
      `INSERT INTO sprint_ticket (tenant_id, sprint_id, ticket_id, sort_order)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [tenantId, sprintId, ticketId, sortOrder ?? 0]
    );
    return rows[0];
  }

  async removeTicket(sprintId: string, ticketId: string): Promise<boolean> {
    const tenantId = getCurrentTenantId();
    const { rowCount } = await this.pool.query(
      'DELETE FROM sprint_ticket WHERE sprint_id = $1 AND ticket_id = $2 AND tenant_id = $3',
      [sprintId, ticketId, tenantId]
    );
    return (rowCount ?? 0) > 0;
  }

  async reorderTickets(sprintId: string, orders: { ticketId: string; sortOrder: number }[]): Promise<void> {
    const tenantId = getCurrentTenantId();
    const db = this.pool as any;
    if (db.transaction) {
      await db.transaction(async (client: any) => {
        for (const order of orders) {
          await client.query(
            'UPDATE sprint_ticket SET sort_order = $1 WHERE sprint_id = $2 AND ticket_id = $3 AND tenant_id = $4',
            [order.sortOrder, sprintId, order.ticketId, tenantId]
          );
        }
      });
    } else {
      for (const order of orders) {
        await this.pool.query(
          'UPDATE sprint_ticket SET sort_order = $1 WHERE sprint_id = $2 AND ticket_id = $3 AND tenant_id = $4',
          [order.sortOrder, sprintId, order.ticketId, tenantId]
        );
      }
    }
  }

  async isTicketInSprint(sprintId: string, ticketId: string): Promise<boolean> {
    const tenantId = getCurrentTenantId();
    const { rowCount } = await this.pool.query(
      'SELECT 1 FROM sprint_ticket WHERE sprint_id = $1 AND ticket_id = $2 AND tenant_id = $3',
      [sprintId, ticketId, tenantId]
    );
    return (rowCount ?? 0) > 0;
  }
}
