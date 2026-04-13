/**
 * Ticketing API Service
 * - CRUD operations for tickets
 * - Workflow actions (assign, escalate, resolve, close, transition)
 * - Dispatch and queue management
 * - Reports and statistics
 * - Suspend management
 * - Transfer history
 */
import { api } from './client';

export interface TicketListParams {
  status?: string;
  priority?: string;
  category?: string;
  assignee?: string;
  reporter?: string;
  page?: number;
  pageSize?: number;
  search?: string;
}

// ---- CRUD ----

export function getTickets(params?: TicketListParams) {
  return api.get('/v1/ticketing/tickets', { params });
}

export function getTicket(id: string) {
  return api.get(`/v1/ticketing/tickets/${id}`);
}

export function createTicket(data: Record<string, unknown>) {
  return api.post('/v1/ticketing/tickets', data);
}

export function updateTicket(id: string, data: Record<string, unknown>) {
  return api.patch(`/v1/ticketing/tickets/${id}`, data);
}

// ---- Workflow ----

export function transitionTicket(
  id: string,
  data: { toStatus: string; performedBy: string; reason?: string }
) {
  return api.post(`/v1/ticketing/tickets/${id}/transition`, data);
}

export function assignTicket(
  id: string,
  data: { assignee: string; assignedBy: string; reason?: string }
) {
  return api.post(`/v1/ticketing/tickets/${id}/assign`, data);
}

export function escalateTicket(
  id: string,
  data: { escalatedBy: string; reason?: string }
) {
  return api.post(`/v1/ticketing/tickets/${id}/escalate`, data);
}

export function resolveTicket(
  id: string,
  data: { performedBy: string; resolutionNote?: string }
) {
  return api.post(`/v1/ticketing/tickets/${id}/resolve`, data);
}

export function closeTicket(
  id: string,
  data: { performedBy: string; reason?: string }
) {
  return api.post(`/v1/ticketing/tickets/${id}/close`, data);
}

// ---- Relations ----

export function getTicketRelations(id: string) {
  return api.get(`/v1/ticketing/tickets/${id}/relations`);
}

export function getTicketHistory(id: string) {
  return api.get(`/v1/ticketing/tickets/${id}/history`);
}

// ---- Dispatch ----

export function getQueueStatus() {
  return api.get('/v1/ticketing/dispatch/queue');
}

export function getSLAAlerts(params?: { type?: string; limit?: number }) {
  return api.get('/v1/ticketing/dispatch/queue/alerts', { params });
}

export function autoDispatch(ticketId: string) {
  return api.post(`/v1/ticketing/dispatch/auto/${ticketId}`);
}

// ---- Transfer ----

export function transferTicket(
  id: string,
  data: { toEngineer: string; reason: string; initiatedBy: string }
) {
  return api.post(`/v1/ticketing/transfer/${id}`, data);
}

export function getTransferHistory(id: string) {
  return api.get(`/v1/ticketing/transfer/${id}/history`);
}

// ---- Suspend ----

export function createSuspend(data: {
  engineerId: string;
  reason: string;
  startTime: string;
  endTime: string;
  backupEngineerId?: string;
  notes?: string;
  createdBy: string;
}) {
  return api.post('/v1/ticketing/suspend', data);
}

export function getSuspends(params?: { status?: string }) {
  return api.get('/v1/ticketing/suspend', { params });
}

export function activateSuspend(id: string) {
  return api.post(`/v1/ticketing/suspend/${id}/activate`);
}

export function endSuspend(id: string) {
  return api.post(`/v1/ticketing/suspend/${id}/end`);
}

// ---- Reports & Statistics ----

export function getStatistics() {
  return api.get('/v1/ticketing/statistics');
}

export function getSLACompliance(params?: { periodStart?: string; periodEnd?: string }) {
  return api.get('/v1/ticketing/reports/sla', { params });
}

export function getBacklogAnalysis() {
  return api.get('/v1/ticketing/reports/backlog');
}

export function getTrendReport(params?: { days?: number; granularity?: string }) {
  return api.get('/v1/ticketing/reports/trend', { params });
}
