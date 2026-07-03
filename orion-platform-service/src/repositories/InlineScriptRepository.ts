/**
 * InlineScriptRepository - 内联脚本数据访问层
 *
 * 负责 inline_scripts 表的 CRUD 操作，支持 DB 失败时降级到内存 Map。
 */

import { BaseRepository, FindAllOptions, FindAllResult } from '../db/base-repository';
import { OrionError, ErrorCode } from '../errors';
import { createLogger } from '../utils/logger';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

export interface InlineScriptEntity {
  id: string;
  tenantId: string;
  name: string;
  scriptContent: string;
  language: string;
  description?: string;
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface InlineScriptCreateInput {
  id?: string;
  tenantId: string;
  name: string;
  scriptContent: string;
  language?: string;
  description?: string;
  createdBy?: string;
}

export interface InlineScriptUpdateInput {
  name?: string;
  scriptContent?: string;
  language?: string;
  description?: string;
}

/**
 * In-memory fallback store for when DB is unavailable.
 * Keyed by (tenantId, name) for uniqueness.
 */
class MemoryFallbackStore {
  private store = new Map<string, InlineScriptEntity>();

  private key(tenantId: string, name: string): string {
    return `${tenantId}::${name}`;
  }

  async findById(id: string): Promise<InlineScriptEntity | undefined> {
    for (const entity of this.store.values()) {
      if (entity.id === id) return entity;
    }
    return undefined;
  }

  async findAll(_options?: FindAllOptions): Promise<FindAllResult<InlineScriptEntity>> {
    const entities = Array.from(this.store.values());
    return { entities, total: entities.length };
  }

  async listByTenant(tenantId: string): Promise<InlineScriptEntity[]> {
    return Array.from(this.store.values()).filter(e => e.tenantId === tenantId);
  }

  async create(data: InlineScriptCreateInput): Promise<InlineScriptEntity> {
    const now = new Date();
    const entity: InlineScriptEntity = {
      id: data.id || `mem-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      tenantId: data.tenantId,
      name: data.name,
      scriptContent: data.scriptContent,
      language: data.language || 'shell',
      description: data.description,
      createdBy: data.createdBy,
      createdAt: now,
      updatedAt: now,
    };
    this.store.set(this.key(data.tenantId, data.name), entity);
    return entity;
  }

  async update(id: string, data: InlineScriptUpdateInput): Promise<InlineScriptEntity> {
    for (const [, entity] of this.store) {
      if (entity.id === id) {
        Object.assign(entity, {
          name: data.name ?? entity.name,
          scriptContent: data.scriptContent ?? entity.scriptContent,
          language: data.language ?? entity.language,
          description: data.description ?? entity.description,
          updatedAt: new Date(),
        });
        return { ...entity };
      }
    }
    throw new OrionError(`Inline script ${id} not found in memory store`, ErrorCode.NOT_FOUND);
  }

  async delete(id: string): Promise<boolean> {
    for (const [k, entity] of this.store) {
      if (entity.id === id) {
        this.store.delete(k);
        return true;
      }
    }
    return false;
  }

  async deleteByTenant(tenantId: string): Promise<number> {
    let count = 0;
    for (const [k, entity] of this.store) {
      if (entity.tenantId === tenantId) {
        this.store.delete(k);
        count++;
      }
    }
    return count;
  }
}

/**
 * InlineScriptRepository with DB-first and memory fallback.
 *
 * When db is provided and queries succeed, uses PostgreSQL.
 * When db is not provided or a query fails, silently degrades to
 * an in-memory store so that service functionality continues.
 */
export class InlineScriptRepository {
  private baseRepo: BaseRepository<InlineScriptEntity> | null;
  private memory = new MemoryFallbackStore();

  constructor(db?: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    if (db) {
      try {
        // Initialize BaseRepository with 'inline_scripts' table name
        // We extend internally rather than passing down, since BaseRepository expects specific contract
        this.baseRepo = new (class extends BaseRepository<InlineScriptEntity> {
          constructor(dbConn: typeof db) {
            super(dbConn as { query: (text: string, params?: any[]) => Promise<{ rows: any[]; rowCount: number | null }> }, 'inline_scripts');
          }
          protected mapRowToEntity(row: any): InlineScriptEntity {
            return {
              id: row.id,
              tenantId: row.tenant_id,
              name: row.name,
              scriptContent: row.script_content,
              language: row.language || 'shell',
              description: row.description || undefined,
              createdBy: row.created_by || undefined,
              createdAt: row.created_at,
              updatedAt: row.updated_at,
            };
          }
        })(db);
      } catch (err) {
        logger.warn({ err }, '[InlineScriptRepository] Failed to init BaseRepository, using memory fallback');
        this.baseRepo = null;
      }
    } else {
      this.baseRepo = null;
    }
  }

  /**
   * Find script by ID with tenant isolation. Falls back to memory on DB failure.
   */
  async findById(id: string, tenantId?: string): Promise<InlineScriptEntity | undefined> {
    if (this.baseRepo) {
      try {
        let query = `SELECT * FROM inline_scripts WHERE id = $1`;
        const params: unknown[] = [id];

        if (tenantId) {
          query += ` AND tenant_id = $2`;
          params.push(tenantId);
        }

        const result = await this.baseRepo['db'].query(query, params);
        if (result.rows.length === 0) return undefined;
        return this.mapRowToEntity(result.rows[0]);
      } catch (err) {
        logger.warn({ err, id }, '[InlineScriptRepository] DB query failed, falling back to memory');
        return this.memory.findById(id);
      }
    }
    return this.memory.findById(id);
  }

  /**
   * List all scripts for a tenant. Falls back to memory on DB failure.
   */
  async listByTenant(tenantId: string, _options?: FindAllOptions): Promise<FindAllResult<InlineScriptEntity>> {
    if (this.baseRepo) {
      try {
        const { orderBy = 'created_at', orderDir = 'DESC', limit = 20, offset = 0 } = _options || {};
        const result = await this.baseRepo['db'].query(
          `SELECT * FROM inline_scripts WHERE tenant_id = $1 ORDER BY ${orderBy} ${orderDir} LIMIT $2 OFFSET $3`,
          [tenantId, limit, offset],
        );
        const total = result.rows.length > 0 ? result.rowCount ?? 0 : 0;
        // Get actual total count
        const countResult = await this.baseRepo['db'].query(
          `SELECT COUNT(*) as count FROM inline_scripts WHERE tenant_id = $1`,
          [tenantId],
        );
        const entities = result.rows.map(row => this.mapRowToEntity(row));
        return { entities, total: parseInt(countResult.rows[0].count, 10) };
      } catch (err) {
        logger.warn({ err, tenantId }, '[InlineScriptRepository] DB query failed, falling back to memory');
        const entities = await this.memory.listByTenant(tenantId);
        return { entities, total: entities.length };
      }
    }
    const entities = await this.memory.listByTenant(tenantId);
    return { entities, total: entities.length };
  }

  /**
   * Create a new inline script. Falls back to memory on DB failure.
   */
  async create(data: InlineScriptCreateInput): Promise<InlineScriptEntity> {
    if (this.baseRepo) {
      try {
        const id = data.id || this.generateId();
        const result = await this.baseRepo['db'].query(
          `INSERT INTO inline_scripts (id, tenant_id, name, script_content, language, description, created_by, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
           RETURNING *`,
          [
            id,
            data.tenantId,
            data.name,
            data.scriptContent,
            data.language || 'shell',
            data.description || null,
            data.createdBy || null,
          ],
        );
        if (result.rows.length === 0) {
          throw new OrionError('INSERT into inline_scripts returned no rows', ErrorCode.OPERATION_FAILED);
        }
        return this.mapRowToEntity(result.rows[0]);
      } catch (err) {
        logger.warn({ err, name: data.name }, '[InlineScriptRepository] DB create failed, falling back to memory');
        return this.memory.create(data);
      }
    }
    return this.memory.create(data);
  }

  /**
   * Update an inline script by ID. Falls back to memory on DB failure.
   */
  async update(id: string, data: InlineScriptUpdateInput, tenantId?: string): Promise<InlineScriptEntity> {
    if (this.baseRepo) {
      try {
        const sets: string[] = [];
        const params: unknown[] = [];
        let paramIdx = 1;

        if (data.name !== undefined) {
          sets.push(`name = $${paramIdx}`);
          params.push(data.name);
          paramIdx++;
        }
        if (data.scriptContent !== undefined) {
          sets.push(`script_content = $${paramIdx}`);
          params.push(data.scriptContent);
          paramIdx++;
        }
        if (data.language !== undefined) {
          sets.push(`language = $${paramIdx}`);
          params.push(data.language);
          paramIdx++;
        }
        if (data.description !== undefined) {
          sets.push(`description = $${paramIdx}`);
          params.push(data.description);
          paramIdx++;
        }

        if (sets.length === 0) {
          throw new OrionError('Update requires at least one field', ErrorCode.VALIDATION_ERROR);
        }

        sets.push(`updated_at = NOW()`);

        const whereClause = tenantId
          ? `WHERE id = $${paramIdx} AND tenant_id = $${paramIdx + 1}`
          : `WHERE id = $${paramIdx}`;
        params.push(id);
        if (tenantId) {
          params.push(tenantId);
        }

        const result = await this.baseRepo['db'].query(
          `UPDATE inline_scripts SET ${sets.join(', ')} ${whereClause} RETURNING *`,
          params,
        );

        if (result.rows.length === 0) {
          throw new OrionError(`UPDATE on inline_scripts affected no rows (id: ${id})`, ErrorCode.OPERATION_FAILED);
        }
        return this.mapRowToEntity(result.rows[0]);
      } catch (err) {
        logger.warn({ err, id }, '[InlineScriptRepository] DB update failed, falling back to memory');
        return this.memory.update(id, data);
      }
    }
    return this.memory.update(id, data);
  }

  /**
   * Delete an inline script by ID. Falls back to memory on DB failure.
   */
  async delete(id: string, tenantId?: string): Promise<boolean> {
    if (this.baseRepo) {
      try {
        let query: string;
        let params: unknown[];

        if (tenantId) {
          query = `DELETE FROM inline_scripts WHERE id = $1 AND tenant_id = $2`;
          params = [id, tenantId];
        } else {
          query = `DELETE FROM inline_scripts WHERE id = $1`;
          params = [id];
        }

        const result = await this.baseRepo['db'].query(query, params);
        return (result.rowCount ?? 0) > 0;
      } catch (err) {
        logger.warn({ err, id }, '[InlineScriptRepository] DB delete failed, falling back to memory');
        return this.memory.delete(id);
      }
    }
    return this.memory.delete(id);
  }

  /**
   * Delete all scripts for a tenant. Falls back to memory on DB failure.
   */
  async deleteByTenant(tenantId: string): Promise<number> {
    if (this.baseRepo) {
      try {
        const result = await this.baseRepo['db'].query(
          `DELETE FROM inline_scripts WHERE tenant_id = $1`,
          [tenantId],
        );
        return result.rowCount ?? 0;
      } catch (err) {
        logger.warn({ err, tenantId }, '[InlineScriptRepository] DB delete-by-tenant failed, falling back to memory');
        return this.memory.deleteByTenant(tenantId);
      }
    }
    return this.memory.deleteByTenant(tenantId);
  }

  /**
   * Find script by tenant + name (unique business key within tenant).
   */
  async findByTenantAndName(tenantId: string, name: string): Promise<InlineScriptEntity | undefined> {
    if (this.baseRepo) {
      try {
        const result = await this.baseRepo['db'].query(
          `SELECT * FROM inline_scripts WHERE tenant_id = $1 AND name = $2`,
          [tenantId, name],
        );
        if (result.rows.length === 0) return undefined;
        return this.mapRowToEntity(result.rows[0]);
      } catch (err) {
        logger.warn({ err, tenantId, name }, '[InlineScriptRepository] DB findByTenantAndName failed, falling back to memory');
        const scripts = await this.memory.listByTenant(tenantId);
        return scripts.find(s => s.name === name);
      }
    }
    const scripts = await this.memory.listByTenant(tenantId);
    return scripts.find(s => s.name === name);
  }

  /**
   * Check if a script with the given name already exists for a tenant.
   */
  async existsByTenantAndName(tenantId: string, name: string): Promise<boolean> {
    if (this.baseRepo) {
      try {
        const result = await this.baseRepo['db'].query(
          `SELECT 1 FROM inline_scripts WHERE tenant_id = $1 AND name = $2 LIMIT 1`,
          [tenantId, name],
        );
        return result.rows.length > 0;
      } catch (err) {
        logger.warn({ err, tenantId, name }, '[InlineScriptRepository] DB exists check failed, falling back to memory');
        const scripts = await this.memory.listByTenant(tenantId);
        return scripts.some(s => s.name === name);
      }
    }
    const scripts = await this.memory.listByTenant(tenantId);
    return scripts.some(s => s.name === name);
  }

  // ---- Internal helpers ----

  private mapRowToEntity(row: any): InlineScriptEntity {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      name: row.name,
      scriptContent: row.script_content,
      language: row.language || 'shell',
      description: row.description || undefined,
      createdBy: row.created_by || undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private generateId(): string {
    try {
      return require('crypto').randomUUID();
    } catch {
      return `inline-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    }
  }
}
