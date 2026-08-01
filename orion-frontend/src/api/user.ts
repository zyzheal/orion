/**
 * User API Client
 * 用户管理 API 客户端
 * 后端 API 前缀: /api/users
 */

import { api } from './client';

// ==================== 类型定义 ====================

export interface UserProfile {
  id: string;
  username: string;
  email: string;
  role: string;
  avatar?: string;
  phone?: string;
  status: string;
  createdAt: string;
  teams?: UserTeam[];
  permissions?: UserPermission[];
}

export interface UserTeam {
  id: string;
  name: string;
  role: string;
}

export interface UserPermission {
  resource: string;
  actions: string[];
}

export interface UserActivity {
  id: string;
  action: string;
  resourceType?: string;
  details?: Record<string, unknown>;
  createdAt: string;
}

export interface UserToken {
  id: string;
  name: string;
  expiresAt?: string;
  lastUsedAt?: string;
  createdAt: string;
}

export interface NotificationPreferences {
  emailEnabled: boolean;
  inAppEnabled: boolean;
  webhookEnabled: boolean;
  webhookUrl?: string;
  notifyFrequency: string;
}

// ==================== API 方法 ====================

export const userApi = {
  /**
   * 获取用户档案
   */
  getProfile: (userId: string) => {
    return api.get<UserProfile>(`/api/users/${userId}/profile`);
  },

  /**
   * 更新用户档案
   */
  updateProfile: (userId: string, data: Partial<UserProfile>) => {
    return api.put<UserProfile>(`/api/users/${userId}/profile`, data);
  },

  /**
   * 获取用户所属团队
   */
  getTeams: (userId: string) => {
    return api.get<UserTeam[]>(`/api/users/${userId}/teams`);
  },

  /**
   * 获取用户权限
   */
  getPermissions: (userId: string) => {
    return api.get<UserPermission[]>(`/api/users/${userId}/permissions`);
  },

  /**
   * 获取用户活动日志
   */
  getActivities: (userId: string, page = 1, pageSize = 20) => {
    return api.get<UserActivity[]>(`/api/users/${userId}/activities`, {
      params: { page, pageSize },
    });
  },

  /**
   * 获取用户 API Token 列表
   */
  getTokens: (userId: string) => {
    return api.get<UserToken[]>(`/api/users/${userId}/tokens`);
  },

  /**
   * 创建用户 API Token
   */
  createToken: (userId: string, name: string, expiresInDays?: number) => {
    return api.post<UserToken>(`/api/users/${userId}/tokens`, { name, expiresInDays });
  },

  /**
   * 删除用户 API Token
   */
  deleteToken: (userId: string, tokenId: string) => {
    return api.delete<void>(`/api/users/${userId}/tokens/${tokenId}`);
  },

  /**
   * 获取用户通知偏好设置
   */
  getNotificationPreferences: (userId: string) => {
    return api.get<NotificationPreferences>(`/api/users/${userId}/notifications`);
  },

  /**
   * 更新用户通知偏好设置
   */
  updateNotificationPreferences: (userId: string, data: NotificationPreferences) => {
    return api.put<NotificationPreferences>(`/api/users/${userId}/notifications`, data);
  },

  /**
   * 修改密码
   */
  changePassword: (userId: string, oldPassword: string, newPassword: string) => {
    return api.post<void>(`/api/users/${userId}/change-password`, {
      oldPassword,
      newPassword,
    });
  },
};

export default userApi;