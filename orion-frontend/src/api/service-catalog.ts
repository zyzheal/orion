/**
 * Service Catalog API Service
 *
 * Aligned with backend /api/v1/catalog/* routes (service-catalog-routes.ts)
 * Covers: catalog services CRUD, service requests workflow, statistics
 */
import { api } from './client';

export interface CatalogService {
  id: string;
  tenant_id: string;
  name: string;
  description?: string;
  category?: string;
  status: 'active' | 'inactive' | 'retired';
  owner?: string;
  support_team?: string;
  sla_tier?: 'gold' | 'silver' | 'bronze';
  availability_target?: number;
  response_time_target?: number;
  form_schema?: Record<string, any>;
  approval_flow?: Record<string, any>;
  metadata?: Record<string, any>;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface CatalogRequest {
  id: string;
  tenant_id: string;
  service_id: string;
  requester_id: string;
  title: string;
  description?: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  status: 'pending' | 'approved' | 'in_progress' | 'fulfilled' | 'rejected' | 'cancelled';
  assigned_to?: string;
  approved_by?: string;
  approved_at?: string;
  fulfilled_at?: string;
  sla_breach?: boolean;
  form_data?: Record<string, any>;
  metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface CatalogStats {
  totalServices: number;
  totalRequests: number;
  requestsByStatus: Record<string, number>;
}

// ==================== Catalog Services ====================

export const getCatalogServices = async (params?: {
  category?: string;
  status?: string;
  limit?: number;
  offset?: number;
}): Promise<{ data: CatalogService[]; total: number }> => {
  const response = await api.get<{ data: CatalogService[]; total: number }>('/v1/catalog/services', { params });
  return { data: response.data.data, total: response.data.total };
};

export const getCatalogService = async (id: string): Promise<CatalogService> => {
  const response = await api.get<{ data: CatalogService }>(`/v1/catalog/services/${id}`);
  return response.data.data;
};

export const createCatalogService = async (data: {
  name: string;
  description?: string;
  category?: string;
  owner?: string;
  support_team?: string;
  sla_tier?: string;
  availability_target?: number;
  response_time_target?: number;
  form_schema?: Record<string, any>;
  approval_flow?: Record<string, any>;
}): Promise<CatalogService> => {
  const response = await api.post<{ data: CatalogService }>('/v1/catalog/services', data);
  return response.data.data;
};

export const updateCatalogService = async (id: string, data: Partial<CatalogService>): Promise<CatalogService> => {
  const response = await api.put<{ data: CatalogService }>(`/v1/catalog/services/${id}`, data);
  return response.data.data;
};

export const deleteCatalogService = async (id: string): Promise<void> => {
  await api.delete(`/v1/catalog/services/${id}`);
};

export const searchCatalogServices = async (q: string): Promise<CatalogService[]> => {
  const response = await api.get<{ data: CatalogService[] }>('/v1/catalog/services/search', { params: { q } });
  return response.data.data;
};

// ==================== Service Requests ====================

export const getServiceRequests = async (params?: {
  serviceId?: string;
  status?: string;
  limit?: number;
  offset?: number;
}): Promise<{ data: CatalogRequest[]; total: number }> => {
  const response = await api.get<{ data: CatalogRequest[]; total: number }>('/v1/catalog/requests', { params });
  return { data: response.data.data, total: response.data.total };
};

export const getServiceRequest = async (id: string): Promise<CatalogRequest> => {
  const response = await api.get<{ data: CatalogRequest }>(`/v1/catalog/requests/${id}`);
  return response.data.data;
};

export const submitServiceRequest = async (serviceId: string, data: {
  title: string;
  description?: string;
  priority?: string;
  form_data?: Record<string, any>;
}): Promise<CatalogRequest> => {
  const response = await api.post<{ data: CatalogRequest }>(`/v1/catalog/services/${serviceId}/request`, data);
  return response.data.data;
};

export const updateServiceRequestStatus = async (id: string, action: 'approve' | 'reject' | 'fulfill' | 'cancel', data?: {
  reason?: string;
  assigned_to?: string;
}): Promise<CatalogRequest> => {
  const response = await api.patch<{ data: CatalogRequest }>(`/v1/catalog/requests/${id}/${action}`, data);
  return response.data.data;
};

// ==================== Statistics ====================

export const getCatalogStats = async (): Promise<CatalogStats> => {
  const response = await api.get<{ data: CatalogStats }>('/v1/catalog/stats');
  return response.data.data;
};
