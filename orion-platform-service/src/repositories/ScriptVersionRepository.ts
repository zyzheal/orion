/**
 * ScriptVersionRepository
 *
 * Data access layer for script_versions table.
 * Provides CRUD for script content version tracking.
 */

import { BaseRepository, FindAllOptions, FindAllResult } from '../db/base-repository';
import { OrionError } from '../errors';
import type { ScriptVersionEntity, ScriptVersionFilter } from '../models/ScriptVersion';

export class ScriptVersionRepository extends BaseRepository<ScriptVersionEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'script_versions');
  }

  /**
   * Create a script version.
   */
  async create(data: Omit<ScriptVersionEntity, 'id' | 'created_at'> & Partial<Pick<ScriptVersionEntity, 'id'>>): Promise<ScriptVersionEntity> {
    const columns = ['tenant_id', 'script_id', 'version', 'content', 'content_hash', 'parameters', 'change_description', 'created_by'];
    const values = [
      data.tenant_id,
      data.script_id,
      data.version,
      data.content,
      data.content_hash,
      data.parameters ?? {},
      data.change_description ?? null,
      data.created_by,
    ];

    if (data.id !== undefined) {
      columns.unshift('id');
      values.unshift(data.id);
    }

    const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
    const query = `INSERT INTO script_versions (${columns.join(', ')}) VALUES (${placeholders}) RETURNING *`;
    const result = await this.db.query(query, values);

    if (result.rows.length === 0) {
      throw new OrionError(`INSERT into script_versions returned no rows`, 'OPERATION_FAILED');
    }
    return this.mapRowToEntity(result.rows[0]);
  }

  /**
   * Find all versions for a script.
   */
  async findByScriptId(tenantId: string, scriptId: string): Promise<ScriptVersionEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM script_versions WHERE tenant_id = $1 AND script_id = $2 ORDER BY created_at DESC`,
      [tenantId, scriptId],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  /**
   * Find latest version for a script.
   */
  async findLatestByScriptId(tenantId: string, scriptId: string): Promise<ScriptVersionEntity | null> {
    const result = await this.db.query(
      `SELECT * FROM script_versions WHERE tenant_id = $1 AND script_id = $2 ORDER BY created_at DESC LIMIT 1`,
      [tenantId, scriptId],
    );
    return result.rows.length > 0 ? this.mapRowToEntity(result.rows[0]) : null;
  }

  /**
   * Find by version string.
   */
  async findByVersion(tenantId: string, scriptId: string, version: string): Promise<ScriptVersionEntity | null> {
    const result = await this.db.query(
      `SELECT * FROM script_versions WHERE tenant_id = $1 AND script_id = $2 AND version = $3`,
      [tenantId, scriptId, version],
    );
    return result.rows.length > 0 ? this.mapRowToEntity(result.rows[0]) : null;
  }

  /**
   * Find by filter criteria.
   */
  async findByFilter(filter: ScriptVersionFilter): Promise<ScriptVersionEntity[]> {
    let query = 'SELECT * FROM script_versions WHERE 1=1';
    const params: unknown[] = [];
    let paramIdx = 1;

    query += ` AND tenant_id = $${paramIdx++}`;
    params.push(filter.tenantId);

    if (filter.scriptId) {
      query += ` AND script_id = $${paramIdx++}`;
      params.push(filter.scriptId);
    }
    if (filter.version) {
      query += ` AND version = $${paramIdx++}`;
      params.push(filter.version);
    }
    if (filter.createdBy) {
      query += ` AND created_by = $${paramIdx++}`;
      params.push(filter.createdBy);
    }

    query += ' ORDER BY created_at DESC';
    const result = await this.db.query(query, params);
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  /**
   * Delete a script version.
   */
  async delete(id: string): Promise<boolean> {
    const result = await this.db.query('DELETE FROM script_versions WHERE id = $1', [id]);
    return (result.rowCount ?? 0) > 0;
  }

  // ==================== Pagination ====================

  async list(options: FindAllOptions = {}): Promise<FindAllResult<ScriptVersionEntity>> {
    return this.findAll(options);
  }

  // ==================== Mapping ====================

  protected mapRowToEntity(row: any): ScriptVersionEntity {
    return {
      id: row.id,
      tenant_id: row.tenant_id,
      script_id: row.script_id,
      version: row.version,
      content: row.content,
      content_hash: row.content_hash,
      parameters: row.parameters ?? {},
      change_description: row.change_description ?? null,
      created_by: row.created_by,
      created_at: row.created_at,
    };
  }

  // Public mapper for testing
  mapRowToEntityPublic(row: any): ScriptVersionEntity {
    return this.mapRowToEntity(row);
  }
}
