import { BaseRepository } from '../db/base-repository';

export interface TestTemplateEntity {
  id: string;
  name: string;
  language: string | null;
  framework: string | null;
  templateContent: string | null;
  description: string | null;
  tags: string[];
  tenantId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export class TestTemplateRepository extends BaseRepository<TestTemplateEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'test_templates');
  }

  async findByName(name: string): Promise<TestTemplateEntity | undefined> {
    const result = await this.db.query(
      `SELECT * FROM test_templates WHERE name = $1 LIMIT 1`,
      [name],
    );
    if (result.rows.length === 0) return undefined;
    return this.mapRowToEntity(result.rows[0]);
  }

  async findByFramework(framework: string): Promise<TestTemplateEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM test_templates WHERE framework = $1 ORDER BY name`,
      [framework],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  protected mapRowToEntity(row: any): TestTemplateEntity {
    return {
      id: row.id,
      name: row.name,
      language: row.language,
      framework: row.framework,
      templateContent: row.template_content,
      description: row.description,
      tags: typeof row.tags === 'string' ? JSON.parse(row.tags) : (row.tags || []),
      tenantId: row.tenant_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
