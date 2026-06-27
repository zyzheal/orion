/**
 * EventTriggerRegistry API Service
 * Auto-generated from backend event-trigger-registry-routes.ts
 * Prefix: /v1/event-registry
 */
import { api } from './client';

export interface EventTriggerRegistry {
  id: string;
  tenant_id?: string;
  name?: string;
  status?: string;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

export const listEventTriggerRegistry = async (params?: Record<string, unknown>): Promise<{ data: EventTriggerRegistry[]; total: number }> => {
  const response = await api.get<{ data: EventTriggerRegistry[]; total: number }>('/v1/event-registry/event-types', { params });
  return { data: response.data.data, total: response.data.total };
};
