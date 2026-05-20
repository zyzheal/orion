/**
 * EventRegistry API Client
 *
 * Interfaces with Event Trigger Registry backend.
 * Backend routes: orion-platform-service/src/api/event-trigger-registry-routes.ts
 */

import { api } from './client';

// ============================================================================
// Types
// ============================================================================

export interface EventTypeInfo {
  type: string;
  category: string;
  description: string;
  samplePayload: Record<string, unknown>;
}

export interface EventTypesResponse {
  eventTypes: EventTypeInfo[];
  categories: string[];
  streams: Array<{
    name: string;
    subjects: string[];
  }>;
}

export interface Subscription {
  triggerId: string;
  triggerName: string;
  eventType: string;
  workflowId: string;
  enabled: boolean;
  eventFilter?: Record<string, unknown>;
  createdAt: string;
}

export interface SubscriptionsResponse {
  total: number;
  subscriptions: Subscription[];
}

export interface TestMatchResult {
  triggerId: string;
  triggerName: string;
  workflowId: string;
  matched: boolean;
  matchDetails: string;
  matchedFields?: Record<string, unknown>;
}

export interface TestMatchRequest {
  eventType: string;
  eventPayload: Record<string, unknown>;
  triggerId?: string;
}

export interface TestMatchResponse {
  eventType: string;
  eventPayload: Record<string, unknown>;
  matchingTriggers: number;
  results: TestMatchResult[];
}

export interface TriggerStatistics {
  triggerId: string;
  triggerName: string;
  type: string;
  enabled: boolean;
  eventType?: string;
  cronExpression?: string;
}

export interface StatisticsResponse {
  totalTriggers: number;
  byType: Record<string, { total: number; enabled: number }>;
  triggers: TriggerStatistics[];
}

// ============================================================================
// API Functions
// ============================================================================

/**
 * 获取可用事件类型列表
 */
export async function getEventTypes() {
  return api.get<{ success: boolean; data: EventTypesResponse }>('/v1/event-registry/event-types');
}

/**
 * 获取当前订阅状态
 */
export async function getSubscriptions() {
  return api.get<{ success: boolean; data: SubscriptionsResponse }>(
    '/v1/event-registry/subscriptions'
  );
}

/**
 * 测试事件与触发器的匹配
 */
export async function testMatch(request: TestMatchRequest) {
  return api.post<{ success: boolean; data: TestMatchResponse }>(
    '/v1/event-registry/test-match',
    request
  );
}

/**
 * 获取触发器统计
 */
export async function getStatistics() {
  return api.get<{ success: boolean; data: StatisticsResponse }>('/v1/event-registry/statistics');
}
