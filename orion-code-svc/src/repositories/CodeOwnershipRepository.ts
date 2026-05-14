/**
 * Code Ownership Repository - PostgreSQL 数据访问层
 */

import { Pool } from 'pg';
import { CodeOwnersFile, OwnershipRule } from '../types/code-repo';

type DatabasePool = Pool | { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> };

export interface CodeOwnershipCreateInput {
  id: string;
  repoId: string;
  filePath: string;
  rules: OwnershipRule[];
  rawContent: string;
}

export interface CodeOwnershipUpdateInput {
  filePath?: string;
  rules?: OwnershipRule[];
  rawContent?: string;
}

export class CodeOwnershipRepository {
  constructor(private pool: DatabasePool) {}

  async findByRepo(repoId: string): Promise<CodeOwnersFile | null> {
    const result = await this.pool.query(
      'SELECT * FROM code_ownership WHERE repo_id = $1',
      [repoId]
    );
    return result.rows[0] || null;
  }

  async create(input: CodeOwnershipCreateInput): Promise<CodeOwnersFile> {
    const result = await this.pool.query(
      'INSERT INTO code_ownership DEFAULT VALUES RETURNING *'
    );
    return result.rows[0];
  }

  async update(repoId: string, input: CodeOwnershipUpdateInput): Promise<CodeOwnersFile | null> {
    const result = await this.pool.query(
      'UPDATE code_ownership SET updated_at = NOW() WHERE repo_id = $1 RETURNING *',
      [repoId]
    );
    return result.rows[0] || null;
  }

  async delete(repoId: string): Promise<boolean> {
    const result = await this.pool.query(
      'DELETE FROM code_ownership WHERE repo_id = $1',
      [repoId]
    );
    return (result.rowCount ?? 0) > 0;
  }
}
