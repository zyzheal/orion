/**
 * WorkflowRepository - 工作流数据访问层
 *
 * 负责工作流定义和实例的持久化，基于 PostgreSQL Repository 模式
 */
import { v4 as uuidv4 } from 'uuid';
import { DatabasePool, QueryResult } from '../database';
import {
  WorkflowDefinition,
  WorkflowInstance,
  WorkflowInstanceStatus,
  WorkflowHistory,
} from './types';
import { OrionError, ErrorCode } from '../../../errors';

const logger = require('pino')({ name: 'WorkflowRepository' });

/**
 * 工作流定义 Repository
 */
export class WorkflowDefinitionRepository {
  private pool: DatabasePool | null;

  constructor(pool?: DatabasePool | null) {
    this.pool = pool || null;
  }

  /**
   * 创建工作流定义
   */
  async create(definition: Omit<WorkflowDefinition, 'id' | 'createdAt' | 'updatedAt'>): Promise<WorkflowDefinition> {
    const id = uuidv4();
    const now = new Date();

    const query = `
      INSERT INTO lowcode_workflow_definition (
        id, tenant_id, name, description, version, enabled,
        nodes, edges, created_by, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `;

    const values = [
      id,
      definition.tenantId,
      definition.name,
      definition.description || null,
      definition.version,
      definition.enabled,
      JSON.stringify(definition.nodes),
      JSON.stringify(definition.edges),
      definition.createdBy,
      now,
      now,
    ];

    try {
      const result = await this.pool!.query(query, values);
      return this.mapRowToDefinition(result.rows[0]);
    } catch (error) {
      logger.error({ error, definition }, 'Failed to create workflow definition');
      throw error;
    }
  }

  /**
   * 根据 ID 获取工作流定义
   */
  async findById(id: string): Promise<WorkflowDefinition | null> {
    const query = 'SELECT * FROM lowcode_workflow_definition WHERE id = $1';

    try {
      const result = await this.pool!.query(query, [id]);
      if (result.rows.length === 0) {
        return null;
      }
      return this.mapRowToDefinition(result.rows[0]);
    } catch (error) {
      logger.error({ error, id }, 'Failed to find workflow definition by id');
      throw error;
    }
  }

  /**
   * 根据ID批量获取工作流定义
   */
  async findByIds(ids: string[]): Promise<Map<string, string>> {
    if (ids.length === 0) return new Map();

    const placeholders = ids.map((_, i) => `$${i + 1}`).join(', ');
    const result = await this.pool!.query(
      `SELECT id, name FROM lowcode_workflow_definition WHERE id IN (${placeholders})`,
      ids,
    );

    const nameMap = new Map<string, string>();
    for (const row of result.rows) {
      nameMap.set(row.id, row.name);
    }
    return nameMap;
  }

  /**
   * 获取所有工作流定义
   */
  async findAll(options?: { enabled?: boolean; limit?: number; offset?: number }): Promise<{ entities: WorkflowDefinition[]; total: number }> {
    let query = 'SELECT * FROM lowcode_workflow_definition';
    const values: any[] = [];

    if (options?.enabled !== undefined) {
      query += ' WHERE enabled = $1';
      values.push(options.enabled);
    }

    query += ' ORDER BY created_at DESC';

    if (options?.limit) {
      query += ` LIMIT ${options.limit}`;
    }
    if (options?.offset) {
      query += ` OFFSET ${options.offset}`;
    }

    try {
      const result = await this.pool!.query(query, values);
      const entities = result.rows.map((row: any) => this.mapRowToDefinition(row));

      // 获取总数
      const countResult = await this.pool!.query('SELECT COUNT(*) as count FROM lowcode_workflow_definition');
      return {
        entities,
        total: parseInt(countResult.rows[0]?.count || '0', 10),
      };
    } catch (error) {
      logger.error({ error }, 'Failed to fetch all workflow definitions');
      return { entities: [], total: 0 };
    }
  }

  /**
   * 根据租户获取工作流定义列表
   */
  async findByTenant(tenantId: string, options?: { enabled?: boolean; limit?: number; offset?: number }): Promise<WorkflowDefinition[]> {
    let query = 'SELECT * FROM lowcode_workflow_definition WHERE tenant_id = $1';
    const values: any[] = [tenantId];

    if (options?.enabled !== undefined) {
      query += ' AND enabled = $2';
      values.push(options.enabled);
    }

    query += ' ORDER BY created_at DESC';

    if (options?.limit) {
      query += ` LIMIT ${options.limit}`;
    }
    if (options?.offset) {
      query += ` OFFSET ${options.offset}`;
    }

    try {
      const result = await this.pool!.query(query, values);
      return result.rows.map(row => this.mapRowToDefinition(row));
    } catch (error) {
      logger.error({ error, tenantId }, 'Failed to find workflow definitions by tenant');
      throw error;
    }
  }

  /**
   * 更新工作流定义
   */
  async update(id: string, updates: Partial<WorkflowDefinition>): Promise<WorkflowDefinition | null> {
    const existing = await this.findById(id);
    if (!existing) {
      return null;
    }

    const query = `
      UPDATE lowcode_workflow_definition
      SET name = $1, description = $2, version = $3, enabled = $4,
          nodes = $5, edges = $6, updated_at = $7
      WHERE id = $8
      RETURNING *
    `;

    const values = [
      updates.name ?? existing.name,
      updates.description ?? existing.description,
      updates.version ?? existing.version,
      updates.enabled ?? existing.enabled,
      updates.nodes ? JSON.stringify(updates.nodes) : JSON.stringify(existing.nodes),
      updates.edges ? JSON.stringify(updates.edges) : JSON.stringify(existing.edges),
      new Date(),
      id,
    ];

    try {
      const result = await this.pool!.query(query, values);
      return this.mapRowToDefinition(result.rows[0]);
    } catch (error) {
      logger.error({ error, id, updates }, 'Failed to update workflow definition');
      throw error;
    }
  }

  /**
   * 删除工作流定义
   */
  async delete(id: string): Promise<boolean> {
    const query = 'DELETE FROM lowcode_workflow_definition WHERE id = $1';

    try {
      const result = await this.pool!.query(query, [id]);
      return (result.rowCount ?? 0) > 0;
    } catch (error) {
      logger.error({ error, id }, 'Failed to delete workflow definition');
      throw error;
    }
  }

  /**
   * 将数据库行映射为 WorkflowDefinition 对象
   */
  private mapRowToDefinition(row: any): WorkflowDefinition {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      name: row.name,
      description: row.description,
      version: row.version,
      enabled: row.enabled,
      nodes: typeof row.nodes === 'string' ? JSON.parse(row.nodes) : row.nodes,
      edges: typeof row.edges === 'string' ? JSON.parse(row.edges) : row.edges,
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

/**
 * 工作流实例 Repository
 */
export class WorkflowInstanceRepository {
  private pool: DatabasePool | null;

  constructor(pool?: DatabasePool | null) {
    this.pool = pool || null;
  }

  /**
   * 创建工作流实例
   */
  async create(instance: Omit<WorkflowInstance, 'id' | 'createdAt' | 'updatedAt'>): Promise<WorkflowInstance> {
    const id = uuidv4();
    const now = new Date();

    const query = `
      INSERT INTO lowcode_workflow_instance (
        id, workflow_id, workflow_definition_id, tenant_id, status,
        current_node_id, variables, history, input, output, error,
        created_at, updated_at, completed_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *
    `;

    const values = [
      id,
      instance.workflowId,
      instance.workflowDefinitionId,
      instance.tenantId,
      instance.status,
      instance.currentNodeId,
      JSON.stringify(instance.variables),
      JSON.stringify(instance.history),
      JSON.stringify(instance.input),
      instance.output ? JSON.stringify(instance.output) : null,
      instance.error || null,
      now,
      now,
      instance.completedAt || null,
    ];

    try {
      const result = await this.pool!.query(query, values);
      return this.mapRowToInstance(result.rows[0]);
    } catch (error) {
      logger.error({ error, instance }, 'Failed to create workflow instance');
      throw error;
    }
  }

  /**
   * 根据 ID 获取工作流实例
   */
  async findById(id: string): Promise<WorkflowInstance | null> {
    const query = 'SELECT * FROM lowcode_workflow_instance WHERE id = $1';

    try {
      const result = await this.pool!.query(query, [id]);
      if (result.rows.length === 0) {
        return null;
      }
      return this.mapRowToInstance(result.rows[0]);
    } catch (error) {
      logger.error({ error, id }, 'Failed to find workflow instance by id');
      throw error;
    }
  }

  /**
   * 根据工作流 ID 获取实例列表
   */
  async findByWorkflowId(workflowId: string, options?: { status?: WorkflowInstanceStatus; limit?: number; offset?: number }): Promise<WorkflowInstance[]> {
    let query = 'SELECT * FROM lowcode_workflow_instance WHERE workflow_id = $1';
    const values: any[] = [workflowId];

    if (options?.status) {
      query += ' AND status = $2';
      values.push(options.status);
    }

    query += ' ORDER BY created_at DESC';

    if (options?.limit) {
      query += ` LIMIT ${options.limit}`;
    }
    if (options?.offset) {
      query += ` OFFSET ${options.offset}`;
    }

    try {
      const result = await this.pool!.query(query, values);
      return result.rows.map(row => this.mapRowToInstance(row));
    } catch (error) {
      logger.error({ error, workflowId }, 'Failed to find workflow instances by workflow id');
      throw error;
    }
  }

  /**
   * 更新工作流实例
   */
  async update(id: string, updates: Partial<WorkflowInstance>): Promise<WorkflowInstance | null> {
    const existing = await this.findById(id);
    if (!existing) {
      return null;
    }

    const fields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (updates.status !== undefined) {
      fields.push(`status = $${paramIndex++}`);
      values.push(updates.status);
    }
    if (updates.currentNodeId !== undefined) {
      fields.push(`current_node_id = $${paramIndex++}`);
      values.push(updates.currentNodeId);
    }
    if (updates.variables !== undefined) {
      fields.push(`variables = $${paramIndex++}`);
      values.push(JSON.stringify(updates.variables));
    }
    if (updates.history !== undefined) {
      fields.push(`history = $${paramIndex++}`);
      values.push(JSON.stringify(updates.history));
    }
    if (updates.output !== undefined) {
      fields.push(`output = $${paramIndex++}`);
      values.push(JSON.stringify(updates.output));
    }
    if (updates.error !== undefined) {
      fields.push(`error = $${paramIndex++}`);
      values.push(updates.error);
    }
    if (updates.completedAt !== undefined) {
      fields.push(`completed_at = $${paramIndex++}`);
      values.push(updates.completedAt);
    }

    fields.push(`updated_at = $${paramIndex++}`);
    values.push(new Date());

    values.push(id);

    const query = `
      UPDATE lowcode_workflow_instance
      SET ${fields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    try {
      const result = await this.pool!.query(query, values);
      return this.mapRowToInstance(result.rows[0]);
    } catch (error) {
      logger.error({ error, id, updates }, 'Failed to update workflow instance');
      throw error;
    }
  }

  /**
   * 添加历史记录
   */
  async addHistory(id: string, historyItem: WorkflowHistory): Promise<void> {
    const instance = await this.findById(id);
    if (!instance) {
      throw new OrionError(ErrorCode.NOT_FOUND, `Workflow instance not found: ${id}`);
    }

    const history = [...instance.history, historyItem];
    await this.update(id, { history });
  }

  /**
   * 更新实例状态
   */
  async updateStatus(id: string, status: WorkflowInstanceStatus, error?: string): Promise<WorkflowInstance | null> {
    const updates: Partial<WorkflowInstance> = { status };

    if (error) {
      updates.error = error;
    }

    if (status === 'completed' || status === 'failed' || status === 'terminated') {
      updates.completedAt = new Date();
    }

    return this.update(id, updates);
  }

  /**
   * 将数据库行映射为 WorkflowInstance 对象
   */
  private mapRowToInstance(row: any): WorkflowInstance {
    return {
      id: row.id,
      workflowId: row.workflow_id,
      workflowDefinitionId: row.workflow_definition_id,
      tenantId: row.tenant_id,
      status: row.status,
      currentNodeId: row.current_node_id,
      variables: typeof row.variables === 'string' ? JSON.parse(row.variables) : row.variables,
      history: typeof row.history === 'string' ? JSON.parse(row.history) : row.history,
      input: typeof row.input === 'string' ? JSON.parse(row.input) : row.input,
      output: row.output ? (typeof row.output === 'string' ? JSON.parse(row.output) : row.output) : undefined,
      error: row.error,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      completedAt: row.completed_at,
    };
  }

  /**
   * 清理过期的工作流实例
   */
  async cleanupExpiredInstances(retentionDate: Date): Promise<number> {
    const result = await this.pool!.query(
      `DELETE FROM lowcode_workflow_instance
       WHERE status IN ('completed', 'failed', 'cancelled')
       AND updated_at < $1`,
      [retentionDate],
    );
    return result.rowCount || 0;
  }
}