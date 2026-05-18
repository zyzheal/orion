/**
 * RelationshipService - 基于资源所有关系的授权检查
 *
 * 验证用户是否与资源存在所有权或关联关系：
 * - 用户是否为资源 owner
 * - 用户是否为项目成员（通过 project_members 表）
 *
 * 使用 PostgreSQL 持久化存储，替代内存 Map 实现。
 */

import { DatabasePool } from '../database';

export interface RelationshipCheckRequest {
  userId: string;
  tenantId?: string;
  projectId?: string;
  resourceId?: string;
  resourceType: string;
  ownerId?: string;
  ownerTenantId?: string;
}

export interface RelationshipCheckResult {
  allowed: boolean;
  reason: string;
  relationshipType?: 'owner' | 'project_member' | 'team_member' | 'collaborator';
}

export class RelationshipService {
  constructor(private db: DatabasePool) {}

  async check(req: RelationshipCheckRequest): Promise<RelationshipCheckResult> {
    // 1. Owner 检查
    if (req.ownerId && req.userId === req.ownerId) {
      // 跨租户校验：资源 owner 的租户必须与请求用户的租户一致
      if (req.tenantId && req.ownerTenantId && req.tenantId !== req.ownerTenantId) {
        return {
          allowed: false,
          reason: 'Cross-tenant ownership mismatch',
        };
      }
      return {
        allowed: true,
        reason: 'User is the resource owner',
        relationshipType: 'owner',
      };
    }

    // 1.5 跨租户 ownerId 安全检查：当 ownerId 与 userId 不同但存在于同一租户时
    // 防止通过篡改 ownerId 绕过授权
    if (req.ownerId && req.ownerId !== req.userId && req.tenantId && req.ownerTenantId) {
      if (req.tenantId !== req.ownerTenantId) {
        return {
          allowed: false,
          reason: 'Resource owner belongs to a different tenant',
        };
      }
    }

    // 2. 项目成员检查（通过 project_members 表）
    if (req.projectId) {
      const result = await this.db.query(
        'SELECT role FROM project_members WHERE project_id = $1 AND user_id = $2',
        [req.projectId, req.userId]
      );
      if (result.rows.length > 0) {
        return {
          allowed: true,
          reason: `Project member with role: ${result.rows[0].role}`,
          relationshipType: 'project_member',
        };
      }
    }

    return {
      allowed: false,
      reason: 'Not resource owner or project member',
    };
  }

  /**
   * 添加项目成员
   */
  async addProjectMember(projectId: string, userId: string, role: string): Promise<void> {
    await this.db.query(
      `INSERT INTO project_members (project_id, user_id, role)
       VALUES ($1, $2, $3)
       ON CONFLICT (project_id, user_id) DO UPDATE SET role = $3`,
      [projectId, userId, role]
    );
  }

  /**
   * 移除项目成员
   */
  async removeProjectMember(projectId: string, userId: string): Promise<void> {
    await this.db.query(
      'DELETE FROM project_members WHERE project_id = $1 AND user_id = $2',
      [projectId, userId]
    );
  }

  /**
   * 获取项目成员列表
   */
  async getProjectMembers(projectId: string): Promise<{ user_id: string; role: string }[]> {
    const result = await this.db.query(
      'SELECT user_id, role FROM project_members WHERE project_id = $1',
      [projectId]
    );
    return result.rows;
  }

  /**
   * 检查用户是否为项目成员
   */
  async isProjectMember(projectId: string, userId: string): Promise<boolean> {
    const result = await this.db.query(
      'SELECT 1 FROM project_members WHERE project_id = $1 AND user_id = $2',
      [projectId, userId]
    );
    return result.rows.length > 0;
  }
}
