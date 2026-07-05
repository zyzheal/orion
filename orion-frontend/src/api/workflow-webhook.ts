/**
 * Workflow Webhook API Service
 * Auto-generated from backend workflow-webhook-routes.ts
 * Prefix: /api/v1/webhooks
 */
import { api } from './client';

export interface WebhookTriggerResult {
  success: boolean;
  instanceId?: string;
  execution?: unknown;
  status?: string;
}

export const triggerWebhook = async (webhookPath: string, data?: Record<string, unknown>, headers?: Record<string, string>): Promise<WebhookTriggerResult> => {
  const response = await api.post<WebhookTriggerResult>('/api/v1/webhooks/' + webhookPath, data, { headers });
  return response.data;
};
