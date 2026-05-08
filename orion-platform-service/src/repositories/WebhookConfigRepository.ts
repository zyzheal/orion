/**
 * WebhookConfigRepository - Pipeline 级别 Webhook 配置存储
 *
 * 负责管理每个 Pipeline 的出站 Webhook 配置，包括：
 * - 按 Pipeline ID 查询
 * - 按事件类型过滤
 * - 增删改查
 */
import { BaseRepository } from '../db/base-repository';
import { WebhookEventType } from '../services/pipeline/WebhookNotifier';

// ============================================================================
// Entity 定义
// ============================================================================

export interface WebhookConfigEntity {
  id: string;
  pipelineId: string;
  name: string;
  url: string;
  method: 'POST' | 'PUT' | 'PATCH';
  headers: Record<string, string>;
  secret: string | null;
  events: WebhookEventType[];
  enabled: boolean;
  retries: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface WebhookConfigCreateInput {
  pipelineId: string;
  name: string;
  url: string;
  method?: 'POST' | 'PUT' | 'PATCH';
  headers?: Record<string, string>;
  secret?: string;
  events?: WebhookEventType[];
  enabled?: boolean;
  retries?: number;
}

export interface WebhookConfigUpdateInput {
  name?: string;
  url?: string;
  method?: 'POST' | 'PUT' | 'PATCH';
  headers?: Record<string, string>;
  secret?: string | null;
  events?: WebhookEventType[];
  enabled?: boolean;
  retries?: number;
}

// ============================================================================
// Repository
// ============================================================================

export class WebhookConfigRepository extends BaseRepository<WebhookConfigEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'pipeline_webhook_configs');
  }

  /**
   * 按 Pipeline ID 查询所有启用的 Webhook 配置
   */
  async findByPipelineId(pipelineId: string, options?: { enabledOnly?: boolean }): Promise<WebhookConfigEntity[]> {
    let query = `SELECT * FROM pipeline_webhook_configs WHERE pipeline_id = $1`;
    const params: any[] = [pipelineId];

    if (options?.enabledOnly !== false) {
      query += ` AND enabled = true`;
    }

    query += ` ORDER BY created_at ASC`;
    const result = await this.db.query(query, params);
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  /**
   * 按事件类型查询匹配的 Webhook 配置
   */
  async findByEvent(pipelineId: string, event: WebhookEventType): Promise<WebhookConfigEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM pipeline_webhook_configs
       WHERE pipeline_id = $1
         AND enabled = true
         AND (events = '{}' OR $2 = ANY(events))
       ORDER BY created_at ASC`,
      [pipelineId, event]
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  /**
   * 按 Pipeline ID 批量删除
   */
  async deleteByPipelineId(pipelineId: string): Promise<number> {
    const result = await this.db.query(
      `DELETE FROM pipeline_webhook_configs WHERE pipeline_id = $1`,
      [pipelineId]
    );
    return result.rowCount ?? 0;
  }

  protected mapRowToEntity(row: any): WebhookConfigEntity {
    return {
      id: row.id,
      pipelineId: row.pipeline_id,
      name: row.name,
      url: row.url,
      method: row.method || 'POST',
      headers: row.headers ?? {},
      secret: row.secret || null,
      events: row.events || [],
      enabled: row.enabled ?? true,
      retries: row.retries ?? 3,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
