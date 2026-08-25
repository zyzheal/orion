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
  return api.get<Webhook[]>('/webhooks');
}

export async function getWebhook(id: string) {
  return api.get<Webhook>(`/webhooks/${id}`);
}

export async function createWebhook(input: WebhookInput) {
  return api.post<Webhook>('/webhooks', input);
}

export async function updateWebhook(id: string, input: Partial<WebhookInput>) {
  return api.put<Webhook>(`/webhooks/${id}`, input);
}

export async function deleteWebhook(id: string) {
  return api.delete<void>(`/webhooks/${id}`);
}

export async function testWebhook(id: string) {
  return api.post<void>(`/webhooks/${id}/test`);
}

export async function getWebhookLogs(id: string, limit?: number) {
  const qs = limit ? `?limit=${limit}` : '';
  return api.get<WebhookLog[]>(`/webhooks/${id}/logs${qs}`);
}
