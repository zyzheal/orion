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
  return api.get<{ context: TenantInfo | null }>('/v1/tenant/context');
}

// ==================== Tenant Quota ====================

export function getTenantQuota(tenantId?: number) {
  return api.get<TenantQuota>('/v1/tenant/quota', {
    headers: tenantId ? { 'x-tenant-id': tenantId.toString() } : {},
  });
}

export function updateTenantQuota(quota: Partial<TenantQuota>, tenantId?: number) {
  return api.put<TenantQuota>('/v1/tenant/quota', quota, {
    headers: tenantId ? { 'x-tenant-id': tenantId.toString() } : {},
  });
}

export function checkTenantQuota(resourceType: string, amount: number, tenantId?: number) {
  return api.post<QuotaCheckResult>(
    '/v1/tenant/quota/check',
    { resourceType, amount },
    {
      headers: tenantId ? { 'x-tenant-id': tenantId.toString() } : {},
    }
  );
}

// ==================== Namespace Pool ====================

export function getNamespacePoolStatus() {
  return api.get<PoolStatus>('/v1/tenant/namespace/pool');
}

export function allocateNamespace(tenantId: number, namespaceType?: 'build' | 'deploy' | 'test') {
  return api.post<NamespaceAllocationResult>('/v1/tenant/namespace/allocate', {
    tenantId,
    namespaceType,
  });
}

export function releaseNamespace(namespaceName: string) {
  return api.post<{ released: boolean }>('/v1/tenant/namespace/release', { namespaceName });
}

export function getTenantNamespaces(tenantId: number) {
  return api.get<{ namespaces: NamespacePoolEntry[]; count: number }>(`/v1/tenant/namespace/${tenantId}`);
}

// ==================== Middleware Config ====================

export function getMiddlewareConfig() {
  return api.get<{ config: { enabled: boolean; headerName: string; jwtTenantClaim: string } }>(
    '/v1/tenant/middleware/config'
  );
}

export function updateMiddlewareConfig(config: {
  enabled?: boolean;
  headerName?: string;
  jwtTenantClaim?: string;
}) {
  return api.put('/v1/tenant/middleware/config', config);
}

// ==================== Statistics ====================

export function getTenantStats(tenantId?: number) {
  return api.get<{
    stats: {
      tenantId: number;
      quotaUsage: any;
      namespaceCount: number;
    };
  }>('/v1/tenant/count', {
    params: tenantId ? { status: undefined } : {},
    headers: tenantId ? { 'x-tenant-id': tenantId.toString() } : {},
  });
}
