/**
 * UserProfileService - 用户档案服务
 *
 * 提供用户档案的读取、更新及相关信息查询
 * 复用 UserRepository 进行数据访问
 */

import { UserRepository, User, UpdateUserInput } from './UserRepository';

/**
 * 用户基本档案
 */
export interface UserProfile {
  id: string;
  username: string;
  email: string;
  role: string;
  avatar?: string;
  phone?: string;
  status: string;
  createdAt: Date;
  teams?: UserTeam[];
  permissions?: UserPermission[];
}

/**
 * 用户所属团队
 */
export interface UserTeam {
  id: string;
  name: string;
  role: string;
}

/**
 * 用户权限
 */
export interface UserPermission {
  resource: string;
  actions: string[];
}

/**
 * 更新用户档案的输入
 */
export interface UpdateProfileInput {
  username?: string;
  email?: string;
  avatar?: string;
  phone?: string;
  name?: string;
}

/**
 * UserProfileService 错误
 */
export class UserProfileServiceError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'UserProfileServiceError';
  }
}

/**
 * UserProfileService - 用户档案业务逻辑
 */
export class UserProfileService {
  constructor(private userRepository: UserRepository) {}

  /**
   * 将 User 实体转换为 UserProfile 格式
   */
  private toUserProfile(user: User, teams?: UserTeam[], permissions?: UserPermission[]): UserProfile {
    return {
      id: user.id,
      username: user.username,
      email: user.email || '',
      role: user.role,
      avatar: user.avatar_url || undefined,
      phone: undefined, // 暂未实现，待后续扩展
      status: user.status,
      createdAt: user.created_at,
      teams,
      permissions,
    };
  }

  /**
   * 获取用户基本档案
   * @param userId 用户ID
   * @returns 用户档案，如果用户不存在返回 null
   */
  async getProfile(userId: string): Promise<UserProfile | null> {
    const user = await this.userRepository.findById(userId);

    if (!user) {
      return null;
    }

    // 获取用户团队和权限
    const teams = await this.getUserTeams(userId);
    const permissions = await this.getUserPermissions(userId);

    return this.toUserProfile(user, teams, permissions);
  }

  /**
   * 获取用户所属团队
   * @param userId 用户ID
   * @returns 用户所属团队列表
   *
   * TODO: 待后续实现从数据库查询用户团队
   * 当前返回空数组
   */
  async getUserTeams(userId: string): Promise<UserTeam[]> {
    // TODO: 实现从 user_teams 或 tenant_users 表查询
    // 暂时返回空数组，待后续功能实现
    return [];
  }

  /**
   * 获取用户权限
   * @param userId 用户ID
   * @returns 用户权限列表
   *
   * TODO: 待后续实现从权限系统查询用户权限
   * 当前返回空数组
   */
  async getUserPermissions(userId: string): Promise<UserPermission[]> {
    // TODO: 实现从 user_permissions 或 role_permissions 表查询
    // 暂时返回空数组，待后续功能实现
    return [];
  }

  /**
   * 更新用户资料
   * @param userId 用户ID
   * @param data 要更新的字段
   * @returns 更新后的用户档案，如果用户不存在返回 null
   */
  async updateProfile(userId: string, data: Partial<UpdateProfileInput>): Promise<UserProfile | null> {
    // 检查用户是否存在
    const existingUser = await this.userRepository.findById(userId);
    if (!existingUser) {
      return null;
    }

    // 构建更新输入
    const updateInput: UpdateUserInput = {};

    if (data.username !== undefined) {
      updateInput.username = data.username;
    }

    if (data.email !== undefined) {
      updateInput.email = data.email;
    }

    if (data.avatar !== undefined) {
      updateInput.avatar_url = data.avatar;
    }

    if (data.name !== undefined) {
      updateInput.name = data.name;
    }

    // 如果没有要更新的字段，直接返回当前档案
    if (Object.keys(updateInput).length === 0) {
      return this.getProfile(userId);
    }

    // 执行更新
    const updatedUser = await this.userRepository.update(userId, updateInput);

    if (!updatedUser) {
      return null;
    }

    // 获取完整的用户档案
    return this.getProfile(userId);
  }

  /**
   * 检查用户名是否已存在
   * @param username 用户名
   * @returns 是否存在
   */
  async isUsernameExists(username: string): Promise<boolean> {
    return this.userRepository.existsByUsername(username);
  }

  /**
   * 检查邮箱是否已存在
   * @param email 邮箱
   * @returns 是否存在
   */
  async isEmailExists(email: string): Promise<boolean> {
    return this.userRepository.existsByEmail(email);
  }
}