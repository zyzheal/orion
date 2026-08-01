/**
 * Ticketing API Service
 * Ticket CRUD, workflow, dispatch, transfer, suspend, SLA, reports, and BI analytics
 */
import { api } from './client';

// ==================== Types ====================

export type TicketStatus = 'open' | 'assigned' | 'in-progress' | 'resolved' | 'closed';
export type TicketPriority = 'low' | 'medium' | 'high' | 'critical';
export type TicketCategory = 'infrastructure' | 'application' | 'security' | 'network' | 'database' | 'other';
export type TicketSource = 'manual' | 'alert' | 'incident' | 'api';
export type SuspendReason = 'vacation' | 'sick-leave' | 'training' | 'reassignment' | 'other';

export interface Ticket {
  id: string;
  title: string;
  description: string;
  priority: TicketPriority;
  status: TicketStatus;
  category: TicketCategory;
  source: TicketSource;
  assignee?: string;
  reporter: string;
  tenantId?: string;
  dueDate?: string;
  escalationLevel: number;
  tags?: Record<string, string>;
  metadata?: Record<string, unknown>;
  sourceAlertId?: string;
  sourceIncidentId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTicketPayload {
  title: string;
  description: string;
  category: TicketCategory;
  priority: TicketPriority;
  reporter: string;
  source?: TicketSource;
  tags?: Record<string, string>;
  metadata?: Record<string, unknown>;
}

export interface DispatchResult {
  id: string;
  ticketId: string;
  assignee: string;
  score: number;
  reason: string;
  dispatchedAt: string;
  dispatchType: 'auto' | 'manual' | 'rule';
  accepted: boolean;
}

export interface TicketRelation {
  relationId: string;
  relationType: string;
  relatedTicketId: string;
  relatedTicketTitle: string;
}

export interface TransferRecord {
  id: string;
  ticketId: string;
  fromEngineer: string;
  toEngineer: string;
  reason: string;
  transferredAt: string;
  holdTimeMs?: number;
}

export interface WorkflowHistoryEntry {
  id: string;
  ticketId: string;
  fromStatus: TicketStatus;
  toStatus: TicketStatus;
  performedBy: string;
  reason?: string;
  timestamp: string;
}

export interface AssignmentRule {
  id: string;
  name: string;
  condition: string;
  assignee: string;
  priority: number;
}

export interface SLATarget {
  priority: TicketPriority;
  responseTimeMs: number;
  resolutionTimeMs: number;
}

export interface EngineerProfile {
  id: string;
  name: string;
  skills: string[];
  categories: TicketCategory[];
  currentLoad: number;
  maxCapacity: number;
  available: boolean;
}

export interface DispatchRule {
  id: string;
  name: string;
  condition: string;
  engineerId?: string;
  priority: number;
}

export interface DispatchWeights {
  skillMatch: number;
  workload: number;
  availability: number;
  priority: number;
  categoryExpertise: number;
}

export interface SuspendRecord {
  id: string;
  engineerId: string;
  reason: SuspendReason;
  status: 'scheduled' | 'active' | 'ended' | 'cancelled';
  startTime: string;
  endTime: string;
  backupEngineerId?: string;
  autoReassignPending?: boolean;
  pauseSLAForPending?: boolean;
  notes?: string;
  createdBy: string;
  createdAt: string;
}

export interface SuspensionImpact {
  suspendId: string;
  engineerId: string;
  affectedTickets: number;
  ticketsReassigned: number;
  estimatedDelayHours: number;
}

// ==================== Ticket CRUD ====================

export const createTicket = (data: CreateTicketPayload) =>
  api.post<Ticket>('/api/tickets', data);

export const createTicketFromAlert = (data: {
  alertId: string;
  metric: string;
  severity: string;
  message: string;
  tags?: Record<string, string>;
  ruleName?: string;
}) => api.post<Ticket>('/api/tickets/from-alert', data);

export const createTicketFromIncident = (data: {
  incidentId: string;
  title: string;
  severity: string;
  affectedServices: string[];
  rootCause?: string;
}) => api.post<Ticket>('/api/tickets/from-incident', data);

export const getTicket = (id: string) =>
  api.get<Ticket>(`/api/tickets/${id}`);

export const getTickets = (params?: Record<string, unknown>) =>
  api.get<{ items: Ticket[]; total: number }>('/api/tickets', { params });

export const listTickets = getTickets;

export const updateTicket = (id: string, data: Partial<Ticket>) =>
  api.put<Ticket>(`/api/tickets/${id}`, data);

export const deleteTicket = (id: string) =>
  api.delete(`/api/tickets/${id}`);

// ==================== Workflow ====================

export const transitionStatus = (id: string, data: {
  toStatus: TicketStatus;
  performedBy: string;
  reason?: string;
}) => api.post(`/api/tickets/${id}/transition`, data);

export const assignTicket = (id: string, data: string | { assignee: string; assignedBy?: string; reason?: string }) =>
  api.post(`/api/tickets/${id}/assign`, typeof data === 'string' ? { assignee: data } : data);

export const escalateTicket = (id: string, data: { escalatedBy: string; reason?: string }) =>
  api.post(`/api/tickets/${id}/escalate`, data);

export const resolveTicket = (id: string, data?: string | { performedBy?: string; resolutionNote?: string }) =>
  api.post(`/api/tickets/${id}/resolve`, typeof data === 'string' ? { resolutionNote: data } : data);

export const closeTicket = (id: string, data?: string | { performedBy?: string; reason?: string }) =>
  api.post(`/api/tickets/${id}/close`, typeof data === 'string' ? { reason: data } : data);

export const getWorkflowHistory = (ticketId: string) =>
  api.get<{ items: WorkflowHistoryEntry[] }>(`/api/tickets/${ticketId}/history`);

// ==================== Assignment Rules ====================

export const addAssignmentRule = (rule: Omit<AssignmentRule, 'id'>) =>
  api.post<AssignmentRule>('/api/ticketing/rules', rule);

export const getAssignmentRules = () =>
  api.get<{ items: AssignmentRule[] }>('/api/ticketing/rules');

export const removeAssignmentRule = (ruleId: string) =>
  api.delete(`/api/ticketing/rules/${ruleId}`);

// ==================== Relations ====================

export const addRelation = (ticketId: string, data: {
  relatedTicketId: string;
  relationType: string;
}) => api.post(`/api/tickets/${ticketId}/relations`, data);

export const getRelations = (ticketId: string) =>
  api.get<{ items: TicketRelation[] }>(`/api/tickets/${ticketId}/relations`);

export const getTicketRelations = getRelations;

export const findRelatedTickets = (ticketId: string, params?: { maxResults?: number; minConfidence?: number }) =>
  api.get<{ items: TicketRelation[] }>(`/api/tickets/${ticketId}/related`, { params });

export const detectDuplicates = (ticketId: string, params?: { threshold?: number }) =>
  api.get<{ items: TicketRelation[] }>(`/api/tickets/${ticketId}/duplicates`, { params });

export const correlateRootCause = (ticketIds: string[]) =>
  api.post('/api/tickets/correlate', { ticketIds });

// ==================== Comments & Attachments ====================

export const getComments = (ticketId: string) =>
  api.get<{ items: unknown[] }>(`/api/tickets/${ticketId}/comments`);

export const getAttachments = (ticketId: string) =>
  api.get<{ items: unknown[] }>(`/api/tickets/${ticketId}/attachments`);

// ==================== SLA ====================

export const addSLATarget = (target: SLATarget) =>
  api.post('/api/ticketing/sla', target);

export const getTicketSLA = (ticketId: string) =>
  api.get(`/api/tickets/${ticketId}/sla`);

// ==================== Reports ====================

export const getSLACompliance = (params?: { periodStart?: string; periodEnd?: string }) =>
  api.get('/api/tickets/reports/sla', { params });

export const getResolutionStats = () =>
  api.get('/api/tickets/reports/resolution');

export const getBacklogAnalysis = () =>
  api.get('/api/tickets/reports/backlog');

export const getTrendReport = (params?: { days?: number; granularity?: string }) =>
  api.get('/api/tickets/reports/trends', { params });

export const getStatistics = () =>
  api.get('/api/tickets/reports/statistics');

// ==================== Dispatch ====================

export const registerEngineer = (profile: Omit<EngineerProfile, 'id'>) =>
  api.post<EngineerProfile>('/api/tickets/dispatch/engineers', profile);

export const listEngineers = () =>
  api.get<{ items: EngineerProfile[] }>('/api/tickets/dispatch/engineers');

export const getEngineer = (engineerId: string) =>
  api.get<EngineerProfile>(`/api/tickets/dispatch/engineers/${engineerId}`);

export const autoDispatch = (ticketId: string, options?: {
  assignedBy?: string;
  forceDispatch?: boolean;
}) => api.post<DispatchResult>(`/api/tickets/dispatch/auto/${ticketId}`, options);

export const manualDispatch = (ticketId: string, engineerId: string, reason?: string) =>
  api.post<DispatchResult>(`/api/tickets/dispatch/manual/${ticketId}`, { engineerId, reason });

export const getBestMatch = (ticketId: string) =>
  api.get<DispatchResult>(`/api/tickets/dispatch/best-match/${ticketId}`);

export const calculateDispatchScore = (ticketId: string, engineerId: string) =>
  api.post('/api/tickets/dispatch/score', { ticketId, engineerId });

export const getDispatchQueueStatus = () =>
  api.get('/api/tickets/dispatch/queue/status');

export const getDispatchQueue = () =>
  api.get<{ entries: unknown[] }>('/api/tickets/dispatch/queue/entries');

export const getSLAAlerts = (params?: { type?: string; limit?: number }) =>
  api.get('/api/tickets/dispatch/sla-alerts', { params });

export const addDispatchRule = (rule: Omit<DispatchRule, 'id'>) =>
  api.post<DispatchRule>('/api/tickets/dispatch/rules', rule);

export const getDispatchRules = () =>
  api.get<{ items: DispatchRule[] }>('/api/tickets/dispatch/rules');

export const getLoadBalanceReport = () =>
  api.get('/api/tickets/dispatch/load-balance/report');

export const getReassignmentSuggestions = () =>
  api.get('/api/tickets/dispatch/load-balance/suggestions');

export const getDispatchMetrics = (params?: { periodStart?: string; periodEnd?: string }) =>
  api.get('/api/tickets/dispatch/reports/metrics', { params });

export const getAssignmentSuccessMetrics = (params?: { periodStart?: string; periodEnd?: string }) =>
  api.get('/api/tickets/dispatch/reports/assignment-success', { params });

export const getTimeToAssignmentStats = (params?: { periodStart?: string; periodEnd?: string }) =>
  api.get('/api/tickets/dispatch/reports/time-to-assignment', { params });

export const getEngineerPerformance = (engineerId: string) =>
  api.get(`/api/tickets/dispatch/reports/performance/${engineerId}`);

export const getAllEngineerPerformances = () =>
  api.get('/api/tickets/dispatch/reports/performance');

export const updateDispatchWeights = (weights: Partial<DispatchWeights>) =>
  api.put('/api/tickets/dispatch/weights', weights);

export const getDispatchWeights = () =>
  api.get<DispatchWeights>('/api/tickets/dispatch/weights');

// ==================== Transfer ====================

export const transferTicket = (ticketId: string, data: {
  toEngineer: string;
  initiatedBy: string;
  reason: string;
}) => api.post(`/api/tickets/transfer/${ticketId}`, data);

export const getTransferHistory = (ticketId: string) =>
  api.get<{ items: TransferRecord[] }>(`/api/tickets/transfer/${ticketId}/history`);

export const getTransferStats = (params?: { periodStart?: string; periodEnd?: string }) =>
  api.get('/api/tickets/transfer/stats', { params });

// ==================== Suspend ====================

export const createSuspend = (data: {
  engineerId: string;
  reason: SuspendReason;
  startTime: string;
  endTime: string;
  backupEngineerId?: string;
  autoReassignPending?: boolean;
  pauseSLAForPending?: boolean;
  notes?: string;
  createdBy: string;
}) => api.post<SuspendRecord>('/api/tickets/suspend', data);

export const activateSuspend = (suspendId: string) =>
  api.post<SuspendRecord>(`/api/tickets/suspend/${suspendId}/activate`);

export const endSuspend = (suspendId: string) =>
  api.post<SuspendRecord>(`/api/tickets/suspend/${suspendId}/end`);

export const cancelSuspend = (suspendId: string) =>
  api.post<SuspendRecord>(`/api/tickets/suspend/${suspendId}/cancel`);

export const listSuspensions = (params?: { status?: string }) =>
  api.get<{ items: SuspendRecord[] }>('/api/tickets/suspend', { params });

export const getSuspend = (suspendId: string) =>
  api.get<SuspendRecord>(`/api/tickets/suspend/${suspendId}`);

export const getEngineerSuspensions = (engineerId: string) =>
  api.get<{ items: SuspendRecord[] }>(`/api/tickets/suspend/engineer/${engineerId}`);

export const getEngineerSuspendImpact = (engineerId: string) =>
  api.get<SuspensionImpact>(`/api/tickets/suspend/engineer/${engineerId}/impact`);

// ==================== BI Analytics ====================

export const getExecutiveDashboard = (params?: { periodStart?: string; periodEnd?: string }) =>
  api.get('/api/tickets/bi/dashboard/executive', { params });

export const getManagerDashboard = (params?: { periodStart?: string; periodEnd?: string }) =>
  api.get('/api/tickets/bi/dashboard/manager', { params });

export const getEngineerDashboard = (engineerId: string, params?: { periodStart?: string; periodEnd?: string }) =>
  api.get(`/api/tickets/bi/dashboard/engineer/${engineerId}`, { params });

export const getEngineerEfficiency = (engineerId: string, params?: {
  granularity?: string;
  start?: string;
  end?: string;
}) => api.get(`/api/tickets/bi/efficiency/${engineerId}`, { params });

export const getEfficiencyScore = (engineerId: string, params?: {
  start?: string;
  end?: string;
}) => api.get(`/api/tickets/bi/score/${engineerId}`, { params });

export const comparePeriods = (params: {
  currentStart: string;
  currentEnd: string;
  previousStart: string;
  previousEnd: string;
}) => api.get('/api/tickets/bi/compare', { params });

export const exportBIData = (data: {
  dataset: 'tickets' | 'sla' | 'dispatch' | 'efficiency';
  granularity?: string;
  periodStart?: string;
  periodEnd?: string;
}) => api.post('/api/tickets/bi/export', data);

export const getTimeTrend = (params?: {
  metric?: 'volume' | 'resolution' | 'sla' | 'load';
  start?: string;
  end?: string;
  granularity?: string;
}) => api.get('/api/tickets/bi/trend', { params });

// ==================== Service Control ====================

export const startTicketingService = () =>
  api.post('/api/ticketing/start');

export const stopTicketingService = () =>
  api.post('/api/ticketing/stop');

export const getTicketingHealth = () =>
  api.get('/api/ticketing/health');
