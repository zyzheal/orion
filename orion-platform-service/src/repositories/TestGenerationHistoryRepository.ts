import { BaseRepository } from '../db/base-repository';

export interface TestGenerationHistoryEntity {
  id: string;
  sourceFile: string | null;
  testFramework: string | null;
  generatedCount: number;
  status: string;
  result: Record<string, any>;
  tenantId: string | null;
  createdAt: Date;
}

export class TestGenerationHistoryRepository extends BaseRepository<TestGenerationHistoryEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'test_generation_history');
  }

  protected mapRowToEntity(row: any): TestGenerationHistoryEntity {
    return {
      id: row.id,
      sourceFile: row.source_file,
      testFramework: row.test_framework,
      generatedCount: row.generated_count,
      status: row.status,
      result: typeof row.result === 'string' ? JSON.parse(row.result) : (row.result || {}),
      tenantId: row.tenant_id,
      createdAt: row.created_at,
    };
  }
}
