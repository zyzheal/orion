/**
 * Notification Rules API Client
 *
 * Manages IM notification rules (DingTalk, WeCom, Feishu) for platform-wide
 * event notifications. Each rule targets a specific IM platform webhook URL
 * and subscribes to a set of pipeline/alert events.
 *
 * Backend routes: orion-platform-service/src/api/notification-routes.ts
 * (IM notification rule endpoints extend the existing notification API)
 */

import { api } from './client';

// ============================================================================
// Types
// ============================================================================

export type IMPlatform = 'dingtalk' | 'wecom' | 'feishu';

export interface IMNotificationRule {
  id: string;
  /** Platform name (dingtalk / wecom / feishu) */
  platform: IMPlatform;
  /** Display name for this rule */
  name: string;
  /** IM bot webhook URL */
  webhookUrl: string;
  /** Subscribed event keys, e.g. ['pipeline.complete', 'pipeline.failed'] */
  events: string[];
  /** Whether this rule is active */
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface IMNotificationRuleInput {
  platform: IMPlatform;
  name: string;
  webhookUrl: string;
  events: string[];
  enabled?: boolean;
}

export interface TestNotificationResult {
  success: boolean;
  message: string;
  statusCode?: number;
}

// ============================================================================
// IM Notification Rule CRUD
// ============================================================================

/**
 * Get all IM notification rules
 */
export async function getIMNotificationRules(): Promise<IMNotificationRule[]> {
  const response = await api.get<IMNotificationRule[]>('/v1/notifications/im-rules');
  return (response.data.data as unknown as IMNotificationRule[]) ?? [];
}

/**
 * Create a new IM notification rule
 */
export async function createIMNotificationRule(
  input: IMNotificationRuleInput
): Promise<IMNotificationRule> {
  const response = await api.post<IMNotificationRule>('/v1/notifications/im-rules', input);
  return (response.data.data as unknown as IMNotificationRule) ?? ({} as IMNotificationRule);
}

/**
 * Update an existing IM notification rule
 */
export async function updateIMNotificationRule(
  id: string,
  input: Partial<IMNotificationRuleInput>
): Promise<IMNotificationRule> {
  const response = await api.put<IMNotificationRule>(
    `/v1/notifications/im-rules/${id}`,
    input
  );
  return (response.data.data as unknown as IMNotificationRule) ?? ({} as IMNotificationRule);
}

/**
 * Delete an IM notification rule
 */
export async function deleteIMNotificationRule(id: string): Promise<void> {
  await api.delete<void>(`/v1/notifications/im-rules/${id}`);
}

/**
 * Toggle enabled status of an IM notification rule
 */
export async function toggleIMNotificationRule(
  id: string,
  enabled: boolean
): Promise<IMNotificationRule> {
  const response = await api.put<IMNotificationRule>(
    `/v1/notifications/im-rules/${id}/toggle`,
    { enabled }
  );
  return (response.data.data as unknown as IMNotificationRule) ?? ({} as IMNotificationRule);
}

/**
 * Send a test notification to the IM rule's webhook URL
 */
export async function testIMNotificationRule(
  id: string
): Promise<TestNotificationResult> {
  const response = await api.post<TestNotificationResult>(
    `/v1/notifications/im-rules/${id}/test`
  );
  return (response.data.data as unknown as TestNotificationResult) ?? {
    success: false,
    message: 'No response from server',
  };
}
