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
  settings: Record<string, any>;
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
  settings?: Record<string, any>;
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
 * GET /api/v1/users
 */
export function listUsers(params?: ListUsersParams) {
  return api.get<PaginatedUserResult>('/v1/users', { params });
}

/**
 * Get user detail by ID
 * GET /api/v1/users/:id
 */
export function getUser(id: string) {
  return api.get<User>(`/v1/users/${id}`);
}

/**
 * Create a new user
 * POST /api/v1/users
 */
export function createUser(data: CreateUserInput) {
  return api.post<User>('/v1/users', data);
}

/**
 * Update an existing user
 * PUT /api/v1/users/:id
 */
export function updateUser(id: string, data: UpdateUserInput) {
  return api.put<User>(`/v1/users/${id}`, data);
}

/**
 * Soft delete a user
 * DELETE /api/v1/users/:id
 */
export function deleteUser(id: string) {
  return api.delete(`/v1/users/${id}`);
}

// ---- Authentication ----

/**
 * Authenticate user (internal use)
 * POST /api/v1/users/authenticate
 */
export function authenticateUser(username: string, password: string) {
  return api.post<User>('/v1/users/authenticate', { username, password });
}

/**
 * Change user password
 * POST /api/v1/users/:id/change-password
 */
export function changePassword(id: string, data: ChangePasswordInput) {
  return api.post(`/v1/users/${id}/change-password`, data);
}

// ---- Tenant Management ----

/**
 * Get users by tenant
 * GET /api/v1/users/by-tenant/:tenantId
 */
export function getUsersByTenant(tenantId: string) {
  return api.get<User[]>(`/v1/users/by-tenant/${tenantId}`);
}

/**
 * Add user to tenant
 * POST /api/v1/users/:userId/tenants/:tenantId
 */
export function addUserToTenant(userId: string, tenantId: string, role?: string) {
  return api.post(`/v1/users/${userId}/tenants/${tenantId}`, { role });
}

/**
 * Remove user from tenant
 * DELETE /api/v1/users/:userId/tenants/:tenantId
 */
export function removeUserFromTenant(userId: string, tenantId: string) {
  return api.delete(`/v1/users/${userId}/tenants/${tenantId}`);
}
