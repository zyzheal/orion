/**
 * ApprovalTemplateService - 审批模板管理
 *
 * Phase 2: 提供审批模板的创建、查询功能，
 * 用于快速创建常见审批流程（如部署审批、变更审批等）。
 */
import pino from 'pino';
import { DatabasePool } from '../database';

import { v4 as uuidv4 } from 'uuid';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

export interface ApprovalTemplateLevel {
  levelIndex: number;
  approverIds: string[];
  requiredApprovals: number;
}

export interface ApprovalTemplateInput {
  name: string;
  description?: string;
  resourceType: string;
  levels: ApprovalTemplateLevel[];
  mode?: 'serial' | 'parallel';
  isDefault?: boolean;
}

export interface ApprovalTemplate {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  resourceType: string;
  levels: ApprovalTemplateLevel[];
  mode: 'serial' | 'parallel';
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class ApprovalTemplateService {
  constructor(private pool: DatabasePool) {
    this.ensureTable();
  }

  /**
   * 创建审批模板
   */
  async createTemplate(
    tenantId: string,
    input: ApprovalTemplateInput,
  ): Promise<ApprovalTemplate> {
    const id = `tmpl_${uuidv4()}`;
    const now = new Date();
    const mode = input.mode || 'serial';
    const isDefault = input.isDefault || false;

    // If this is marked as default, unset other defaults for same resourceType
    if (isDefault) {
      await this.pool.query(
        `UPDATE approval_templates SET is_default = false WHERE tenant_id = $1 AND resource_type = $2 AND is_default = true`,
        [tenantId, input.resourceType],
      );
    }

    const levelsJson = JSON.stringify(input.levels);

    await this.pool.query(
      `INSERT INTO approval_templates (id, tenant_id, name, description, resource_type, levels, mode, is_default, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [id, tenantId, input.name, input.description || null, input.resourceType, levelsJson, mode, isDefault, now, now],
    );

    const template: ApprovalTemplate = {
      id,
      tenantId,
      name: input.name,
      description: input.description || null,
      resourceType: input.resourceType,
      levels: input.levels,
      mode,
      isDefault,
      createdAt: now,
      updatedAt: now,
    };

    logger.info({ templateId: id, tenantId, name: input.name }, 'Approval template created');
    return template;
  }

  /**
   * 获取模板列表
   */
  async getTemplates(tenantId: string): Promise<ApprovalTemplate[]> {
    const result = await this.pool.query(
      `SELECT * FROM approval_templates WHERE tenant_id = $1 ORDER BY is_default DESC, created_at DESC`,
      [tenantId],
    );

    return result.rows.map(row => ({
      id: row.id,
      tenantId: row.tenant_id,
      name: row.name,
      description: row.description,
      resourceType: row.resource_type,
      levels: typeof row.levels === 'string' ? JSON.parse(row.levels) : row.levels,
      mode: row.mode,
      isDefault: row.is_default,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    }));
  }

  /**
   * 获取单个模板
   */
  async getTemplate(templateId: string): Promise<ApprovalTemplate | null> {
    const result = await this.pool.query(
      `SELECT * FROM approval_templates WHERE id = $1`,
      [templateId],
    );

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    return {
      id: row.id,
      tenantId: row.tenant_id,
      name: row.name,
      description: row.description,
      resourceType: row.resource_type,
      levels: typeof row.levels === 'string' ? JSON.parse(row.levels) : row.levels,
      mode: row.mode,
      isDefault: row.is_default,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  /**
   * 获取默认模板
   */
  async getDefaultTemplate(tenantId: string, resourceType: string): Promise<ApprovalTemplate | null> {
    const result = await this.pool.query(
      `SELECT * FROM approval_templates WHERE tenant_id = $1 AND resource_type = $2 AND is_default = true LIMIT 1`,
      [tenantId, resourceType],
    );

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    return {
      id: row.id,
      tenantId: row.tenant_id,
      name: row.name,
      description: row.description,
      resourceType: row.resource_type,
      levels: typeof row.levels === 'string' ? JSON.parse(row.levels) : row.levels,
      mode: row.mode,
      isDefault: row.is_default,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  /**
   * 删除模板
   */
  async deleteTemplate(templateId: string, tenantId: string): Promise<boolean> {
    const result = await this.pool.query(
      `DELETE FROM approval_templates WHERE id = $1 AND tenant_id = $2`,
      [templateId, tenantId],
    );
    return (result.rowCount ?? 0) > 0;
  }

  /**
   * 确保表存在（开发环境用）
   */
  private async ensureTable(): Promise<void> {
    try {
      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS approval_templates (
          id VARCHAR(64) PRIMARY KEY,
          tenant_id VARCHAR(64) NOT NULL,
          name VARCHAR(255) NOT NULL,
          description TEXT,
          resource_type VARCHAR(64) NOT NULL,
          levels JSONB NOT NULL DEFAULT '[]',
          mode VARCHAR(20) NOT NULL DEFAULT 'serial',
          is_default BOOLEAN NOT NULL DEFAULT false,
          created_at TIMESTAMP NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMP NOT NULL DEFAULT NOW()
        )
      `);
      logger.info('approval_templates table ensured');
    } catch (err: any) {
      // Table may already exist or user may not have CREATE permission
      // In production, use migrations instead
      logger.warn({ error: err.message }, 'Could not ensure approval_templates table (may need migration)');
    }
  }
}
