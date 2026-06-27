/**
 * User Profile API Service
 *
 * Aligned with backend /api/v1/users/:id/profile, /:id/teams, /:id/permissions routes (user-profile-routes.ts)
 * Covers: profile get/update, user teams, user permissions
 */
import { api } from './client';

// ==================== Interfaces ====================

export interface UserProfile {
  id: string;
  username: string;
  email: string;
  role: string;
  avatar?: string;
  phone?: string;
  name?: string;
  status?: string;
  createdAt?: string;
  teams?: UserTeam[];
  permissions?: UserPermission[];
}

export interface UpdateProfileInput {
  username?: string;
  email?: string;
  avatar?: string;
  phone?: string;
  name?: string;
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

// ==================== Profile Operations ====================

export const getUserProfile = async (userId: string): Promise<UserProfile> => {
  const response = await api.get<{ data: UserProfile }>(`/v1/users/${userId}/profile`);
  return response.data.data;
};

export const updateUserProfile = async (userId: string, data: UpdateProfileInput): Promise<UserProfile> => {
  const response = await api.put<{ data: UserProfile }>(`/v1/users/${userId}/profile`, data);
  return response.data.data;
};

// ==================== Teams ====================

export const getUserTeams = async (userId: string): Promise<UserTeam[]> => {
  const response = await api.get<{ data: UserTeam[] }>(`/v1/users/${userId}/teams`);
  return response.data.data;
};

// ==================== Permissions ====================

export const getUserPermissions = async (userId: string): Promise<UserPermission[]> => {
  const response = await api.get<{ data: UserPermission[] }>(`/v1/users/${userId}/permissions`);
  return response.data.data;
};
