/**
 * Tenant Management API Service
 * Multi-tenancy, quota management, and namespace pool
 */
import { api } from './client';

export interface TenantInfo {
  tenantId: number;
  userId?: string;
  roles?: string[];
  permissions?: string[];
}

export interface TenantQuota {
  tenantId: number;
  maxPipelines: number;
  maxPipelineRunsPerDay: number;
  maxConcurrentRuns: number;
  maxTasksPerPipeline: number;
  maxRunners: number;
  maxCpuCores: number;
  maxMemoryGb: number;
  maxStorageGb: number;
  maxNamespaces: number;
  apiRateLimit: number;
  apiRateLimitWindowSeconds: number;
}

export interface QuotaCheckResult {
  allowed: boolean;
  currentUsage: number;
  quotaLimit: number;
  remaining: number;
  message?: string;
}

export interface NamespacePoolEntry {
  id: string;
  namespaceName: string;
  clusterId: string;
  tenantId: number | null;
  status: 'available' | 'allocated' | 'reserved';
  purpose?: string;
  labels: Record<string, string>;
  allocatedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface NamespaceAllocationResult {
  success: boolean;
  namespace?: NamespacePoolEntry;
  error?: string;
}

export interface PoolStatus {
  totalNamespaces: number;
  availableNamespaces: number;
  allocatedNamespaces: number;
  reservedNamespaces: number;
  utilizationPercent: number;
}

// ==================== Tenant Context ====================

export function getTenantContext() {
  return api.get<{ context: TenantInfo | null }>('/api/tenant/context');
}

// ==================== Tenant Quota ====================

export function getTenantQuota(tenantId?: number) {
  return api.get<TenantQuota>('/api/tenant/quota', {
    headers: tenantId ? { 'x-tenant-id': tenantId.toString() } : {},
  });
}

export function updateTenantQuota(quota: Partial<TenantQuota>, tenantId?: number) {
  return api.put<TenantQuota>('/api/tenant/quota', quota, {
    headers: tenantId ? { 'x-tenant-id': tenantId.toString() } : {},
  });
}

export function checkTenantQuota(resourceType: string, amount: number, tenantId?: number) {
  return api.post<QuotaCheckResult>(
    '/api/tenant/quota/check',
    { resourceType, amount },
    {
      headers: tenantId ? { 'x-tenant-id': tenantId.toString() } : {},
    }
  );
}

// ==================== Namespace Pool ====================

export function getNamespacePoolStatus() {
  return api.get<PoolStatus>('/api/tenant/namespace/pool');
}

export function allocateNamespace(tenantId: string, namespaceType?: 'build' | 'deploy' | 'test') {
  return api.post<NamespaceAllocationResult>('/api/tenant/namespace/allocate', {
    tenantId,
    namespaceType,
  });
}

export function releaseNamespace(namespaceName: string) {
  return api.post<{ released: boolean }>('/api/tenant/namespace/release', { namespaceName });
}

export function getTenantNamespaces(tenantId: string) {
  return api.get<{ namespaces: NamespacePoolEntry[]; count: number }>(
    `/api/tenant/namespace/${tenantId}`
  );
}

// ==================== Middleware Config ====================

export function getMiddlewareConfig() {
  return api.get<{ config: { enabled: boolean; headerName: string; jwtTenantClaim: string } }>(
    '/api/tenant/middleware/config'
  );
}

export function updateMiddlewareConfig(config: {
  enabled?: boolean;
  headerName?: string;
  jwtTenantClaim?: string;
}) {
  return api.put('/api/tenant/middleware/config', config);
}

// ==================== Tenant CRUD ====================

export interface TenantEntity {
  id: string;
  name: string;
  display_name: string | null;
  status: string;
  settings: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface CreateTenantRequest {
  name: string;
  display_name?: string;
  settings?: Record<string, unknown>;
  autoAllocateNamespace?: boolean;
  initialNamespaceCount?: number;
  customQuota?: {
    maxPipelines?: number;
    maxPipelineRunsPerDay?: number;
    maxConcurrentRuns?: number;
    maxRunners?: number;
    maxCpuCores?: number;
    maxMemoryGb?: number;
    maxStorageGb?: number;
    maxNamespaces?: number;
  };
}

export interface PaginatedTenants {
  data: TenantEntity[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export function listTenants(page = 1, limit = 20, status?: string) {
  const params: Record<string, string> = { page: String(page), limit: String(limit) };
  if (status) params.status = status;
  return api.get<PaginatedTenants>('/api/tenant', { params });
}

export function getTenant(id: string) {
  return api.get<TenantEntity>(`/api/tenant/${id}`);
}

export function createTenant(input: CreateTenantRequest) {
  return api.post<TenantEntity & { allocatedNamespaces?: NamespacePoolEntry[]; message?: string }>('/api/tenant', input);
}

export function updateTenant(id: string, input: Partial<CreateTenantRequest>) {
  return api.put<TenantEntity>(`/api/tenant/${id}`, input);
}

export function deleteTenant(id: string) {
  return api.delete(`/api/tenant/${id}`);
}

// ==================== Usage Statistics ====================

export interface ResourceUsage {
  used: number;
  limit: number;
}

export interface TenantUsage {
  usage: {
    pipelines: ResourceUsage;
    runners: ResourceUsage;
    namespaces: ResourceUsage;
    concurrentRuns: ResourceUsage;
    cpuCores: ResourceUsage;
    memoryGb: ResourceUsage;
    storageGb: ResourceUsage;
    pipelineRunsPerDay: ResourceUsage;
  };
  quota: TenantQuota;
}

export interface NamespaceUsageDetail {
  id: string;
  namespaceName: string;
  status: 'available' | 'allocated' | 'reserved';
  allocatedAt?: string;
  runnerCount: number;
  pipelineCount: number;
  activeRuns: number;
  cpuUsed: number;
  memoryUsed: number;
}

export function getTenantUsage(tenantId?: number) {
  return api.get<TenantUsage>('/api/tenant/usage', {
    headers: tenantId ? { 'x-tenant-id': tenantId.toString() } : {},
  });
}

export function getNamespaceUsageDetail(tenantId: string) {
  return api.get<{ namespaces: NamespaceUsageDetail[]; total: number }>(
    `/api/tenant/namespace/${tenantId}/usage`
  );
}

// ==================== Statistics ====================

export function getTenantStats(tenantId?: number) {
  return api.get<{
    stats: {
      tenantId: number;
      quotaUsage: Record<string, unknown>;
      namespaceCount: number;
    };
  }>('/api/tenant/count', {
    params: tenantId ? { status: undefined } : {},
    headers: tenantId ? { 'x-tenant-id': tenantId.toString() } : {},
  });
}

// ==================== Tenant Invites ====================

export interface TenantInvite {
  id: string;
  tenant_id: string;
  email: string;
  role: string;
  invite_code: string;
  status: 'pending' | 'accepted' | 'expired' | 'cancelled';
  invited_by: string;
  accepted_by?: string;
  expires_at: string;
  created_at: string;
  accepted_at?: string;
}

export interface CreateInviteRequest {
  email: string;
  role: string;
  message?: string;
}

export function inviteUser(tenantId: string, data: CreateInviteRequest) {
  return api.post<TenantInvite>(`/api/tenant/${tenantId}/invite`, data);
}

export function acceptInvite(code: string) {
  return api.post<{ success: boolean; tenant: TenantEntity; role: string; message: string }>(
    `/api/tenant/invite/${code}/accept`
  );
}

// ==================== Tenant Users ====================

export interface TenantUser {
  id: string;
  user_id: string;
  username: string;
  email: string;
  name?: string;
  role: string;
  status: string;
  last_login_at?: string;
  created_at: string;
}

export function getUsersByTenant(tenantId: string) {
  return api.get<{ users: TenantUser[]; total: number }>(`/api/tenant/${tenantId}/users`);
}

export function removeUserFromTenant(tenantId: string, userId: string) {
  return api.delete(`/api/tenant/${tenantId}/users/${userId}`);
}

// ==================== Tenant Alerts ====================

export interface TenantAlert {
  id: string;
  tenant_id: string;
  resource_type: string;
  threshold_percent: number;
  current_usage: number;
  quota_limit: number;
  notify_status: string;
  cooldown_until?: string;
  created_at: string;
}

export function getTenantAlerts(tenantId?: string, params?: { page?: number; limit?: number; resourceType?: string; status?: string }) {
  return api.get<{ alerts: TenantAlert[]; total: number; page: number; limit: number }>('/api/tenant/alerts', {
    params,
    headers: tenantId ? { 'x-tenant-id': tenantId } : {},
  });
}

export function getAlertStats(tenantId?: string) {
  return api.get<{
    stats: {
      byStatus: Record<string, number>;
      byResourceType: Record<string, number>;
      activeAlerts: TenantAlert[];
    };
  }>('/api/tenant/alerts/stats', {
    headers: tenantId ? { 'x-tenant-id': tenantId } : {},
  });
}

// ==================== Current Tenant ====================

export function getCurrentTenant() {
  return api.get<{
    tenant: TenantEntity;
    quota: TenantQuota;
    namespaceCount: number;
    namespaceLimit: number;
    activeAlertCount: number;
  }>('/api/tenant/current');
}
