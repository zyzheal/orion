import { BaseRepository } from '../db/base-repository';

export interface IntegrationMappingEntity {
  id: string;
  integrationId: string;
  resourceType: string;
  resourceId: string | null;
  externalId: string | null;
  metadata: Record<string, any>;
  createdAt: Date;
}

export class IntegrationMappingRepository extends BaseRepository<IntegrationMappingEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'integration_mappings');
  }

  async findByIntegrationId(integrationId: string): Promise<IntegrationMappingEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM integration_mappings WHERE integration_id = $1 ORDER BY created_at DESC`,
      [integrationId],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  protected mapRowToEntity(row: any): IntegrationMappingEntity {
    return {
      id: row.id,
      integrationId: row.integration_id,
      resourceType: row.resource_type,
      resourceId: row.resource_id,
      externalId: row.external_id,
      metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata) : (row.metadata || {}),
      createdAt: row.created_at,
    };
  }
}
