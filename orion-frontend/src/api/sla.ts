/**
 * SLA Management API Service
 *
 * Aligned with backend /api/v1/sla/* routes (sla-routes.ts)
 * Covers: SLA definitions CRUD, SLA tracking, breach events, statistics
 */
import { api } from './client';

export interface SLADefinition {
  id: string;
  tenant_id: string;
  name: string;
  description?: string;
  type: 'response' | 'resolution' | 'availability';
  target_value: number;
  target_unit: 'minutes' | 'hours' | 'percent';
  business_hours_only: boolean;
  priority?: 'critical' | 'high' | 'medium' | 'low';
  category?: string;
  escalation_rules?: Record<string, any>;
  metadata?: Record<string, any>;
  status: 'active' | 'inactive' | 'archived';
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface SLATracking {
  id: string;
  tenant_id: string;
  sla_definition_id: string;
  entity_type: 'incident' | 'request' | 'change';
  entity_id: string;
  status: 'tracking' | 'met' | 'breached' | 'paused';
  start_time: string;
  target_time: string;
  actual_time?: string;
  breach_time?: string;
  pause_duration?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface SLABreachEvent {
  id: string;
  tenant_id: string;
  sla_tracking_id: string;
  event_type: 'warning' | 'breach' | 'escalation';
  event_time: string;
  details?: Record<string, any>;
  notified_users?: string[];
  created_at: string;
}

export interface SLAStats {
  totalDefinitions: number;
  activeTrackings: number;
  breachedCount: number;
  complianceRate: number;
  byStatus: Record<string, number>;
  byType: Record<string, number>;
}

// ==================== SLA Definitions ====================

export const getSLADefinitions = async (params?: {
  type?: string;
  status?: string;
  limit?: number;
  offset?: number;
}): Promise<{ data: SLADefinition[]; total: number }> => {
  const response = await api.get('/v1/sla/definitions', { params });
  return { data: response.data.data, total: response.data.total };
};

export const getSLADefinition = async (id: string): Promise<SLADefinition> => {
  const response = await api.get(`/v1/sla/definitions/${id}`);
  return response.data.data;
};

export const createSLADefinition = async (data: {
  name: string;
  description?: string;
  type: string;
  target_value: number;
  target_unit: string;
  business_hours_only?: boolean;
  priority?: string;
  category?: string;
  escalation_rules?: Record<string, any>;
}): Promise<SLADefinition> => {
  const response = await api.post('/v1/sla/definitions', data);
  return response.data.data;
};

export const updateSLADefinition = async (id: string, data: Partial<SLADefinition>): Promise<SLADefinition> => {
  const response = await api.put(`/v1/sla/definitions/${id}`, data);
  return response.data.data;
};

export const deleteSLADefinition = async (id: string): Promise<void> => {
  await api.delete(`/v1/sla/definitions/${id}`);
};

// ==================== SLA Tracking ====================

export const getSLATrackings = async (params?: {
  status?: string;
  entityType?: string;
  entityId?: string;
  limit?: number;
  offset?: number;
}): Promise<{ data: SLATracking[]; total: number }> => {
  const response = await api.get('/v1/sla/tracking', { params });
  return { data: response.data.data, total: response.data.total };
};

export const getSLATracking = async (id: string): Promise<SLATracking> => {
  const response = await api.get(`/v1/sla/tracking/${id}`);
  return response.data.data;
};

export const createSLATracking = async (data: {
  sla_definition_id: string;
  entity_type: string;
  entity_id: string;
  target_time: string;
  notes?: string;
}): Promise<SLATracking> => {
  const response = await api.post('/v1/sla/tracking', data);
  return response.data.data;
};

export const updateSLATrackingStatus = async (id: string, status: string, notes?: string): Promise<SLATracking> => {
  const response = await api.patch(`/v1/sla/tracking/${id}`, { status, notes });
  return response.data.data;
};

export const markSLABreach = async (id: string): Promise<SLATracking> => {
  const response = await api.post(`/v1/sla/tracking/${id}/breach`);
  return response.data.data;
};

// ==================== Breach Events ====================

export const getSLABreaches = async (params?: {
  trackingId?: string;
  limit?: number;
  offset?: number;
}): Promise<{ data: SLABreachEvent[]; total: number }> => {
  const response = await api.get('/v1/sla/breaches', { params });
  return { data: response.data.data, total: response.data.total };
};

// ==================== Statistics ====================

export const getSLAStats = async (): Promise<SLAStats> => {
  const response = await api.get('/v1/sla/stats');
  return response.data.data;
};
