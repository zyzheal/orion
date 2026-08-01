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
 * GET /api/users
 */
export function listUsers(params?: ListUsersParams) {
  return api.get<PaginatedUserResult>('/api/users', { params });
}

/**
 * Get user detail by ID
 * GET /api/users/:id
 */
export function getUser(id: string) {
  return api.get<User>(`/api/users/${id}`);
}

/**
 * Create a new user
 * POST /api/users
 */
export function createUser(data: CreateUserInput) {
  return api.post<User>('/api/users', data);
}

/**
 * Update an existing user
 * PUT /api/users/:id
 */
export function updateUser(id: string, data: UpdateUserInput) {
  return api.put<User>(`/api/users/${id}`, data);
}

/**
 * Soft delete a user
 * DELETE /api/users/:id
 */
export function deleteUser(id: string) {
  return api.delete(`/api/users/${id}`);
}

// ---- Authentication ----

/**
 * Authenticate user (internal use)
 * POST /api/users/authenticate
 */
export function authenticateUser(username: string, password: string) {
  return api.post<User>('/api/users/authenticate', { username, password });
}

/**
 * Change user password
 * POST /api/users/:id/change-password
 */
export function changePassword(id: string, data: ChangePasswordInput) {
  return api.post(`/api/users/${id}/change-password`, data);
}

// ---- Tenant Management ----

/**
 * Get users by tenant
 * GET /api/users/by-tenant/:tenantId
 */
export function getUsersByTenant(tenantId: string) {
  return api.get<User[]>(`/api/users/by-tenant/${tenantId}`);
}

/**
 * Add user to tenant
 * POST /api/users/:userId/tenants/:tenantId
 */
export function addUserToTenant(userId: string, tenantId: string, role?: string) {
  return api.post(`/api/users/${userId}/tenants/${tenantId}`, { role });
}

/**
 * Remove user from tenant
 * DELETE /api/users/:userId/tenants/:tenantId
 */
export function removeUserFromTenant(userId: string, tenantId: string) {
  return api.delete(`/api/users/${userId}/tenants/${tenantId}`);
}
