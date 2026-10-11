/**
 * Triage API Service
 *
 * 参见 triage-api-contract-design-2026-10-11.md §1
 */
import { api } from './client';

// ==================== Types ====================

export type Severity = 'critical' | 'warning' | 'info';
export type TriageStatus = 'open' | 'acknowledged' | 'assigned' | 'in_progress' | 'resolved' | 'cancelled';
export type AssignedScope = 'unassigned' | 'assigned' | 'mine' | 'team';
export type TimeRange = '1h' | '24h' | '7d' | '30d';

export interface TriageItem {
  id: string;
  tenant_id: string;
  type: 'alert' | 'ticket' | 'oncall';
  source_type: string;
  source_id: string;
  title: string;
  summary?: string;
  severity: Severity;
  status: TriageStatus;
  assigned_to?: string;
  assigned_scope: AssignedScope;
  created_at: string;
  updated_at: string;
  acknowledged_at?: string;
  resolved_at?: string;
  labels?: Record<string, string>;
}

export interface OnCallInfo {
  user_id: string;
  display_name: string;
  is_on_duty: boolean;
  schedule_id?: string;
  rotation_id?: string;
  shift_start?: string;
  shift_end?: string;
  shift_role?: string;
  handoff_pending?: boolean;
}

export interface MyOverview {
  me: OnCallInfo;
  open_by_severity: Record<Severity, number>;
  open_by_status: Record<TriageStatus, number>;
  assigned_to_me: number;
  team_open: number;
  recent_activity: TriageItem[];
  generated_at: string;
}

export interface TriageFilter {
  severity?: Severity;
  source_type?: string;
  status?: TriageStatus;
  assigned_scope?: AssignedScope;
  time_range?: TimeRange;
  search?: string;
}

export interface TriagePage {
  data: TriageItem[];
  page: number;
  page_size: number;
  total: number;
  has_more: boolean;
}

export interface AcknowledgeRequest {
  item_id: string;
  type: 'alert' | 'ticket';
}

export interface AssignRequest {
  item_id: string;
  type: 'alert' | 'ticket';
  to_user_id: string;
  to_role?: string;
  reason?: string;
}

export interface HandoffRequest {
  schedule_id: string;
  rotation_id: string;
  from_user_id: string;
  to_user_id: string;
  reason?: string;
}

export interface HandoffResponse {
  handoff_id: string;
  from_user_id: string;
  to_user_id: string;
  pending_items: number;
  created_at: string;
}

// ==================== API Functions ====================

export async function getOverview(includeActivity = true, limitActivity = 20): Promise<MyOverview> {
  const res = await api.get<{ data: MyOverview }>('/triage/overview', {
    params: { include_activity: includeActivity, limit_activity: limitActivity },
  });
  return res.data.data;
}

export async function listAlerts(filter: TriageFilter = {}, page = 1, pageSize = 50): Promise<TriagePage> {
  const res = await api.get<{ data: TriagePage }>('/triage/alerts', {
    params: { ...filter, page, page_size: pageSize },
  });
  return res.data.data;
}

export async function listTickets(filter: TriageFilter = {}, page = 1, pageSize = 50): Promise<TriagePage> {
  const res = await api.get<{ data: TriagePage }>('/triage/tickets', {
    params: { ...filter, page, page_size: pageSize },
  });
  return res.data.data;
}

export async function acknowledge(req: AcknowledgeRequest): Promise<{ item_id: string; status: string }> {
  const res = await api.post<{ data: any }>('/triage/acknowledge', req);
  return res.data.data;
}

export async function assign(req: AssignRequest): Promise<{ item_id: string; assigned_to: string }> {
  const res = await api.post<{ data: any }>('/triage/assign', req);
  return res.data.data;
}

export async function handoff(req: HandoffRequest): Promise<HandoffResponse> {
  const res = await api.post<{ data: HandoffResponse }>('/triage/handoff', req);
  return res.data.data;
}

// ==================== G1-G3 APIs ====================

export async function grantUserRole(req: {
  user_id: string;
  role: string;
  expires_at?: string;
  reason?: string;
}): Promise<any> {
  const res = await api.post<{ data: any }>('/user-roles', req);
  return res.data.data;
}

export async function resolveRecipient(spec: {
  kind: 'user' | 'role' | 'team' | 'oncall-duty' | 'escalation' | 'broadcast';
  tenant_id: string;
  params: Record<string, any>;
}): Promise<{ data: any }> {
  const res = await api.post<{ data: any }>('/recipient-resolve', { spec });
  return res.data;
}
