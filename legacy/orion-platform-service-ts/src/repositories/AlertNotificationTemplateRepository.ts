import { BaseRepository } from '../db/base-repository';

/**
 * 通知模板实体
 */
export interface AlertNotificationTemplateEntity {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  severity_filter: string[];
  channel_type: string;
  subject_template: string | null;
  body_template: string;
  channel_overrides: Record<string, any>;
  enabled: boolean;
  is_default: boolean;
  created_at: Date;
  updated_at: Date;
  created_by: string | null;
}

/**
 * 创建模板输入
 */
export interface CreateAlertNotificationTemplateInput {
  tenant_id: string;
  name: string;
  description?: string;
  severity_filter: string[];
  channel_type: string;
  subject_template?: string;
  body_template: string;
  channel_overrides?: Record<string, any>;
  enabled?: boolean;
  is_default?: boolean;
  created_by?: string;
}

/**
 * 更新模板输入
 */
export interface UpdateAlertNotificationTemplateInput {
  name?: string;
  description?: string;
  severity_filter?: string[];
  channel_type?: string;
  subject_template?: string;
  body_template?: string;
  channel_overrides?: Record<string, any>;
  enabled?: boolean;
  is_default?: boolean;
}

/**
 * AlertNotificationTemplateRepository - 通知模板数据访问层
 *
 * 持久化通知模板，支持按租户、severity、channel_type 查询
 */
export class AlertNotificationTemplateRepository extends BaseRepository<AlertNotificationTemplateEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'alert_notification_templates');
  }

  /**
   * 按租户查询所有模板
   */
  async findByTenantId(tenantId: string): Promise<AlertNotificationTemplateEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM alert_notification_templates WHERE tenant_id = $1 ORDER BY created_at DESC`,
      [tenantId],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  /**
   * 按租户 + channel_type 查询启用的模板
   */
  async findByTenantAndChannel(tenantId: string, channelType: string): Promise<AlertNotificationTemplateEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM alert_notification_templates
       WHERE tenant_id = $1 AND channel_type = $2 AND enabled = true
       ORDER BY is_default DESC, created_at ASC`,
      [tenantId, channelType],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  /**
   * 按租户 + severity 查询匹配的模板
   */
  async findByTenantAndSeverity(tenantId: string, severity: string): Promise<AlertNotificationTemplateEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM alert_notification_templates
       WHERE tenant_id = $1
         AND enabled = true
         AND (severity_filter = '{}' OR $2 = ANY(severity_filter))
       ORDER BY is_default DESC, created_at ASC`,
      [tenantId, severity],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  /**
   * 获取租户的默认模板（is_default = true）
   */
  async findDefaultByTenant(tenantId: string): Promise<AlertNotificationTemplateEntity | null> {
    const result = await this.db.query(
      `SELECT * FROM alert_notification_templates
       WHERE tenant_id = $1 AND is_default = true AND enabled = true
       LIMIT 1`,
      [tenantId],
    );
    return result.rows[0] ? this.mapRowToEntity(result.rows[0]) : null;
  }

  /**
   * 创建模板
   */
  async create(input: CreateAlertNotificationTemplateInput): Promise<AlertNotificationTemplateEntity> {
    const result = await this.db.query(
      `INSERT INTO alert_notification_templates (
         tenant_id, name, description, severity_filter, channel_type,
         subject_template, body_template, channel_overrides, enabled, is_default, created_by
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [
        input.tenant_id,
        input.name,
        input.description ?? null,
        input.severity_filter,
        input.channel_type,
        input.subject_template ?? null,
        input.body_template,
        JSON.stringify(input.channel_overrides || {}),
        input.enabled ?? true,
        input.is_default ?? false,
        input.created_by ?? null,
      ],
    );
    return this.mapRowToEntity(result.rows[0]);
  }

  /**
   * 更新模板
   */
  async update(id: string, updates: UpdateAlertNotificationTemplateInput): Promise<AlertNotificationTemplateEntity | null> {
    const existing = await this.findById(id);
    if (!existing) return null;

    const setParts: string[] = [];
    const params: any[] = [];
    let idx = 1;

    if (updates.name !== undefined) { setParts.push(`name = $${idx++}`); params.push(updates.name); }
    if (updates.description !== undefined) { setParts.push(`description = $${idx++}`); params.push(updates.description); }
    if (updates.severity_filter !== undefined) { setParts.push(`severity_filter = $${idx++}`); params.push(updates.severity_filter); }
    if (updates.channel_type !== undefined) { setParts.push(`channel_type = $${idx++}`); params.push(updates.channel_type); }
    if (updates.subject_template !== undefined) { setParts.push(`subject_template = $${idx++}`); params.push(updates.subject_template); }
    if (updates.body_template !== undefined) { setParts.push(`body_template = $${idx++}`); params.push(updates.body_template); }
    if (updates.channel_overrides !== undefined) { setParts.push(`channel_overrides = $${idx++}`); params.push(JSON.stringify(updates.channel_overrides)); }
    if (updates.enabled !== undefined) { setParts.push(`enabled = $${idx++}`); params.push(updates.enabled); }
    if (updates.is_default !== undefined) { setParts.push(`is_default = $${idx++}`); params.push(updates.is_default); }

    if (setParts.length === 0) return existing;

    setParts.push(`updated_at = NOW()`);
    params.push(id);

    const result = await this.db.query(
      `UPDATE alert_notification_templates SET ${setParts.join(', ')} WHERE id = $${idx} RETURNING *`,
      params,
    );
    return result.rows[0] ? this.mapRowToEntity(result.rows[0]) : null;
  }

  /**
   * 删除模板
   */
  async delete(id: string): Promise<boolean> {
    const result = await this.db.query(
      `DELETE FROM alert_notification_templates WHERE id = $1`,
      [id],
    );
    return (result.rowCount ?? 0) > 0;
  }

  protected mapRowToEntity(row: any): AlertNotificationTemplateEntity {
    return {
      id: row.id,
      tenant_id: row.tenant_id,
      name: row.name,
      description: row.description,
      severity_filter: row.severity_filter || [],
      channel_type: row.channel_type,
      subject_template: row.subject_template,
      body_template: row.body_template,
      channel_overrides: row.channel_overrides || {},
      enabled: row.enabled,
      is_default: row.is_default,
      created_at: row.created_at ? new Date(row.created_at) : new Date(),
      updated_at: row.updated_at ? new Date(row.updated_at) : new Date(),
      created_by: row.created_by,
    };
  }
}
