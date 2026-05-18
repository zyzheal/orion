/**
 * RelationshipService - 基于资源所有关系的授权检查
 *
 * 验证用户是否与资源存在所有权或关联关系：
 * - 用户是否为资源 owner
 * - 用户是否为项目成员
 * - 用户是否通过团队关联到资源
 */

export interface RelationshipCheckRequest {
  userId: string;
  projectId?: string;
  resourceId?: string;
  resourceType: string;
  ownerId?: string;
}

export interface RelationshipCheckResult {
  allowed: boolean;
  reason: string;
  relationshipType?: 'owner' | 'project_member' | 'team_member' | 'collaborator';
}

export interface ResourceOwnerRecord {
  resourceId: string;
  resourceType: string;
  ownerId: string;
  ownerType: 'user' | 'team' | 'project';
}

export class RelationshipService {
  private ownershipMap: Map<string, ResourceOwnerRecord> = new Map();
  private projectMembers: Map<string, Set<string>> = new Map(); // projectId -> userIds
  private teamMembers: Map<string, Set<string>> = new Map(); // teamId -> userIds
  private collaborators: Map<string, Set<string>> = new Map(); // resourceId -> userIds

  /**
   * 注册资源所有权
   */
  registerOwnership(record: ResourceOwnerRecord): void {
    const key = `${record.resourceType}:${record.resourceId}`;
    this.ownershipMap.set(key, record);
  }

  /**
   * 移除资源所有权
   */
  removeOwnership(resourceType: string, resourceId: string): void {
    const key = `${resourceType}:${resourceId}`;
    this.ownershipMap.delete(key);
  }

  /**
   * 添加项目成员
   */
  addProjectMember(projectId: string, userId: string): void {
    if (!this.projectMembers.has(projectId)) {
      this.projectMembers.set(projectId, new Set());
    }
    this.projectMembers.get(projectId)!.add(userId);
  }

  /**
   * 移除项目成员
   */
  removeProjectMember(projectId: string, userId: string): void {
    this.projectMembers.get(projectId)?.delete(userId);
  }

  /**
   * 添加团队成员
   */
  addTeamMember(teamId: string, userId: string): void {
    if (!this.teamMembers.has(teamId)) {
      this.teamMembers.set(teamId, new Set());
    }
    this.teamMembers.get(teamId)!.add(userId);
  }

  /**
   * 添加资源协作者
   */
  addCollaborator(resourceId: string, userId: string): void {
    if (!this.collaborators.has(resourceId)) {
      this.collaborators.set(resourceId, new Set());
    }
    this.collaborators.get(resourceId)!.add(userId);
  }

  /**
   * 移除资源协作者
   */
  removeCollaborator(resourceId: string, userId: string): void {
    this.collaborators.get(resourceId)?.delete(userId);
  }

  /**
   * 执行关系检查
   */
  async check(req: RelationshipCheckRequest): Promise<RelationshipCheckResult> {
    // 1. 检查是否为资源所有者
    if (req.ownerId && req.ownerId === req.userId) {
      return {
        allowed: true,
        reason: 'User is the resource owner',
        relationshipType: 'owner',
      };
    }

    // 2. 通过 ownership map 检查
    if (req.resourceId) {
      const key = `${req.resourceType}:${req.resourceId}`;
      const record = this.ownershipMap.get(key);
      if (record) {
        if (record.ownerType === 'user' && record.ownerId === req.userId) {
          return {
            allowed: true,
            reason: 'User is the registered resource owner',
            relationshipType: 'owner',
          };
        }
        if (record.ownerType === 'team' && this.teamMembers.get(record.ownerId)?.has(req.userId)) {
          return {
            allowed: true,
            reason: 'User is a member of the owning team',
            relationshipType: 'team_member',
          };
        }
        if (record.ownerType === 'project' && this.projectMembers.get(record.ownerId)?.has(req.userId)) {
          return {
            allowed: true,
            reason: 'User is a member of the owning project',
            relationshipType: 'project_member',
          };
        }
      }
    }

    // 3. 检查项目成员关系
    if (req.projectId && this.projectMembers.get(req.projectId)?.has(req.userId)) {
      return {
        allowed: true,
        reason: 'User is a member of the project',
        relationshipType: 'project_member',
      };
    }

    // 4. 检查协作者关系
    if (req.resourceId && this.collaborators.get(req.resourceId)?.has(req.userId)) {
      return {
        allowed: true,
        reason: 'User is a collaborator on this resource',
        relationshipType: 'collaborator',
      };
    }

    // 所有关系检查均未通过
    return {
      allowed: false,
      reason: 'No ownership or membership relationship found between user and resource',
    };
  }

  /**
   * 获取用户拥有的资源列表
   */
  getUserOwnedResources(userId: string): ResourceOwnerRecord[] {
    return Array.from(this.ownershipMap.values()).filter(
      (record) => record.ownerType === 'user' && record.ownerId === userId,
    );
  }

  /**
   * 获取项目的成员列表
   */
  getProjectMembers(projectId: string): string[] {
    return Array.from(this.projectMembers.get(projectId) || []);
  }

  /**
   * 清空所有关系数据（用于测试）
   */
  clearAll(): void {
    this.ownershipMap.clear();
    this.projectMembers.clear();
    this.teamMembers.clear();
    this.collaborators.clear();
  }
}
