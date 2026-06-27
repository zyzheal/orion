/**
 * Role Management API Service
 *
 * Aligned with backend /api/v1/roles/* routes (role-routes.ts)
 * Covers: role CRUD, permissions map
 */
import { api } from './client';

// ==================== Interfaces ====================

export interface Role {
  id: string;
  tenant_id: string;
  name: string;
  description?: string;
  permissions: string[];
  is_system?: boolean;
  user_count?: number;
  created_at?: string;
  updated_at?: string;
}

export interface CreateRoleInput {
  tenantId: string;
  name: string;
  description?: string;
  permissions?: string[];
}

export interface UpdateRoleInput {
  name?: string;
  description?: string;
  permissions?: string[];
}

export interface PermissionsMap {
  roles: Array<{
    id: string;
    name: string;
    permissions: string[];
  }>;
  allPermissions: string[];
}

// ==================== Role CRUD ====================

export const getRoles = async (params?: {
  tenantId?: string;
}): Promise<Role[]> => {
  const response = await api.get<{ data: Role[] }>('/v1/roles', { params });
  return response.data.data;
};

export const getRole = async (id: string): Promise<Role> => {
  const response = await api.get<{ data: Role }>(`/v1/roles/${id}`);
  return response.data.data;
};

export const createRole = async (data: CreateRoleInput): Promise<Role> => {
  const response = await api.post<{ data: Role }>('/v1/roles', data);
  return response.data.data;
};

export const updateRole = async (id: string, data: UpdateRoleInput): Promise<Role> => {
  const response = await api.put<{ data: Role }>(`/v1/roles/${id}`, data);
  return response.data.data;
};

export const deleteRole = async (id: string): Promise<void> => {
  await api.delete(`/v1/roles/${id}`);
};

// ==================== Permissions Map ====================

export const getPermissionsMap = async (): Promise<PermissionsMap> => {
  const response = await api.get<{ data: PermissionsMap }>('/v1/roles/permissions-map');
  return response.data.data;
};
