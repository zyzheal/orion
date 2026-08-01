/**
 * Multi-Modal Trigger API
 * Phase 3 - Webhook, chat, schedule, event, and manual triggers
 */
import apiClient from './client';

export interface Trigger {
  id: string;
  name: string;
  type: 'webhook' | 'chat' | 'schedule' | 'event' | 'manual';
  target: { pipelineId?: string; action?: string };
  config: Record<string, unknown>;
  status: 'active' | 'inactive';
  createdAt: string;
  lastTriggeredAt?: string;
  triggerCount: number;
}

export interface TriggerResult {
  triggerId: string;
  status: 'success' | 'failed';
  pipelineRunId?: string;
  executedAt: string;
}

export interface WebhookRegistration {
  id: string;
  url: string;
  secret?: string;
  events: string[];
  createdAt: string;
}

export interface WebhookEvent {
  id: string;
  webhookId: string;
  eventType: string;
  payload: Record<string, unknown>;
  processed: boolean;
  createdAt: string;
}

export interface TriggerStats {
  totalTriggers: number;
  byType: Record<string, number>;
  successRate: number;
  avgExecutionTimeMs: number;
}

export const triggersApi = {
  registerTrigger: async (data: {
    name: string;
    type: string;
    target: { pipelineId?: string; action?: string };
    config: Record<string, unknown>;
  }) => {
    const response = await apiClient.post('/api/triggers', data);
    return response.data as Trigger;
  },

  listTriggers: async (params?: { type?: string; status?: string }) => {
    const response = await apiClient.get('/api/triggers', { params });
    return response.data as Trigger[];
  },

  evaluateTrigger: async (triggerId: string) => {
    const response = await apiClient.post(`/api/triggers/${triggerId}/evaluate`);
    return response.data;
  },

  executePipeline: async (triggerId: string, data?: { params?: Record<string, unknown> }) => {
    const response = await apiClient.post(`/api/triggers/${triggerId}/execute`, data);
    return response.data as TriggerResult;
  },

  registerWebhook: async (data: { url: string; secret?: string; events: string[] }) => {
    const response = await apiClient.post('/api/triggers/webhook', data);
    return response.data as WebhookRegistration;
  },

  processWebhookEvent: async (data: { webhookId: string; event: Record<string, unknown> }) => {
    const response = await apiClient.post('/api/triggers/webhook/process', data);
    return response.data;
  },

  getWebhookHistory: async (params?: { webhookId?: string }) => {
    const response = await apiClient.get('/api/triggers/webhook/history', { params });
    return response.data as WebhookEvent[];
  },

  executeFromChat: async (data: { channelId: string; command: string; params?: Record<string, unknown> }) => {
    const response = await apiClient.post('/api/triggers/chat', data);
    return response.data as TriggerResult;
  },

  getTriggerStats: async () => {
    const response = await apiClient.get('/api/triggers/stats');
    return response.data as TriggerStats;
  },
};

export default triggersApi;
