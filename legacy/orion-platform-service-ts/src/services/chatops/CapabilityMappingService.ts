/**
 * Capability Mapping Service
 *
 * 管理 ChatOps 命令与全局 Capability 的映射关系
 * 允许管理员配置哪些命令需要哪些权限，以及是否需要审批
 */

import { DatabasePool } from '../database';
import { v4 as uuidv4 } from 'uuid';

export interface ChatOpsCapabilityMapping {
  id: string;
  command_id: string;
  capability_id: string;
  environment?: string;
  risk_level: number;
  requires_approval: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface CapabilityMappingInput {
  command_id: string;
  capability_id: string;
  environment?: string;
  risk_level: number;
  requires_approval: boolean;
}

export interface ApprovalConfig {
  id: string;
  capability: string;
  enabled: boolean;
  approvers: string[];
  threshold: number;
  created_at: Date;
  updated_at: Date;
}

export interface ApprovalConfigInput {
  capability: string;
  enabled: boolean;
  approvers: string[];
  threshold: number;
}

export class CapabilityMappingService {
  constructor(private pool: DatabasePool) {}

  /**
   * 获取所有命令-Capability 映射
   */
  async getAllMappings(environment?: string): Promise<ChatOpsCapabilityMapping[]> {
    let query = 'SELECT * FROM chatops_capability_mappings';
    const params: any[] = [];

    if (environment) {
      query += ' WHERE environment = $1 OR environment IS NULL';
      params.push(environment);
    }

    query += ' ORDER BY command_id, environment';

    const result = await this.pool.query(query, params);
    return result.rows;
  }

  /**
   * 根据 ID 获取映射
   */
  async getMappingById(id: string): Promise<ChatOpsCapabilityMapping | null> {
    const result = await this.pool.query(
      'SELECT * FROM chatops_capability_mappings WHERE id = $1',
      [id]
    );
    return result.rows[0] || null;
  }

  /**
   * 创建映射
   */
  async createMapping(input: CapabilityMappingInput): Promise<ChatOpsCapabilityMapping> {
    const id = uuidv4();
    const now = new Date();

    await this.pool.query(
      `INSERT INTO chatops_capability_mappings
       (id, command_id, capability_id, environment, risk_level, requires_approval, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [id, input.command_id, input.capability_id, input.environment || null,
       input.risk_level, input.requires_approval, now, now]
    );

    return {
      id,
      command_id: input.command_id,
      capability_id: input.capability_id,
      environment: input.environment,
      risk_level: input.risk_level,
      requires_approval: input.requires_approval,
      created_at: now,
      updated_at: now,
    };
  }

  /**
   * 更新映射
   */
  async updateMapping(
    id: string,
    input: Partial<CapabilityMappingInput>
  ): Promise<ChatOpsCapabilityMapping | null> {
    const existing = await this.getMappingById(id);
    if (!existing) return null;

    const updates: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (input.command_id !== undefined) {
      updates.push(`command_id = $${paramIndex++}`);
      params.push(input.command_id);
    }
    if (input.capability_id !== undefined) {
      updates.push(`capability_id = $${paramIndex++}`);
      params.push(input.capability_id);
    }
    if (input.environment !== undefined) {
      updates.push(`environment = $${paramIndex++}`);
      params.push(input.environment || null);
    }
    if (input.risk_level !== undefined) {
      updates.push(`risk_level = $${paramIndex++}`);
      params.push(input.risk_level);
    }
    if (input.requires_approval !== undefined) {
      updates.push(`requires_approval = $${paramIndex++}`);
      params.push(input.requires_approval);
    }

    if (updates.length === 0) return existing;

    updates.push(`updated_at = $${paramIndex++}`);
    params.push(new Date());
    params.push(id);

    await this.pool.query(
      `UPDATE chatops_capability_mappings SET ${updates.join(', ')} WHERE id = $${paramIndex}`,
      params
    );

    return this.getMappingById(id);
  }

  /**
   * 删除映射
   */
  async deleteMapping(id: string): Promise<boolean> {
    const result = await this.pool.query(
      'DELETE FROM chatops_capability_mappings WHERE id = $1',
      [id]
    );
    return (result.rowCount ?? 0) > 0;
  }

  /**
   * 获取命令的映射（用于执行前检查）
   */
  async getMappingForCommand(commandId: string, environment?: string): Promise<ChatOpsCapabilityMapping | null> {
    // 优先匹配环境特定的映射
    if (environment) {
      const result = await this.pool.query(
        `SELECT * FROM chatops_capability_mappings
         WHERE command_id = $1 AND environment = $2`,
        [commandId, environment]
      );
      if (result.rows[0]) return result.rows[0];
    }

    // 其次匹配无环境限制的映射
    const result = await this.pool.query(
      `SELECT * FROM chatops_capability_mappings
       WHERE command_id = $1 AND environment IS NULL`,
      [commandId]
    );
    return result.rows[0] || null;
  }

  // ==================== Approval Config ====================

  /**
   * 获取所有审批配置
   */
  async getAllApprovalConfigs(): Promise<ApprovalConfig[]> {
    const result = await this.pool.query(
      'SELECT * FROM chatops_approval_configs ORDER BY capability'
    );
    return result.rows;
  }

  /**
   * 根据 capability 获取审批配置
   */
  async getApprovalConfigByCapability(capability: string): Promise<ApprovalConfig | null> {
    const result = await this.pool.query(
      'SELECT * FROM chatops_approval_configs WHERE capability = $1',
      [capability]
    );
    return result.rows[0] || null;
  }

  /**
   * 批量更新审批配置
   */
  async updateApprovalConfigs(configs: ApprovalConfigInput[]): Promise<ApprovalConfig[]> {
    const results: ApprovalConfig[] = [];

    for (const config of configs) {
      const existing = await this.getApprovalConfigByCapability(config.capability);
      const now = new Date();

      if (existing) {
        await this.pool.query(
          `UPDATE chatops_approval_configs
           SET enabled = $1, approvers = $2, threshold = $3, updated_at = $4
           WHERE capability = $5`,
          [config.enabled, JSON.stringify(config.approvers), config.threshold, now, config.capability]
        );
      } else {
        const id = uuidv4();
        await this.pool.query(
          `INSERT INTO chatops_approval_configs
           (id, capability, enabled, approvers, threshold, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [id, config.capability, config.enabled, JSON.stringify(config.approvers), config.threshold, now, now]
        );
      }

      const updated = await this.getApprovalConfigByCapability(config.capability);
      if (updated) results.push(updated);
    }

    return results;
  }

  /**
   * 更新单个 capability 的审批配置
   */
  async updateApprovalConfig(
    capability: string,
    input: Partial<ApprovalConfigInput>
  ): Promise<ApprovalConfig | null> {
    const existing = await this.getApprovalConfigByCapability(capability);
    if (!existing) return null;

    const updates: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (input.enabled !== undefined) {
      updates.push(`enabled = $${paramIndex++}`);
      params.push(input.enabled);
    }
    if (input.approvers !== undefined) {
      updates.push(`approvers = $${paramIndex++}`);
      params.push(JSON.stringify(input.approvers));
    }
    if (input.threshold !== undefined) {
      updates.push(`threshold = $${paramIndex++}`);
      params.push(input.threshold);
    }

    if (updates.length === 0) return existing;

    updates.push(`updated_at = $${paramIndex++}`);
    params.push(new Date());
    params.push(capability);

    await this.pool.query(
      `UPDATE chatops_approval_configs SET ${updates.join(', ')} WHERE capability = $${paramIndex}`,
      params
    );

    return this.getApprovalConfigByCapability(capability);
  }

  /**
   * 获取审批人列表
   */
  async getApprovers(): Promise<{ user_id: string; username: string; role: string }[]> {
    const result = await this.pool.query(
      `SELECT DISTINCT u.id as user_id, u.username, r.name as role
       FROM users u
       JOIN user_roles ur ON u.id = ur.user_id
       JOIN roles r ON ur.role_id = r.id
       WHERE r.name IN ('admin', 'approver')
       ORDER BY u.username`
    );
    return result.rows;
  }

  /**
   * 获取审批人值班表
   */
  async getApproverSchedule(): Promise<any> {
    const result = await this.pool.query(
      'SELECT * FROM chatops_approver_schedule ORDER BY start_time'
    );
    return result.rows;
  }

  /**
   * 更新审批人值班表
   */
  async updateApproverSchedule(schedule: any[]): Promise<void> {
    await this.pool.query('DELETE FROM chatops_approver_schedule');

    for (const item of schedule) {
      await this.pool.query(
        `INSERT INTO chatops_approver_schedule
         (id, user_id, start_time, end_time)
         VALUES ($1, $2, $3, $4)`,
        [uuidv4(), item.user_id, new Date(item.start_time), new Date(item.end_time)]
      );
    }
  }

  /**
   * 获取全局审批开关
   */
  async getGlobalApprovalConfig(): Promise<{ enabled: boolean; mode: string }> {
    const result = await this.pool.query(
      "SELECT value FROM system_config WHERE key = 'chatops.approval.global'"
    );
    if (result.rows[0]) {
      return JSON.parse(result.rows[0].value);
    }
    return { enabled: false, mode: 'any' };
  }

  /**
   * 更新全局审批开关
   */
  async updateGlobalApprovalConfig(config: { enabled: boolean; mode: string }): Promise<void> {
    await this.pool.query(
      `INSERT INTO system_config (key, value, updated_at)
       VALUES ('chatops.approval.global', $1, NOW())
       ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()`,
      [JSON.stringify(config)]
    );
  }
}