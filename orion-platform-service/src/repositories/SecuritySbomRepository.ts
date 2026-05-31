import { BaseRepository } from '../db/base-repository';

export interface SecuritySbomEntity {
  id: string;
  imageName: string;
  format: string;
  generatedAt: Date;
  components: any[];
  rawDocument: string | null;
  tenantId: string | null;
  createdAt: Date;
}

export class SecuritySbomRepository extends BaseRepository<SecuritySbomEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'security_sbom_documents');
  }

  async findByImageName(imageName: string, limit: number = 5): Promise<SecuritySbomEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM security_sbom_documents WHERE image_name = $1 ORDER BY created_at DESC LIMIT $2`,
      [imageName, limit],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  protected mapRowToEntity(row: any): SecuritySbomEntity {
    return {
      id: row.id,
      imageName: row.image_name,
      format: row.format,
      generatedAt: row.generated_at,
      components: typeof row.components === 'string' ? JSON.parse(row.components) : (row.components || []),
      rawDocument: row.raw_document,
      tenantId: row.tenant_id,
      createdAt: row.created_at,
    };
  }
}
