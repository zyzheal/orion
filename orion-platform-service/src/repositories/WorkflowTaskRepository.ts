/**
 * Workflow Task Repository
 * 工作流人工任务数据访问层
 */

import { DatabasePool } from '../services/database';

export interface WorkflowTask {
  id: string;
  instance_id: string;
  node_id: string;
  task_type: 'manual' | 'system';
  assignee_type: 'user' | 'role';
  assignee_id?: string;
  candidate_users?: string[];
  candidate_roles?: string[];
  title: string;
  description?: string;
  form_data?: Record<string, any>;
  status: 'pending' | 'assigned' | 'completed' | 'cancelled';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  due_date?: Date;
  completed_at?: Date;
  completed_by?: string;
  completion_comment?: string;
  created_at: Date;
  updated_at: Date;
}

export class WorkflowTaskRepository {
  private pool: InstanceType<typeof DatabasePool>;

  constructor() {
    this.pool = DatabasePool as unknown as InstanceType<typeof DatabasePool>;
  }

  private mapRowToEntity(row: any): WorkflowTask {
    return {
      id: row.id,
      instance_id: row.instance_id,
      node_id: row.node_id,
      task_type: row.task_type,
      assignee_type: row.assignee_type,
      assignee_id: row.assignee_id,
      candidate_users: row.candidate_users,
      candidate_roles: row.candidate_roles,
      title: row.title,
      description: row.description,
      form_data: row.form_data,
      status: row.status,
      priority: row.priority,
      due_date: row.due_date,
      completed_at: row.completed_at,
      completed_by: row.completed_by,
      completion_comment: row.completion_comment,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  async create(data: Partial<WorkflowTask>): Promise<WorkflowTask> {
    const result = await this.pool.query(
      `INSERT INTO workflow_tasks (instance_id, node_id, task_type, assignee_type, assignee_id, candidate_users, candidate_roles, title, description, form_data, status, priority, due_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING *`,
      [data.instance_id, data.node_id, data.task_type, data.assignee_type, data.assignee_id, data.candidate_users, data.candidate_roles, data.title, data.description, JSON.stringify(data.form_data || {}), data.status || 'pending', data.priority || 'normal', data.due_date]
    );
    return this.mapRowToEntity(result.rows[0]);
  }

  async findById(id: string): Promise<WorkflowTask | null> {
    const result = await this.pool.query('SELECT * FROM workflow_tasks WHERE id = $1', [id]);
    return result.rows[0] ? this.mapRowToEntity(result.rows[0]) : null;
  }

  async findByInstanceId(instanceId: string): Promise<WorkflowTask[]> {
    const result = await this.pool.query(
      'SELECT * FROM workflow_tasks WHERE instance_id = $1 ORDER BY created_at',
      [instanceId]
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async findByAssignee(assigneeType: string, assigneeId: string, status?: string): Promise<WorkflowTask[]> {
    let query = 'SELECT * FROM workflow_tasks WHERE assignee_type = $1 AND assignee_id = $2';
    const params: any[] = [assigneeType, assigneeId];

    if (status) {
      query += ' AND status = $3';
      params.push(status);
    }

    query += ' ORDER BY created_at DESC';

    const result = await this.pool.query(query, params);
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async updateStatus(id: string, status: string, completedBy?: string, comment?: string): Promise<void> {
    const setClauses: string[] = [];
    const params: any[] = [];

    // status 始终是 $1
    params.push(status);
    setClauses.push('status = $1');
    setClauses.push('updated_at = now()');

    if (completedBy) {
      params.push(completedBy);
      setClauses.push(`completed_by = $${params.length}`);
      if (status === 'completed') {
        setClauses.push('completed_at = now()');
      }
    }

    if (comment) {
      params.push(comment);
      setClauses.push(`completion_comment = $${params.length}`);
    }

    // id 始终是最后一个参数
    params.push(id);
    await this.pool.query(
      `UPDATE workflow_tasks SET ${setClauses.join(', ')} WHERE id = $${params.length}`,
      params
    );
  }

  /**
   * 完成任务并返回工作流实例 ID（用于事件唤醒）
   */
  async completeWithResult(id: string, completedBy: string, comment?: string, formData?: Record<string, any>): Promise<{ instanceId: string; nodeId: string } | null> {
    const task = await this.findById(id);
    if (!task) return null;

    // 构建 SET 子句和参数，id 始终放在最后
    const setClauses: string[] = ['status = $1', 'completed_at = now()', 'updated_at = now()'];
    const params: any[] = ['completed'];

    if (completedBy) {
      params.push(completedBy);
      setClauses.push(`completed_by = $${params.length}`);
    }

    if (comment) {
      params.push(comment);
      setClauses.push(`completion_comment = $${params.length}`);
    }

    if (formData) {
      params.push(formData);
      setClauses.push(`form_data = $${params.length}::jsonb`);
    }

    // id 始终是最后一个参数
    params.push(id);
    await this.pool.query(
      `UPDATE workflow_tasks SET ${setClauses.join(', ')} WHERE id = $${params.length}`,
      params
    );

    return {
      instanceId: task.instance_id,
      nodeId: task.node_id,
    };
  }
}