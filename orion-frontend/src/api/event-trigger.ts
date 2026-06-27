/**
 * EventTrigger API Service
 * Auto-generated from backend event-trigger-routes.ts
 * Prefix: /v1/event-triggers
 */
import { api } from './client';

export interface EventTrigger {
  id: string;
  tenant_id?: string;
  name?: string;
  status?: string;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

export const createEventTriggerRules = async (data?: Partial<EventTrigger>): Promise<EventTrigger> => {
  const response = await api.post<EventTrigger>('/v1/event-triggers/rules', data);
  return response.data;
};

export const listEventTrigger = async (params?: Record<string, unknown>): Promise<{ data: EventTrigger[]; total: number }> => {
  const response = await api.get<{ data: EventTrigger[]; total: number }>('/v1/event-triggers/rules', { params });
  return { data: response.data.data, total: response.data.total };
};

export const getEventTrigger = async (id: string): Promise<EventTrigger> => {
  const response = await api.get<EventTrigger>('/v1/event-triggers/rules/' + id);
  return response.data;
};

export const updateEventTrigger = async (id: string, data: Partial<EventTrigger>): Promise<EventTrigger> => {
  const response = await api.put<EventTrigger>('/v1/event-triggers/rules/' + id, data);
  return response.data;
};

export const deleteEventTrigger = async (id: string): Promise<void> => {
  await api.delete('/v1/event-triggers/rules/' + id);
};

export const createEventTriggerEvaluate = async (data?: Partial<EventTrigger>): Promise<EventTrigger> => {
  const response = await api.post<EventTrigger>('/v1/event-triggers/evaluate', data);
  return response.data;
};
