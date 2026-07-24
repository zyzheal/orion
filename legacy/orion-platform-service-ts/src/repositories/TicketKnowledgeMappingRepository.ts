import { BaseRepository } from '../db/base-repository';

export interface TicketKnowledgeMappingEntity {
  id: string;
  tenantId: string;
  ticketId: string;
  knowledgeDocId: string;
  convertedBy: string;
  convertedAt: Date;
  conversionType: string;
  includeComments: boolean;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

export class TicketKnowledgeMappingRepository extends BaseRepository<TicketKnowledgeMappingEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'ticket_knowledge_mapping');
  }

  async findByTicketId(tenantId: string, ticketId: string): Promise<TicketKnowledgeMappingEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM ticket_knowledge_mapping WHERE tenant_id = $1 AND ticket_id = $2 ORDER BY converted_at DESC`,
      [tenantId, ticketId],
    );
    return result.rows.map((row) => this.mapRowToEntity(row));
  }

  async findByKnowledgeDocId(tenantId: string, knowledgeDocId: string): Promise<TicketKnowledgeMappingEntity | undefined> {
    const result = await this.db.query(
      `SELECT * FROM ticket_knowledge_mapping WHERE tenant_id = $1 AND knowledge_doc_id = $2`,
      [tenantId, knowledgeDocId],
    );
    if (result.rows.length === 0) return undefined;
    return this.mapRowToEntity(result.rows[0]);
  }

  async existsByTicketId(tenantId: string, ticketId: string): Promise<boolean> {
    const result = await this.db.query(
      `SELECT 1 FROM ticket_knowledge_mapping WHERE tenant_id = $1 AND ticket_id = $2 LIMIT 1`,
      [tenantId, ticketId],
    );
    return result.rows.length > 0;
  }

  async findByConvertedBy(tenantId: string, convertedBy: string, limit: number = 20): Promise<TicketKnowledgeMappingEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM ticket_knowledge_mapping WHERE tenant_id = $1 AND converted_by = $2 ORDER BY converted_at DESC LIMIT $3`,
      [tenantId, convertedBy, limit],
    );
    return result.rows.map((row) => this.mapRowToEntity(row));
  }

  protected mapRowToEntity(row: any): TicketKnowledgeMappingEntity {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      ticketId: row.ticket_id,
      knowledgeDocId: row.knowledge_doc_id,
      convertedBy: row.converted_by,
      convertedAt: row.converted_at,
      conversionType: row.conversion_type || 'manual',
      includeComments: row.include_comments ?? false,
      metadata: row.metadata ?? {},
      createdAt: row.created_at,
    };
  }
}
