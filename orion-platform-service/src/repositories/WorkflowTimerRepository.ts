/**
 * Workflow Timer Repository
 * 工作流定时器数据访问层
 *
 * 用于 Delay/Timer 节点的持久化，支持服务重启后恢复定时器状态。
 */

import { DatabasePool, QueryResult } from '../services/database';

export interface WorkflowTimer {
  id: string;
  instance_id: string;
  node_id: string;
  timer_type: 'delay' | 'timer';
  cron_expression?: string;
  duration_ms?: number;
  timezone?: string;
  max_executions?: number;
  current_executions: number;
  status: 'pending' | 'running' | 'completed' | 'cancelled';
  scheduled_at: Date;
  fired_at?: Date;
  resume_event?: string;
  output_variables: Record<string, any>;
  created_at: Date;
  updated_at: Date;
}

export interface WorkflowInstanceDependency {
  id: string;
  parent_instance_id: string;
  child_instance_id: string;
  node_id: string;
  created_at: Date;
}

export class WorkflowTimerRepository {
  private pool: InstanceType<typeof DatabasePool>;

  constructor() {
    this.pool = DatabasePool as unknown as InstanceType<typeof DatabasePool>;
  }

  private mapRowToTimer(row: any): WorkflowTimer {
    return {
      id: row.id,
      instance_id: row.instance_id,
      node_id: row.node_id,
      timer_type: row.timer_type,
      cron_expression: row.cron_expression,
      duration_ms: row.duration_ms,
      timezone: row.timezone,
      max_executions: row.max_executions,
      current_executions: row.current_executions,
      status: row.status,
      scheduled_at: row.scheduled_at,
      fired_at: row.fired_at,
      resume_event: row.resume_event,
      output_variables: row.output_variables,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  // ==================== Timer CRUD ====================

  async create(data: Partial<WorkflowTimer>): Promise<WorkflowTimer> {
    const result = await this.pool.query(
      `INSERT INTO workflow_timers (instance_id, node_id, timer_type, cron_expression, duration_ms, timezone, max_executions, scheduled_at, resume_event, output_variables)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [
        data.instance_id,
        data.node_id,
        data.timer_type,
        data.cron_expression,
        data.duration_ms,
        data.timezone || 'Asia/Shanghai',
        data.max_executions,
        data.scheduled_at || new Date(),
        data.resume_event,
        JSON.stringify(data.output_variables || {}),
      ]
    );
    return this.mapRowToTimer(result.rows[0]);
  }

  async findById(id: string): Promise<WorkflowTimer | null> {
    const result = await this.pool.query('SELECT * FROM workflow_timers WHERE id = $1', [id]);
    return result.rows[0] ? this.mapRowToTimer(result.rows[0]) : null;
  }

  async findByInstanceId(instanceId: string): Promise<WorkflowTimer[]> {
    const result = await this.pool.query(
      'SELECT * FROM workflow_timers WHERE instance_id = $1 ORDER BY created_at',
      [instanceId]
    );
    return result.rows.map(row => this.mapRowToTimer(row));
  }

  async findPendingTimers(): Promise<WorkflowTimer[]> {
    const result = await this.pool.query(
      "SELECT * FROM workflow_timers WHERE status = 'pending' AND scheduled_at <= now() ORDER BY scheduled_at ASC FOR UPDATE SKIP LOCKED"
    );
    return result.rows.map(row => this.mapRowToTimer(row));
  }

  async updateStatus(id: string, status: WorkflowTimer['status'], outputVariables?: Record<string, any>): Promise<void> {
    const setClauses: string[] = [];
    const params: any[] = [];

    // status 始终是 $1
    params.push(status);
    setClauses.push('status = $1');
    setClauses.push('updated_at = now()');

    if (status === 'completed') {
      setClauses.push('fired_at = now()');
    }

    if (outputVariables) {
      params.push(JSON.stringify(outputVariables));
      setClauses.push(`output_variables = $${params.length}`);
    }

    // id 始终是最后一个参数
    params.push(id);
    await this.pool.query(
      `UPDATE workflow_timers SET ${setClauses.join(', ')} WHERE id = $${params.length}`,
      params
    );
  }

  async incrementExecutions(id: string): Promise<number> {
    const result = await this.pool.query(
      `UPDATE workflow_timers
       SET current_executions = current_executions + 1, updated_at = now()
       WHERE id = $1
       RETURNING current_executions`,
      [id]
    );
    return result.rows[0]?.current_executions || 0;
  }

  async cancelByInstanceId(instanceId: string): Promise<void> {
    await this.pool.query(
      "UPDATE workflow_timers SET status = 'cancelled', updated_at = now() WHERE instance_id = $1 AND status IN ('pending', 'running')",
      [instanceId]
    );
  }

  // ==================== Instance Dependencies ====================

  async addDependency(data: WorkflowInstanceDependency): Promise<WorkflowInstanceDependency> {
    const result = await this.pool.query(
      `INSERT INTO workflow_instance_dependencies (parent_instance_id, child_instance_id, node_id)
       VALUES ($1, $2, $3) ON CONFLICT (parent_instance_id, child_instance_id) DO NOTHING RETURNING *`,
      [data.parent_instance_id, data.child_instance_id, data.node_id]
    );
    return result.rows[0] ? this.mapRowToDependency(result.rows[0]) : data;
  }

  async getChildInstances(parentInstanceId: string): Promise<string[]> {
    const result = await this.pool.query(
      'SELECT child_instance_id FROM workflow_instance_dependencies WHERE parent_instance_id = $1',
      [parentInstanceId]
    );
    return result.rows.map(row => row.child_instance_id);
  }

  async getParentChain(instanceId: string): Promise<string[]> {
    // 递归查询父实例链（检测循环依赖）
    const result = await this.pool.query(
      `WITH RECURSIVE parent_chain AS (
        SELECT parent_instance_id, child_instance_id, 1 as depth
        FROM workflow_instance_dependencies
        WHERE child_instance_id = $1

        UNION ALL

        SELECT wd.parent_instance_id, wd.child_instance_id, pc.depth + 1
        FROM workflow_instance_dependencies wd
        INNER JOIN parent_chain pc ON wd.child_instance_id = pc.parent_instance_id
        WHERE pc.depth < 50  -- 防止无限递归，最大深度 50
      )
      SELECT parent_instance_id FROM parent_chain ORDER BY depth`,
      [instanceId]
    );
    return result.rows.map(row => row.parent_instance_id);
  }

  async hasCircularDependency(instanceId: string): Promise<boolean> {
    const parentChain = await this.getParentChain(instanceId);
    return parentChain.includes(instanceId);
  }

  private mapRowToDependency(row: any): WorkflowInstanceDependency {
    return {
      id: row.id,
      parent_instance_id: row.parent_instance_id,
      child_instance_id: row.child_instance_id,
      node_id: row.node_id,
      created_at: row.created_at,
    };
  }
}
