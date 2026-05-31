/**
 * Workflow Trigger Repository - 工作流触发器数据访问层
 */

import { BaseRepository } from '../db/base-repository';
import { OrionError, ErrorCode } from '../errors';

export type WorkflowTriggerType = 'event' | 'cron' | 'manual' | 'webhook';

export interface WorkflowTrigger {
  id: string;
  workflowId: string;
  name: string;
  type: WorkflowTriggerType;
  enabled: boolean;
  eventType?: string;
  eventFilter?: Record<string, any>;
  cronExpression?: string;
  timezone?: string;
  webhookPath?: string;
  webhookSecret?: string;
  triggerStrategy?: string;
  concurrencyLimit?: number;
  description?: string;
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateWorkflowTriggerInput {
  workflowId: string;
  name: string;
  type: WorkflowTriggerType;
  enabled?: boolean;
  eventType?: string;
  eventFilter?: Record<string, any>;
  cronExpression?: string;
  timezone?: string;
  webhookPath?: string;
  webhookSecret?: string;
  triggerStrategy?: string;
  concurrencyLimit?: number;
  description?: string;
  createdBy?: string;
}

export interface UpdateWorkflowTriggerInput {
  name?: string;
  type?: WorkflowTriggerType;
  enabled?: boolean;
  eventType?: string;
  eventFilter?: Record<string, any>;
  cronExpression?: string;
  timezone?: string;
  webhookPath?: string;
  webhookSecret?: string;
  triggerStrategy?: string;
  concurrencyLimit?: number;
  description?: string;
}

export class WorkflowTriggerRepository extends BaseRepository<WorkflowTrigger> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'workflow_triggers');
  }

  /**
   * 创建新的工作流触发器
   */
  async create(data: CreateWorkflowTriggerInput): Promise<WorkflowTrigger> {
    const result = await this.db.query(
      `INSERT INTO workflow_triggers (
        workflow_id, name, type, enabled, event_type, event_filter,
        cron_expression, timezone, webhook_path, webhook_secret,
        trigger_strategy, concurrency_limit, description, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *`,
      [
        data.workflowId,
        data.name,
        data.type,
        data.enabled ?? true,
        data.eventType ?? null,
        JSON.stringify(data.eventFilter ?? {}),
        data.cronExpression ?? null,
        data.timezone ?? 'Asia/Shanghai',
        data.webhookPath ?? null,
        data.webhookSecret ?? null,
        data.triggerStrategy ?? 'async',
        data.concurrencyLimit ?? 1,
        data.description ?? null,
        data.createdBy ?? null,
      ],
    );

    if ((result as any).rows.length === 0) {
      throw new OrionError(ErrorCode.OPERATION_FAILED, 'INSERT into workflow_triggers returned no rows');
    }
    return this.mapRowToEntity((result as any).rows[0]);
  }

  /**
   * 获取所有工作流触发器
   */
  async findAll(): Promise<{ entities: WorkflowTrigger[]; total: number }> {
    const result = await this.db.query(
      `SELECT * FROM workflow_triggers ORDER BY created_at DESC`,
    );
    const countResult = await this.db.query(
      `SELECT COUNT(*) as count FROM workflow_triggers`,
    );
    return {
      entities: (result as any).rows.map((row: any) => this.mapRowToEntity(row)),
      total: parseInt(countResult.rows[0]?.count || '0', 10),
    };
  }

  /**
   * 根据ID获取工作流触发器
   */
  async findById(id: string): Promise<WorkflowTrigger | undefined> {
    const result = await this.db.query(
      `SELECT * FROM workflow_triggers WHERE id = $1`,
      [id],
    );
    if ((result as any).rows.length === 0) return undefined;
    return this.mapRowToEntity((result as any).rows[0]);
  }

  /**
   * 根据工作流ID获取所有触发器
   */
  async findByWorkflowId(workflowId: string): Promise<WorkflowTrigger[]> {
    const result = await this.db.query(
      `SELECT * FROM workflow_triggers WHERE workflow_id = $1 ORDER BY created_at DESC`,
      [workflowId],
    );
    return (result as any).rows.map((row: any) => this.mapRowToEntity(row));
  }

  /**
   * 根据事件类型获取触发器
   */
  async findByEventType(eventType: string): Promise<WorkflowTrigger[]> {
    const result = await this.db.query(
      `SELECT * FROM workflow_triggers WHERE event_type = $1 AND enabled = true ORDER BY created_at DESC`,
      [eventType],
    );
    return (result as any).rows.map((row: any) => this.mapRowToEntity(row));
  }

  /**
   * 获取所有启用的Cron触发器
   */
  async findEnabledCronTriggers(): Promise<WorkflowTrigger[]> {
    const result = await this.db.query(
      `SELECT * FROM workflow_triggers WHERE type = 'cron' AND enabled = true ORDER BY created_at DESC`,
    );
    return (result as any).rows.map((row: any) => this.mapRowToEntity(row));
  }

  /**
   * 根据Webhook路径获取触发器
   */
  async findByWebhookPath(webhookPath: string): Promise<WorkflowTrigger | undefined> {
    const result = await this.db.query(
      `SELECT * FROM workflow_triggers WHERE webhook_path = $1 AND enabled = true`,
      [webhookPath],
    );
    if ((result as any).rows.length === 0) return undefined;
    return this.mapRowToEntity((result as any).rows[0]);
  }

  /**
   * 更新工作流触发器
   */
  // @ts-ignore
  // @ts-ignore
  // @ts-ignore
  async update(id: string, data: UpdateWorkflowTriggerInput): Promise<WorkflowTrigger | null> {
    const updates: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (data.name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      values.push(data.name);
    }
    if (data.type !== undefined) {
      updates.push(`type = $${paramIndex++}`);
      values.push(data.type);
    }
    if (data.enabled !== undefined) {
      updates.push(`enabled = $${paramIndex++}`);
      values.push(data.enabled);
    }
    if (data.eventType !== undefined) {
      updates.push(`event_type = $${paramIndex++}`);
      values.push(data.eventType);
    }
    if (data.eventFilter !== undefined) {
      updates.push(`event_filter = $${paramIndex++}`);
      values.push(JSON.stringify(data.eventFilter));
    }
    if (data.cronExpression !== undefined) {
      updates.push(`cron_expression = $${paramIndex++}`);
      values.push(data.cronExpression);
    }
    if (data.timezone !== undefined) {
      updates.push(`timezone = $${paramIndex++}`);
      values.push(data.timezone);
    }
    if (data.webhookPath !== undefined) {
      updates.push(`webhook_path = $${paramIndex++}`);
      values.push(data.webhookPath);
    }
    if (data.webhookSecret !== undefined) {
      updates.push(`webhook_secret = $${paramIndex++}`);
      values.push(data.webhookSecret);
    }
    if (data.triggerStrategy !== undefined) {
      updates.push(`trigger_strategy = $${paramIndex++}`);
      values.push(data.triggerStrategy);
    }
    if (data.concurrencyLimit !== undefined) {
      updates.push(`concurrency_limit = $${paramIndex++}`);
      values.push(data.concurrencyLimit);
    }
    if (data.description !== undefined) {
      updates.push(`description = $${paramIndex++}`);
      values.push(data.description);
    }

    if (updates.length === 0) {
      return this.findById(id).then(result => result ?? null);
    }

    updates.push(`updated_at = NOW()`);
    values.push(id);

    const query = `UPDATE workflow_triggers SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`;
    const result = await this.db.query(query, values);

    if ((result as any).rows.length === 0) return null;
    return this.mapRowToEntity((result as any).rows[0]);
  }

  /**
   * 删除工作流触发器
   */
  async delete(id: string): Promise<boolean> {
    const result = await this.db.query(
      `DELETE FROM workflow_triggers WHERE id = $1`,
      [id],
    );
    return ((result as any).rowCount ?? 0) > 0;
  }

  /**
   * 设置触发器启用/禁用状态
   */
  async setEnabled(id: string, enabled: boolean): Promise<void> {
    await this.db.query(
      `UPDATE workflow_triggers SET enabled = $1, updated_at = NOW() WHERE id = $2`,
      [enabled, id],
    );
  }

  /**
   * 根据类型获取触发器
   */
  async findByType(type: WorkflowTriggerType): Promise<WorkflowTrigger[]> {
    const result = await this.db.query(
      `SELECT * FROM workflow_triggers WHERE type = $1 ORDER BY created_at DESC`,
      [type],
    );
    return (result as any).rows.map((row: any) => this.mapRowToEntity(row));
  }

  /**
   * 获取所有启用的触发器
   */
  async findEnabled(): Promise<WorkflowTrigger[]> {
    const result = await this.db.query(
      `SELECT * FROM workflow_triggers WHERE enabled = true ORDER BY created_at DESC`,
    );
    return (result as any).rows.map((row: any) => this.mapRowToEntity(row));
  }

  protected mapRowToEntity(row: any): WorkflowTrigger {
    return {
      id: row.id,
      workflowId: row.workflow_id,
      name: row.name,
      type: row.type as WorkflowTriggerType,
      enabled: row.enabled ?? true,
      eventType: row.event_type,
      eventFilter: typeof row.event_filter === 'string' ? JSON.parse(row.event_filter) : (row.event_filter ?? {}),
      cronExpression: row.cron_expression,
      timezone: row.timezone,
      webhookPath: row.webhook_path,
      webhookSecret: row.webhook_secret,
      triggerStrategy: row.trigger_strategy,
      concurrencyLimit: row.concurrency_limit,
      description: row.description,
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * 创建触发日志
   */
  async createLog(data: {
    trigger_id: string;
    workflow_instance_id?: string;
    event_type?: string;
    event_payload?: Record<string, any>;
    status: 'pending' | 'success' | 'failed' | 'skipped';
  }): Promise<void> {
    await this.db.query(
      `INSERT INTO workflow_trigger_logs (trigger_id, workflow_instance_id, event_type, event_payload, status)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        data.trigger_id,
        data.workflow_instance_id,
        data.event_type,
        JSON.stringify(data.event_payload || {}),
        data.status,
      ],
    );
  }
}