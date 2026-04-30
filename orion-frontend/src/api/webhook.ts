/**
 * Webhook API Client
 *
 * Backend routes: orion-platform-service/src/api/webhook-routes.ts
 */

import { api } from './client';

export interface Webhook {
  id: string;
  url: string;
  events: string[];
  secret?: string;
  enabled: boolean;
  lastTriggeredAt?: string;
  lastStatus?: number;
  failureCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface WebhookInput {
  url: string;
  events: string[];
  secret?: string;
  enabled?: boolean;
}

export interface WebhookLog {
  id: string;
  webhookId: string;
  event: string;
  status: number;
  response?: string;
  error?: string;
  createdAt: string;
}

export async function getWebhooks() {
  return api.get<{ webhooks: Webhook[] }>('/v1/webhooks');
}

export async function getWebhook(id: string) {
  return api.get<{ webhook: Webhook }>(`/v1/webhooks/${id}`);
}

export async function createWebhook(input: WebhookInput) {
  return api.post<{ webhook: Webhook }>('/v1/webhooks', input);
}

export async function updateWebhook(id: string, input: Partial<WebhookInput>) {
  return api.put<{ webhook: Webhook }>(`/v1/webhooks/${id}`, input);
}

export async function deleteWebhook(id: string) {
  return api.delete<void>(`/v1/webhooks/${id}`);
}

export async function testWebhook(id: string) {
  return api.post<void>(`/v1/webhooks/${id}/test`);
}

export async function getWebhookLogs(id: string, limit?: number) {
  const qs = limit ? `?limit=${limit}` : '';
  return api.get<{ logs: WebhookLog[] }>(`/v1/webhooks/${id}/logs${qs}`);
}
