/**
 * Change Management API Service
 *
 * Aligned with backend /api/changes/* routes (change-routes.ts)
 * Covers: change requests CRUD, RFC, CAB meetings, timeline, statistics
 */
import { api } from './client';

export interface ChangeRequest {
  id: string;
  tenant_id: string;
  title: string;
  description?: string;
  type: 'standard' | 'normal' | 'emergency';
  category?: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  risk_level: 'high' | 'medium' | 'low';
  status: 'draft' | 'submitted' | 'approved' | 'rejected' | 'in_progress' | 'completed' | 'cancelled' | 'closed';
  impact_description?: string;
  rollback_plan?: string;
  implementation_plan?: string;
  scheduled_start?: string;
  scheduled_end?: string;
  actual_start?: string;
  actual_end?: string;
  requester_id?: string;
  assigned_to?: string;
  approved_by?: string;
  approved_at?: string;
  rejected_by?: string;
  rejected_at?: string;
  rejection_reason?: string;
  related_incidents?: string[];
  related_problems?: string[];
  affected_services?: string[];
  metadata?: Record<string, unknown>;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface CABMeeting {
  id: string;
  tenant_id: string;
  title: string;
  description?: string;
  scheduled_at: string;
  location?: string;
  attendees?: string[];
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  minutes?: string;
  decisions?: Array<{
    changeRequestId: string;
    decision: 'approved' | 'rejected' | 'deferred';
    notes?: string;
  }>;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface ChangeTimelineEvent {
  id: string;
  tenant_id: string;
  change_request_id: string;
  event_type: string;
  description: string;
  created_by?: string;
  metadata?: Record<string, unknown>;
  created_at: string;
}

export interface RFC {
  id: string;
  tenant_id: string;
  change_request_id: string;
  rfc_number: string;
  justification?: string;
  risk_assessment?: string;
  test_plan?: string;
  communication_plan?: string;
  backout_plan?: string;
  cab_meeting_id?: string;
  status: 'draft' | 'pending_review' | 'approved' | 'rejected';
  reviewed_by?: string;
  reviewed_at?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface ChangeStats {
  totalRequests: number;
  byStatus: Record<string, number>;
  byType: Record<string, number>;
  byPriority: Record<string, number>;
}

// ==================== Change Requests ====================

export const getChangeRequests = async (params?: {
  status?: string;
  type?: string;
  priority?: string;
  limit?: number;
  offset?: number;
}): Promise<{ data: ChangeRequest[]; total: number }> => {
  const response = await api.get<{ data: ChangeRequest[]; total: number }>('/api/changes/requests', { params });
  return { data: response.data.data, total: response.data.total };
};

export const getChangeRequest = async (id: string): Promise<ChangeRequest> => {
  const response = await api.get<{ data: ChangeRequest }>(`/api/changes/requests/${id}`);
  return response.data.data;
};

export const createChangeRequest = async (data: {
  title: string;
  description?: string;
  type?: string;
  category?: string;
  priority?: string;
  risk_level?: string;
  impact_description?: string;
  rollback_plan?: string;
  implementation_plan?: string;
  scheduled_start?: string;
  scheduled_end?: string;
  assigned_to?: string;
  affected_services?: string[];
}): Promise<ChangeRequest> => {
  const response = await api.post<{ data: ChangeRequest }>('/api/changes/requests', data);
  return response.data.data;
};

export const updateChangeRequest = async (id: string, data: Partial<ChangeRequest>): Promise<ChangeRequest> => {
  const response = await api.put<{ data: ChangeRequest }>(`/api/changes/requests/${id}`, data);
  return response.data.data;
};

export const deleteChangeRequest = async (id: string): Promise<void> => {
  await api.delete(`/api/changes/requests/${id}`);
};

export const updateChangeRequestStatus = async (id: string, status: string, reason?: string): Promise<ChangeRequest> => {
  const response = await api.patch<{ data: ChangeRequest }>(`/api/changes/requests/${id}/status`, { status, reason });
  return response.data.data;
};

// ==================== Timeline ====================

export const getChangeTimeline = async (changeRequestId: string): Promise<ChangeTimelineEvent[]> => {
  const response = await api.get<{ data: ChangeTimelineEvent[] }>(`/api/changes/requests/${changeRequestId}/timeline`);
  return response.data.data;
};

export const addChangeTimelineEvent = async (changeRequestId: string, data: {
  event_type: string;
  description: string;
  metadata?: Record<string, unknown>;
}): Promise<ChangeTimelineEvent> => {
  const response = await api.post<{ data: ChangeTimelineEvent }>(`/api/changes/requests/${changeRequestId}/timeline`, data);
  return response.data.data;
};

// ==================== RFC ====================

export const getRFCs = async (params?: {
  changeRequestId?: string;
  limit?: number;
  offset?: number;
}): Promise<{ data: RFC[]; total: number }> => {
  const response = await api.get<{ data: RFC[]; total: number }>('/api/changes/rfcs', { params });
  return { data: response.data.data, total: response.data.total };
};

export const getRFC = async (id: string): Promise<RFC> => {
  const response = await api.get<{ data: RFC }>(`/api/changes/rfcs/${id}`);
  return response.data.data;
};

export const createRFC = async (data: {
  change_request_id: string;
  justification?: string;
  risk_assessment?: string;
  test_plan?: string;
  communication_plan?: string;
  backout_plan?: string;
}): Promise<RFC> => {
  const response = await api.post<{ data: RFC }>('/api/changes/rfcs', data);
  return response.data.data;
};

export const updateRFC = async (id: string, data: Partial<RFC>): Promise<RFC> => {
  const response = await api.put<{ data: RFC }>(`/api/changes/rfcs/${id}`, data);
  return response.data.data;
};

// ==================== CAB Meetings ====================

export const getCABMeetings = async (params?: {
  status?: string;
  limit?: number;
  offset?: number;
}): Promise<{ data: CABMeeting[]; total: number }> => {
  const response = await api.get<{ data: CABMeeting[]; total: number }>('/api/changes/cab', { params });
  return { data: response.data.data, total: response.data.total };
};

export const getCABMeeting = async (id: string): Promise<CABMeeting> => {
  const response = await api.get<{ data: CABMeeting }>(`/api/changes/cab/${id}`);
  return response.data.data;
};

export const createCABMeeting = async (data: {
  title: string;
  description?: string;
  scheduled_at: string;
  location?: string;
  attendees?: string[];
}): Promise<CABMeeting> => {
  const response = await api.post<{ data: CABMeeting }>('/api/changes/cab', data);
  return response.data.data;
};

export const updateCABMeeting = async (id: string, data: Partial<CABMeeting>): Promise<CABMeeting> => {
  const response = await api.put<{ data: CABMeeting }>(`/api/changes/cab/${id}`, data);
  return response.data.data;
};

export const addCABDecision = async (meetingId: string, decision: {
  changeRequestId: string;
  decision: 'approved' | 'rejected' | 'deferred';
  notes?: string;
}): Promise<CABMeeting> => {
  const response = await api.post<{ data: CABMeeting }>(`/api/changes/cab/${meetingId}/decisions`, decision);
  return response.data.data;
};

// ==================== Statistics ====================

export const getChangeStats = async (): Promise<ChangeStats> => {
  const response = await api.get<{ data: ChangeStats }>('/api/changes/stats');
  return response.data.data;
};
