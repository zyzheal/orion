/**
 * Incident Management API Service
 *
 * Aligned with backend /api/incidents/* routes (incident-routes.ts)
 * Covers: incident CRUD, lifecycle, timeline, postmortem, escalation, SLA, statistics
 */
import { api } from './client';

export interface Incident {
  id: string;
  tenant_id: string;
  title: string;
  description?: string;
  type: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  status: 'open' | 'acknowledged' | 'investigating' | 'on_hold' | 'resolved' | 'closed';
  priority?: 'p1' | 'p2' | 'p3' | 'p4';
  impact?: string;
  urgency?: string;
  assigned_to?: string;
  commander_id?: string;
  detected_by?: string;
  affected_services?: string[];
  related_problem_id?: string;
  tags?: string[];
  resolved_by?: string;
  closed_at?: string;
  closed_by?: string;
  escalation_level?: number;
  sla_breach?: boolean;
  created_at: string;
  updated_at: string;
}

export interface IncidentStats {
  total: number;
  byStatus: Record<string, number>;
  bySeverity: Record<string, number>;
  byPriority: Record<string, number>;
  mttr: number;
  trend7d: Array<{ date: string; count: number }>;
}

export interface TimelineEvent {
  id: string;
  incident_id: string;
  event_type: string;
  description: string;
  created_by: string;
  created_at: string;
  metadata?: Record<string, unknown>;
}

export interface ActionItem {
  id?: string;
  title: string;
  assignee?: string;
  status?: 'open' | 'in_progress' | 'resolved';
  due_date?: string;
  description?: string;
}

export interface Postmortem {
  id: string;
  incident_id: string;
  title: string;
  summary: string;
  root_cause: string;
  impact_description?: string;
  timeline_summary?: string;
  action_items?: ActionItem[];
  lessons_learned?: string;
  status: 'draft' | 'published' | 'archived';
  created_by: string;
  created_at: string;
  updated_at: string;
  published_at?: string;
}

export interface EscalationRecord {
  id: string;
  incident_id: string;
  from_level: number;
  to_level: number;
  reason: string;
  escalated_by: string;
  escalated_at: string;
}

// ==================== Incident CRUD ====================

export const getIncidents = async (params?: {
  status?: string;
  severity?: string;
  priority?: string;
  limit?: number;
  offset?: number;
}): Promise<{ incidents: Incident[]; total: number }> => {
  const response = await api.get<{ data: Incident[]; meta?: { total: number } }>('/api/incidents', { params });
  return { incidents: response.data.data, total: response.data.meta?.total ?? response.data.data.length };
};

export const getIncident = async (id: string): Promise<Incident> => {
  const response = await api.get<{ data: Incident }>(`/api/incidents/${id}`);
  return response.data.data;
};

export const createIncident = async (data: {
  title: string;
  type: string;
  severity: string;
  description?: string;
  impact?: string;
  urgency?: string;
  assigned_to?: string;
  detected_by?: string;
  affected_services?: string[];
  tags?: string[];
}): Promise<Incident> => {
  const response = await api.post<{ data: Incident }>('/api/incidents', data);
  return response.data.data;
};

export const updateIncident = async (id: string, data: Partial<Incident>): Promise<Incident> => {
  const response = await api.put<{ data: Incident }>(`/api/incidents/${id}`, data);
  return response.data.data;
};

export const deleteIncident = async (id: string): Promise<void> => {
  await api.delete(`/api/incidents/${id}`);
};

// ==================== Status & Assignment ====================

export const updateIncidentStatus = async (id: string, status: string, note?: string): Promise<Incident> => {
  const response = await api.patch<{ data: Incident }>(`/api/incidents/${id}/status`, { status, note });
  return response.data.data;
};

export const assignIncident = async (id: string, commanderId: string): Promise<Incident> => {
  const response = await api.patch<{ data: Incident }>(`/api/incidents/${id}/assign`, { commander_id: commanderId });
  return response.data.data;
};

// ==================== Escalation ====================

export const escalateIncident = async (id: string, data: {
  to_level: number;
  reason: string;
}): Promise<EscalationRecord> => {
  const response = await api.post<{ data: EscalationRecord }>(`/api/incidents/${id}/escalate`, data);
  return response.data.data;
};

export const getEscalations = async (id: string): Promise<EscalationRecord[]> => {
  const response = await api.get<{ data: EscalationRecord[] }>(`/api/incidents/${id}/escalations`);
  return response.data.data;
};

// ==================== Timeline ====================

export const getIncidentTimeline = async (id: string): Promise<TimelineEvent[]> => {
  const response = await api.get<{ data: TimelineEvent[] }>(`/api/incidents/${id}/timeline`);
  return response.data.data;
};

export const addTimelineEvent = async (id: string, data: {
  event_type: string;
  description: string;
  metadata?: Record<string, unknown>;
}): Promise<TimelineEvent> => {
  const response = await api.post<{ data: TimelineEvent }>(`/api/incidents/${id}/timeline`, data);
  return response.data.data;
};

// ==================== Postmortem ====================

export const getPostmortem = async (id: string): Promise<Postmortem> => {
  const response = await api.get<{ data: Postmortem }>(`/api/incidents/${id}/postmortem`);
  return response.data.data;
};

export const createPostmortem = async (id: string, data: {
  title: string;
  summary: string;
  root_cause: string;
  impact_description?: string;
  timeline_summary?: string;
  action_items?: ActionItem[];
  lessons_learned?: string;
}): Promise<Postmortem> => {
  const response = await api.post<{ data: Postmortem }>(`/api/incidents/${id}/postmortem`, data);
  return response.data.data;
};

export const publishPostmortem = async (id: string): Promise<Postmortem> => {
  const response = await api.patch<{ data: Postmortem }>(`/api/incidents/${id}/postmortem/publish`);
  return response.data.data;
};

// ==================== Statistics ====================

export const getIncidentStats = async (): Promise<IncidentStats> => {
  const response = await api.get<{ data: IncidentStats }>('/api/incidents/stats');
  return response.data.data;
};
