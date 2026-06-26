/**
 * Event Trigger API
 * Phase 1 - Event-driven trigger rules for automated actions
 */
import apiClient from './client';

export interface TriggerAction {
  id: string;
  type: 'webhook' | 'notification' | 'runbook' | 'script' | 'escalation';
  config: Record<string, unknown>;
  order: number;
}

export interface EventTriggerRule {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  eventType: string;
  matchConditions: Record<string, unknown>;
  actions: TriggerAction[];
  enabled: boolean;
  cooldownSeconds: number;
  lastTriggeredAt: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface EventTriggerLog {
  id: string;
  tenantId: string;
  ruleId: string;
  eventType: string;
  eventPayload: Record<string, unknown>;
  actionResults: {
    actionId: string;
    actionType: string;
    status: 'success' | 'failed' | 'skipped';
    output: string | null;
    error: string | null;
  }[];
  status: 'success' | 'partial' | 'failed';
  triggeredAt: string;
}

export interface CreateTriggerRuleInput {
  name: string;
  description?: string;
  eventType: string;
  matchConditions: Record<string, unknown>;
  actions: TriggerAction[];
  enabled?: boolean;
  cooldownSeconds?: number;
}

export interface UpdateTriggerRuleInput {
  name?: string;
  description?: string;
  eventType?: string;
  matchConditions?: Record<string, unknown>;
  actions?: TriggerAction[];
  enabled?: boolean;
  cooldownSeconds?: number;
}

export const listTriggerRules = (params?: { eventType?: string }) =>
  apiClient.get<EventTriggerRule[]>('/event-triggers/rules', { params });

export const getTriggerRule = (id: string) =>
  apiClient.get<EventTriggerRule>(`/event-triggers/rules/${id}`);

export const createTriggerRule = (data: CreateTriggerRuleInput) =>
  apiClient.post<EventTriggerRule>('/event-triggers/rules', data);

export const updateTriggerRule = (id: string, data: UpdateTriggerRuleInput) =>
  apiClient.put<EventTriggerRule>(`/event-triggers/rules/${id}`, data);

export const deleteTriggerRule = (id: string) =>
  apiClient.delete(`/event-triggers/rules/${id}`);

export const evaluateEvent = (event: { eventType: string; payload: Record<string, unknown>; timestamp: string; source: string }) =>
  apiClient.post<EventTriggerLog[]>('/event-triggers/evaluate', { event });

export const getTriggerLogs = (ruleId: string, params?: { limit?: number }) =>
  apiClient.get<EventTriggerLog[]>(`/event-triggers/rules/${ruleId}/logs`, { params });
