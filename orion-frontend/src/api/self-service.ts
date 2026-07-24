/**
 * Self-Service API Service
 *
 * Aligned with backend /api/v1/self-service/* routes
 * Covers: service catalog (read-only), ticket CRUD for end users
 */
import { api } from './client';

// ==================== Types ====================

export interface ServiceCategory {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  serviceCount?: number;
}

export interface ServiceItem {
  id: string;
  category_id: string;
  name: string;
  description: string;
  status: 'active' | 'inactive';
  form_schema?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  created_at: string;
}

export interface SelfServiceTicket {
  id: string;
  tenant_id: string;
  service_id: string;
  service_name?: string;
  category_name?: string;
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'pending' | 'approved' | 'in_progress' | 'fulfilled' | 'rejected' | 'cancelled';
  form_data?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  cancelled_at?: string;
}

export interface CreateSelfServiceTicketPayload {
  service_id: string;
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  form_data?: Record<string, unknown>;
}

// ==================== Catalog ====================

export const getServiceCategories = async (): Promise<{ data: ServiceCategory[] }> => {
  const response = await api.get<{ data: ServiceCategory[] }>('/api/v1/self-service/catalog/categories');
  return { data: response.data.data };
};

export const getCatalogServices = async (params?: {
  category_id?: string;
  status?: string;
  limit?: number;
  offset?: number;
}): Promise<{ data: ServiceItem[]; total: number }> => {
  const response = await api.get<{ data: ServiceItem[]; total: number }>('/api/v1/self-service/catalog/services', { params });
  return { data: response.data.data, total: response.data.total };
};

// ==================== Tickets ====================

export const getMyTickets = async (params?: {
  status?: string;
  priority?: string;
  limit?: number;
  offset?: number;
}): Promise<{ data: SelfServiceTicket[]; total: number }> => {
  const response = await api.get<{ data: SelfServiceTicket[]; total: number }>('/api/v1/self-service/tickets', { params });
  return { data: response.data.data, total: response.data.total };
};

export const getMyTicket = async (id: string): Promise<SelfServiceTicket> => {
  const response = await api.get<{ data: SelfServiceTicket }>(`/api/v1/self-service/tickets/${id}`);
  return response.data.data;
};

export const createMyTicket = async (payload: CreateSelfServiceTicketPayload): Promise<SelfServiceTicket> => {
  const response = await api.post<{ data: SelfServiceTicket }>('/api/v1/self-service/tickets', payload);
  return response.data.data;
};

export const cancelMyTicket = async (id: string): Promise<void> => {
  await api.delete(`/api/v1/self-service/tickets/${id}`);
};
