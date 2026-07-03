/**
 * LowcodeFlowTemplatePgRepository - 低代码流程模板 PostgreSQL Repository
 *
 * 负责模板市场的 CRUD 操作，继承 BaseRepository 获得标准 CRUD。
 */
import { BaseRepository } from '../../db/base-repository';

export interface LowcodeFlowTemplateEntity {
  id: string;
  tenant_id: string;
  name: string;
  description: string;
  category: string;
  tags: string[];
  nodes: string;
  edges: string;
  icon: string;
  usage_count: number;
  is_public: boolean;
  created_by: string;
  created_at: Date;
  updated_at: Date;
}

export class LowcodeFlowTemplatePgRepository extends BaseRepository<LowcodeFlowTemplateEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'lowcode_flow_template');
  }

  /**
   * 列出所有公开模板
   */
  async findPublic(options?: { category?: string; limit?: number; offset?: number }): Promise<LowcodeFlowTemplateEntity[]> {
    let query = `SELECT * FROM lowcode_flow_template WHERE is_public = TRUE`;
    const values: any[] = [];

    if (options?.category) {
      values.push(options.category);
      query += ` AND category = $${values.length}`;
    }

    query += ` ORDER BY usage_count DESC, created_at DESC`;

    if (options?.limit) {
      values.push(options.limit);
      query += ` LIMIT $${values.length}`;
    }
    if (options?.offset) {
      values.push(options.offset);
      query += ` OFFSET $${values.length}`;
    }

    const result = await this.db.query(query, values);
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  /**
   * 按分类查找模板
   */
  async findByCategory(category: string, limit: number = 50): Promise<LowcodeFlowTemplateEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM lowcode_flow_template WHERE category = $1 ORDER BY usage_count DESC LIMIT $2`,
      [category, limit],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  /**
   * 按名称查找模板
   */
  async findByName(name: string): Promise<LowcodeFlowTemplateEntity | undefined> {
    const result = await this.db.query(
      `SELECT * FROM lowcode_flow_template WHERE name = $1`,
      [name],
    );
    if (result.rows.length === 0) return undefined;
    return this.mapRowToEntity(result.rows[0]);
  }

  /**
   * 增加模板使用次数
   */
  async incrementUsage(templateId: string): Promise<void> {
    await this.db.query(
      `UPDATE lowcode_flow_template SET usage_count = usage_count + 1, updated_at = NOW() WHERE id = $1`,
      [templateId],
    );
  }

  /**
   * 列出所有分类
   */
  async listCategories(): Promise<string[]> {
    const result = await this.db.query(
      `SELECT DISTINCT category FROM lowcode_flow_template WHERE category IS NOT NULL AND category != '' ORDER BY category`,
    );
    return result.rows.map((row: any) => row.category);
  }

  protected mapRowToEntity(row: any): LowcodeFlowTemplateEntity {
    return {
      id: row.id,
      tenant_id: row.tenant_id,
      name: row.name,
      description: row.description || '',
      category: row.category || '',
      tags: Array.isArray(row.tags) ? row.tags : (row.tags ? JSON.parse(row.tags) : []),
      nodes: typeof row.nodes === 'string' ? row.nodes : JSON.stringify(row.nodes || []),
      edges: typeof row.edges === 'string' ? row.edges : JSON.stringify(row.edges || []),
      icon: row.icon || '',
      usage_count: row.usage_count || 0,
      is_public: row.is_public ?? true,
      created_by: row.created_by,
      created_at: row.created_at ? new Date(row.created_at) : new Date(),
      updated_at: row.updated_at ? new Date(row.updated_at) : new Date(),
    };
  }
}
