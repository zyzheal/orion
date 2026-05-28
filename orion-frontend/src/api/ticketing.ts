/**
 * Ticketing API Service
 * Ticket CRUD, dispatch, and workflow operations
 */
import { api } from './client';

export interface Ticket {
  id: string;
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'open' | 'assigned' | 'in_progress' | 'resolved' | 'closed';
  type: string;
  source: string;
  assignee?: string;
  reporter: string;
  tenantId: string;
  dueDate?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTicketPayload {
  title: string;
  description: string;
  priority: string;
  type?: string;
  source?: string;
  reporter?: string;
}

export interface DispatchResult {
  ticketId: string;
  assignee: string;
  score: number;
  reason: string;
}

// Ticket CRUD
export const createTicket = (data: CreateTicketPayload) =>
  api.post<Ticket>('/v1/tickets', data);

export const getTicket = (id: string) =>
  api.get<Ticket>(`/v1/tickets/${id}`);

export const getTickets = (params?: Record<string, unknown>) =>
  api.get<{ items: Ticket[]; total: number }>('/v1/tickets', { params });

export const listTickets = getTickets;

export const updateTicket = (id: string, data: Partial<Ticket>) =>
  api.put<Ticket>(`/v1/tickets/${id}`, data);

export const deleteTicket = (id: string) =>
  api.delete(`/v1/tickets/${id}`);

// Ticket workflow
export const assignTicket = (id: string, data: string | { assignee: string; assignedBy?: string; reason?: string }) =>
  api.post<Ticket>(`/v1/tickets/${id}/assign`, typeof data === 'string' ? { assigneeId: data } : data);

export const resolveTicket = (id: string, data?: string | { performedBy?: string; resolutionNote?: string }) =>
  api.post<Ticket>(`/v1/tickets/${id}/resolve`, typeof data === 'string' ? { resolution: data } : data);

export const closeTicket = (id: string, data?: string | { performedBy?: string; reason?: string }) =>
  api.post<Ticket>(`/v1/tickets/${id}/close`, typeof data === 'string' ? { reason: data } : data);

// Comments & Attachments
export const getComments = (ticketId: string) =>
  api.get<{ items: unknown[] }>(`/v1/tickets/${ticketId}/comments`);

export const getAttachments = (ticketId: string) =>
  api.get<{ items: unknown[] }>(`/v1/tickets/${ticketId}/attachments`);

// Relations & History
export interface TicketRelation {
  relationId: string;
  relationType: string;
  relatedTicketId: string;
  relatedTicketTitle: string;
}

export interface TransferRecord {
  id: string;
  from: string;
  to: string;
  fromEngineer: string;
  toEngineer: string;
  timestamp: string;
  reason?: string;
}

export const getTicketRelations = (ticketId: string) =>
  api.get<{ items: TicketRelation[] }>(`/v1/tickets/${ticketId}/relations`);

export const getTransferHistory = (ticketId: string) =>
  api.get<{ items: TransferRecord[] }>(`/v1/tickets/${ticketId}/transfers`);

// Dispatch
export const autoDispatch = (ticketId: string) =>
  api.post<DispatchResult>(`/v1/tickets/dispatch/auto/${ticketId}`);

export const manualDispatch = (ticketId: string, engineerId: string) =>
  api.post<DispatchResult>(`/v1/tickets/dispatch/manual/${ticketId}`, { engineerId });

export const getBestMatch = (ticketId: string) =>
  api.get<DispatchResult>(`/v1/tickets/dispatch/best-match/${ticketId}`);

export const getDispatchQueue = () =>
  api.get<{ entries: unknown[] }>('/v1/tickets/dispatch/queue/entries');
