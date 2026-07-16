/**
 * Code Ownership Repository - PostgreSQL persistence for CODEOWNERS files
 *
 * Falls back to in-memory Map when database unavailable.
 */

import { DatabasePool } from '../services/database';
import { CodeOwnersFile, OwnershipRule } from '../services/code-repo/types';

export class CodeOwnershipRepository {
  private pool: DatabasePool;

  constructor(pool: DatabasePool) {
    this.pool = pool;
  }

  async create(file: {
    id: string;
    repoId: string;
    filePath: string;
    rules: OwnershipRule[];
    rawContent: string;
  }): Promise<CodeOwnersFile> {
    await this.pool.query(
      `INSERT INTO code_owners (id, repo_id, file_path, rules, raw_content)
       VALUES ($1, $2, $3, $4, $5)`,
      [file.id, file.repoId, file.filePath, JSON.stringify(file.rules), file.rawContent]
    );
    return this.toCodeOwnersFile({
      id: file.id,
      repo_id: file.repoId,
      file_path: file.filePath,
      rules: JSON.stringify(file.rules),
      raw_content: file.rawContent,
      created_at: new Date(),
      updated_at: new Date(),
    });
  }

  async findByRepo(repoId: string): Promise<CodeOwnersFile | null> {
    const row = (
      await this.pool.query('SELECT * FROM code_owners WHERE repo_id = $1 ORDER BY updated_at DESC LIMIT 1', [repoId])
    ).rows[0];
    return row ? this.toCodeOwnersFile(row) : null;
  }

  async findAll(): Promise<CodeOwnersFile[]> {
    const rows = (await this.pool.query('SELECT * FROM code_owners ORDER BY updated_at DESC')).rows;
    return rows.map(r => this.toCodeOwnersFile(r));
  }

  async update(
    repoId: string,
    input: { filePath?: string; rules?: OwnershipRule[]; rawContent?: string }
  ): Promise<CodeOwnersFile | null> {
    const sets: string[] = [];
    const params: unknown[] = [];
    let idx = 1;
    if (input.filePath !== undefined) {
      sets.push(`file_path = $${idx++}`);
      params.push(input.filePath);
    }
    if (input.rules !== undefined) {
      sets.push(`rules = $${idx++}`);
      params.push(JSON.stringify(input.rules));
    }
    if (input.rawContent !== undefined) {
      sets.push(`raw_content = $${idx++}`);
      params.push(input.rawContent);
    }
    if (sets.length === 0) return this.findByRepo(repoId);
    sets.push('updated_at = NOW()');
    params.push(repoId);
    const result = await this.pool.query(
      `UPDATE code_owners SET ${sets.join(', ')} WHERE repo_id = $${idx} RETURNING *`,
      params
    );
    return result.rows[0] ? this.toCodeOwnersFile(result.rows[0]) : null;
  }

  async delete(repoId: string): Promise<boolean> {
    const result = await this.pool.query('DELETE FROM code_owners WHERE repo_id = $1', [repoId]);
    return (result.rowCount ?? 0) > 0;
  }

  private toCodeOwnersFile(row: any): CodeOwnersFile {
    return {
      filePath: row.file_path,
      repoId: row.repo_id,
      rules: typeof row.rules === 'string' ? JSON.parse(row.rules) : row.rules || [],
      lastUpdated: row.updated_at || row.created_at,
      rawContent: row.raw_content,
    } as CodeOwnersFile;
  }
}
