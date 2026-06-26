/**
 * Sprint Board API
 * Phase 2 - RDM sprint management and backlog
 */
import apiClient from './client';

export interface Sprint {
  id: string;
  tenantId: string;
  name: string;
  goal: string | null;
  startDate: string;
  endDate: string;
  status: 'planning' | 'active' | 'completed' | 'cancelled';
  capacity: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface SprintTicket {
  id: string;
  tenantId: string;
  sprintId: string;
  ticketId: string;
  sortOrder: number;
  createdAt: string;
}

export interface TicketRelation {
  id: string;
  tenantId: string;
  sourceTicketId: string;
  targetTicketId: string;
  relationType: 'parent' | 'child' | 'related' | 'blocks' | 'blocked_by';
  createdAt: string;
}

export interface SprintBoard {
  sprint: Sprint;
  columns: Record<string, { ticketId: string; title: string; priority: string; assignee: string | null }[]>;
}

export interface BurndownData {
  date: string;
  remainingPoints: number;
  idealPoints: number;
}

export interface CreateSprintInput {
  name: string;
  goal?: string;
  startDate: string;
  endDate: string;
  capacity?: number;
}

export interface UpdateSprintInput {
  name?: string;
  goal?: string;
  startDate?: string;
  endDate?: string;
  status?: 'planning' | 'active' | 'completed' | 'cancelled';
  capacity?: number;
}

// Sprints
export const listSprints = (params?: { status?: string }) =>
  apiClient.get<Sprint[]>('/sprints', { params });

export const getSprint = (id: string) =>
  apiClient.get<Sprint>(`/sprints/${id}`);

export const createSprint = (data: CreateSprintInput) =>
  apiClient.post<Sprint>('/sprints', data);

export const updateSprint = (id: string, data: UpdateSprintInput) =>
  apiClient.put<Sprint>(`/sprints/${id}`, data);

export const deleteSprint = (id: string) =>
  apiClient.delete(`/sprints/${id}`);

// Sprint Board
export const getSprintBoard = (sprintId: string) =>
  apiClient.get<SprintBoard>(`/sprints/${sprintId}/board`);

export const addTicketToSprint = (sprintId: string, ticketId: string, sortOrder?: number) =>
  apiClient.post(`/sprints/${sprintId}/tickets`, { ticketId, sortOrder });

export const removeTicketFromSprint = (sprintId: string, ticketId: string) =>
  apiClient.delete(`/sprints/${sprintId}/tickets/${ticketId}`);

export const reorderTickets = (sprintId: string, orders: { ticketId: string; sortOrder: number }[]) =>
  apiClient.put(`/sprints/${sprintId}/tickets/reorder`, { orders });

// Backlog
export const getBacklog = () =>
  apiClient.get<{ ticketId: string; title: string; priority: string; storyPoints: number | null }[]>('/sprints/backlog');

// Burndown
export const getBurndownData = (sprintId: string) =>
  apiClient.get<BurndownData[]>(`/sprints/${sprintId}/burndown`);
