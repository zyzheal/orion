/**
 * Service Catalog API Service
 *
 * Aligned with backend /api/v1/service-catalog routes (handler.go)
 * - Catalog: CRUD for {id, tenant_id, name, value, enabled, created_at, updated_at}
 * - Requests: lifecycle management with status/timeline/sla
 */
import { api } from './client';

export interface ServiceCatalog {
  id: string;
  tenantId: string;
  name: string;
  value: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateServiceCatalogRequest {
  name: string;
  value?: string;
  enabled?: boolean;
}

export interface UpdateServiceCatalogRequest {
  name?: string;
  value?: string;
  enabled?: boolean;
}

export interface ServiceRequest {
  id: string;
  tenantId: string;
  serviceId: string;
  title: string;
  description: string;
  priority: string;
  status: string;
  assignedTo?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TimelineEntry {
  at: string;
  action: string;
  by: string;
  comment: string;
}

export interface SLABreach {
  requestId: string;
  service: string;
  slaTargetMs: number;
  actualMs: number;
  overdueMs: number;
  status: string;
}

export interface SLABreachesResponse {
  total: number;
  breaches: SLABreach[];
}

// ==================== Catalog CRUD ====================

export const listCatalogItems = async (params?: {
  page?: number;
  pageSize?: number;
  q?: string;
}): Promise<ServiceCatalog[]> => {
  const p: Record<string, unknown> = {};
  if (params?.page) p.page = params.page;
  if (params?.pageSize) p.pageSize = params.pageSize;
  if (params?.q) p.q = params.q;
  const qs = Object.keys(p).length > 0 ? '?' + new URLSearchParams(
    Object.entries(p).map(([k, v]) => [k, String(v)])
  ) : '';
  const res = await api.get(`/api/v1/service-catalog${qs}`);
  const data = res.data;
  return Array.isArray(data) ? data : (data?.data || []);
};

export const getCatalogItem = async (id: string): Promise<ServiceCatalog> => {
  const res = await api.get(`/api/v1/service-catalog/${id}`);
  return res.data as ServiceCatalog;
};

export const createCatalogItem = async (
  data: CreateServiceCatalogRequest
): Promise<ServiceCatalog> => {
  const res = await api.post('/api/v1/service-catalog', data);
  return res.data as ServiceCatalog;
};

export const updateCatalogItem = async (
  id: string,
  data: UpdateServiceCatalogRequest
): Promise<ServiceCatalog> => {
  const res = await api.put(`/api/v1/service-catalog/${id}`, data);
  return res.data as ServiceCatalog;
};

export const deleteCatalogItem = async (id: string): Promise<void> => {
  await api.delete(`/api/v1/service-catalog/${id}`);
};

// ==================== Request Lifecycle ====================

export const updateRequestStatus = async (
  id: string,
  data: {
    status: string;
    comment?: string;
    assignedTo?: string;
  }
): Promise<ServiceRequest> => {
  const res = await api.post(`/api/v1/service-catalog/requests/${id}/status`, data);
  return res.data as ServiceRequest;
};

export const getRequestTimeline = async (
  id: string
): Promise<TimelineEntry[]> => {
  const res = await api.get(`/api/v1/service-catalog/requests/${id}/timeline`);
  const data = res.data;
  return Array.isArray(data) ? data : (data?.data || []);
};

export const getSLABreaches = async (params?: {
  service?: string;
  from?: number;
  limit?: number;
}): Promise<SLABreachesResponse> => {
  const p: Record<string, string> = {};
  if (params?.service) p.service = params.service;
  if (params?.from) p.from = String(params.from);
  if (params?.limit) p.limit = String(params.limit);
  const qs = Object.keys(p).length > 0 ? '?' + new URLSearchParams(p) : '';
  const res = await api.get(`/api/v1/service-catalog/sla-breaches${qs}`);
  const data = res.data;
  return data as SLABreachesResponse;
};