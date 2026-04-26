/**
 * Plugin Repository Interface
 * 插件数据访问层
 */

import { PluginInfo, PluginType, PluginState } from '../services/plugin-manager-service';

export interface PluginRepository {
  create(plugin: PluginInfo): Promise<void>;
  findById(id: string): Promise<PluginInfo | undefined>;
  findByName(name: string, version?: string): Promise<PluginInfo | undefined>;
  findByType(type: PluginType): Promise<PluginInfo[]>;
  findByState(state: PluginState): Promise<PluginInfo[]>;
  findByTag(tag: string): Promise<PluginInfo[]>;
  update(plugin: PluginInfo): Promise<void>;
  delete(id: string): Promise<void>;
  softDelete(id: string): Promise<void>;
  updateState(id: string, state: PluginState): Promise<void>;
  updateConfig(id: string, config: Record<string, any>): Promise<void>;
  addTag(id: string, tag: string): Promise<void>;
  removeTag(id: string, tag: string): Promise<void>;
  getTags(id: string): Promise<string[]>;
  search(query: string): Promise<PluginInfo[]>;
  list(options: {
    type?: PluginType;
    state?: PluginState;
    tags?: string[];
    limit?: number;
    offset?: number;
    sortBy?: 'createdAt' | 'updatedAt' | 'name' | 'version';
    sortOrder?: 'ASC' | 'DESC';
  }): Promise<{ plugins: PluginInfo[]; total: number }>;
  getStats(): Promise<{
    total: number;
    byType: Record<PluginType, number>;
    byState: Record<PluginState, number>;
  }>;
}

export class PostgresPluginRepository implements PluginRepository {
  constructor(private db: any) {}

  async create(plugin: PluginInfo): Promise<void> {
    const query = `
      INSERT INTO plugins (
        id, name, version, description, author, tags, type, security_level,
        config_schema, state, installed_at, updated_at, config
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
    `;
    
    await this.db.query(query, [
      plugin.id,
      plugin.name,
      plugin.version,
      plugin.description,
      plugin.author,
      JSON.stringify(plugin.tags),
      plugin.type,
      plugin.securityLevel,
      JSON.stringify(plugin.configSchema),
      plugin.state,
      plugin.installedAt,
      plugin.updatedAt,
      JSON.stringify(plugin.config || {})
    ]);
  }

  async findById(id: string): Promise<PluginInfo | undefined> {
    const query = `
      SELECT * FROM plugins WHERE id = $1
    `;
    
    const result = await this.db.query(query, [id]);
    
    if (result.rows.length === 0) {
      return undefined;
    }

    return this.mapRowToPlugin(result.rows[0]);
  }

  async findByName(name: string, version?: string): Promise<PluginInfo | undefined> {
    let query = `
      SELECT * FROM plugins WHERE name = $1
    `;
    const queryParams: any[] = [name];

    if (version) {
      query += ' AND version = $2';
      queryParams.push(version);
    }

    const result = await this.db.query(query, queryParams);

    if (result.rows.length === 0) {
      return undefined;
    }

    return this.mapRowToPlugin(result.rows[0]);
  }

  async findByType(type: PluginType): Promise<PluginInfo[]> {
    const query = `
      SELECT * FROM plugins WHERE type = $1 ORDER BY created_at DESC
    `;

    const result = await this.db.query(query, [type]);
    return result.rows.map((row: any) => this.mapRowToPlugin(row));
  }

  async findByState(state: PluginState): Promise<PluginInfo[]> {
    const query = `
      SELECT * FROM plugins WHERE state = $1 ORDER BY updated_at DESC
    `;

    const result = await this.db.query(query, [state]);
    return result.rows.map((row: any) => this.mapRowToPlugin(row));
  }

  async findByTag(tag: string): Promise<PluginInfo[]> {
    const query = `
      SELECT p.* FROM plugins p
      JOIN plugin_tags pt ON p.id = pt.plugin_id
      WHERE pt.tag = $1 ORDER BY p.updated_at DESC
    `;

    const result = await this.db.query(query, [tag]);
    return result.rows.map((row: any) => this.mapRowToPlugin(row));
  }

  async update(plugin: PluginInfo): Promise<void> {
    const query = `
      UPDATE plugins SET
        name = $2,
        version = $3,
        description = $4,
        author = $5,
        tags = $6,
        type = $7,
        security_level = $8,
        config_schema = $9,
        state = $10,
        installed_at = $11,
        updated_at = $12,
        config = $13
      WHERE id = $1
    `;
    
    await this.db.query(query, [
      plugin.id,
      plugin.name,
      plugin.version,
      plugin.description,
      plugin.author,
      JSON.stringify(plugin.tags),
      plugin.type,
      plugin.securityLevel,
      JSON.stringify(plugin.configSchema),
      plugin.state,
      plugin.installedAt,
      plugin.updatedAt,
      JSON.stringify(plugin.config || {})
    ]);
  }

  async delete(id: string): Promise<void> {
    const query = `
      DELETE FROM plugins WHERE id = $1
    `;
    
    await this.db.query(query, [id]);
  }

  async softDelete(id: string): Promise<void> {
    const query = `
      UPDATE plugins SET state = 'UNINSTALLED', updated_at = NOW() WHERE id = $1
    `;
    
    await this.db.query(query, [id]);
  }

  async updateState(id: string, state: PluginState): Promise<void> {
    const query = `
      UPDATE plugins SET state = $2, updated_at = NOW() WHERE id = $1
    `;
    
    await this.db.query(query, [id, state]);
  }

  async updateConfig(id: string, config: Record<string, any>): Promise<void> {
    const query = `
      UPDATE plugins SET config = $2, updated_at = NOW() WHERE id = $1
    `;
    
    await this.db.query(query, [id, JSON.stringify(config)]);
  }

  async addTag(id: string, tag: string): Promise<void> {
    const query = `
      INSERT INTO plugin_tags (plugin_id, tag, created_at)
      VALUES ($1, $2, NOW())
      ON CONFLICT (plugin_id, tag) DO NOTHING
    `;
    
    await this.db.query(query, [id, tag]);
  }

  async removeTag(id: string, tag: string): Promise<void> {
    const query = `
      DELETE FROM plugin_tags WHERE plugin_id = $1 AND tag = $2
    `;
    
    await this.db.query(query, [id, tag]);
  }

  async getTags(id: string): Promise<string[]> {
    const query = `
      SELECT tag FROM plugin_tags WHERE plugin_id = $1 ORDER BY created_at DESC
    `;
    
    const result = await this.db.query(query, [id]);
    return result.rows.map((row: any) => row.tag);
  }

  async search(query: string): Promise<PluginInfo[]> {
    const searchQuery = `
      SELECT * FROM plugins 
      WHERE name ILIKE $1 OR description ILIKE $1 OR author ILIKE $1
      ORDER BY created_at DESC
      LIMIT 50
    `;
    
    const searchTerm = `%${query}%`;
    const result = await this.db.query(searchQuery, [searchTerm]);
    return result.rows.map((row: any) => this.mapRowToPlugin(row));
  }

  async list(options: {
    type?: PluginType;
    state?: PluginState;
    tags?: string[];
    limit?: number;
    offset?: number;
    sortBy?: 'createdAt' | 'updatedAt' | 'name' | 'version';
    sortOrder?: 'ASC' | 'DESC';
  }): Promise<{ plugins: PluginInfo[]; total: number }> {
    let query = `
      SELECT p.* FROM plugins p
      WHERE 1=1
    `;
    
    const queryParams: any[] = [];
    let paramIndex = 1;
    
    // 添加过滤条件
    if (options.type) {
      query += ` AND p.type = $${paramIndex}`;
      queryParams.push(options.type);
      paramIndex++;
    }
    
    if (options.state) {
      query += ` AND p.state = $${paramIndex}`;
      queryParams.push(options.state);
      paramIndex++;
    }
    
    if (options.tags && options.tags.length > 0) {
      query += ` AND p.id IN (
        SELECT DISTINCT plugin_id FROM plugin_tags 
        WHERE tag = ANY($${paramIndex})
      )`;
      queryParams.push(options.tags);
      paramIndex++;
    }
    
    // 添加排序
    const sortBy = options.sortBy || 'createdAt';
    const sortOrder = options.sortOrder || 'DESC';
    query += ` ORDER BY p.${sortBy} ${sortOrder}`;
    
    // 添加分页
    const limit = options.limit || 20;
    const offset = options.offset || 0;
    query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    queryParams.push(limit, offset);
    
    // 执行查询
    const result = await this.db.query(query, queryParams);
    
    // 获取总数
    const countQuery = query.replace('SELECT p.* FROM plugins p', 'SELECT COUNT(*) FROM plugins p').split(' LIMIT ')[0];
    const countResult = await this.db.query(countQuery, queryParams.slice(0, -2));
    
    return {
      plugins: result.rows.map((row: any) => this.mapRowToPlugin(row)),
      total: parseInt(countResult.rows[0].count)
    };
  }

  async getStats(): Promise<{
    total: number;
    byType: Record<PluginType, number>;
    byState: Record<PluginState, number>;
  }> {
    const query = `
      SELECT 
        COUNT(*) as total,
        JSON_OBJECT_AGG(type, COUNT(*)) as by_type,
        JSON_OBJECT_AGG(state, COUNT(*)) as by_state
      FROM plugins
    `;
    
    const result = await this.db.query(query);
    const row = result.rows[0];
    
    return {
      total: parseInt(row.total),
      byType: row.by_type || {},
      byState: row.by_state || {}
    };
  }

  private mapRowToPlugin(row: any): PluginInfo {
    return {
      id: row.id,
      name: row.name,
      version: row.version,
      description: row.description,
      author: row.author,
      tags: row.tags || [],
      type: row.type,
      securityLevel: row.security_level,
      configSchema: row.config_schema || {},
      state: row.state,
      installedAt: row.installed_at,
      updatedAt: row.updated_at,
      config: row.config || {}
    };
  }
}