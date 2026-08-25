/**
 * User Management API Service
 * User CRUD, authentication, password management, and tenant-user mapping
 */
import { api } from './client';

// ---- Types ----

export interface User {
  id: string;
  username: string;
  email: string | null;
  name: string | null;
  avatar_url: string | null;
  role: string;
  status: string;
  last_login_at: string | null;
  last_login_ip: string | null;
  settings: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface CreateUserInput {
  username: string;
  email?: string;
  passwordHash: string;
  name?: string;
  avatar_url?: string;
  role?: string;
  tenantId?: string;
}

export interface UpdateUserInput {
  username?: string;
  email?: string;
  name?: string;
  avatar_url?: string;
  role?: string;
  status?: string;
  settings?: Record<string, unknown>;
}

export interface ChangePasswordInput {
  oldPassword: string;
  newPassword: string;
}

export interface ListUsersParams {
  page?: number;
  limit?: number;
  tenantId?: string;
  status?: string;
  role?: string;
}

export interface PaginatedUserResult {
  data: User[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ---- CRUD ----

/**
 * List users with pagination and optional filters
 * GET /users
 */
export function listUsers(params?: ListUsersParams) {
  return api.get<PaginatedUserResult>('/users', { params });
}

/**
 * Get user detail by ID
 * GET /users/:id
 */
export function getUser(id: string) {
  return api.get<User>(`/users/${id}`);
}

/**
 * Create a new user
 * POST /users
 */
export function createUser(data: CreateUserInput) {
  return api.post<User>('/users', data);
}

/**
 * Update an existing user
 * PUT /users/:id
 */
export function updateUser(id: string, data: UpdateUserInput) {
  return api.put<User>(`/users/${id}`, data);
}

/**
 * Soft delete a user
 * DELETE /users/:id
 */
export function deleteUser(id: string) {
  return api.delete(`/users/${id}`);
}

// ---- Authentication ----

/**
 * Authenticate user (internal use)
 * POST /users/authenticate
 */
export function authenticateUser(username: string, password: string) {
  return api.post<User>('/users/authenticate', { username, password });
}

/**
 * Change user password
 * POST /users/:id/change-password
 */
export function changePassword(id: string, data: ChangePasswordInput) {
  return api.post(`/users/${id}/change-password`, data);
}

/**
 * 管理员重置用户密码 — 无需原密码
 * POST /users/:id/admin-reset-password
 */
export function adminResetPassword(id: string, data: { newPassword: string }) {
  return api.post(`/users/${id}/admin-reset-password`, data);
}

// ---- Tenant Management ----

/**
 * Get users by tenant
 * GET /users/by-tenant/:tenantId
 */
export function getUsersByTenant(tenantId: string) {
  return api.get<User[]>(`/users/by-tenant/${tenantId}`);
}

/**
 * Add user to tenant
 * POST /users/:userId/tenants/:tenantId
 */
export function addUserToTenant(userId: string, tenantId: string, role?: string) {
  return api.post(`/users/${userId}/tenants/${tenantId}`, { role });
}

/**
 * Remove user from tenant
 * DELETE /users/:userId/tenants/:tenantId
 */
export function removeUserFromTenant(userId: string, tenantId: string) {
  return api.delete(`/users/${userId}/tenants/${tenantId}`);
}
