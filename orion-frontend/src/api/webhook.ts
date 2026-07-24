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
  return api.get<Webhook[]>('/api/v1/webhooks');
}

export async function getWebhook(id: string) {
  return api.get<Webhook>(`/api/v1/webhooks/${id}`);
}

export async function createWebhook(input: WebhookInput) {
  return api.post<Webhook>('/api/v1/webhooks', input);
}

export async function updateWebhook(id: string, input: Partial<WebhookInput>) {
  return api.put<Webhook>(`/api/v1/webhooks/${id}`, input);
}

export async function deleteWebhook(id: string) {
  return api.delete<void>(`/api/v1/webhooks/${id}`);
}

export async function testWebhook(id: string) {
  return api.post<void>(`/api/v1/webhooks/${id}/test`);
}

export async function getWebhookLogs(id: string, limit?: number) {
  const qs = limit ? `?limit=${limit}` : '';
  return api.get<WebhookLog[]>(`/api/v1/webhooks/${id}/logs${qs}`);
}
