/**
 * EventBus API Client
 *
 * Interfaces with NATS JetStream event bus backend.
 * Backend routes: orion-platform-service/src/api/eventbus-routes.ts
 */

import { api } from './client';

export interface EventBusStatus {
  status: 'up' | 'down';
  message?: string;
  state?: string;
  latency?: number;
  servers: string[];
  enabled: boolean;
}

export interface EventBusEvent {
  id: string;
  tenantId: string;
  eventType: string;
  subject: string;
  source: string;
  status: string;
  payload: Record<string, unknown>;
  publishedBy?: string;
  publishedAt: string;
  retryCount: number;
  createdAt: string;
}

export interface EventBusSubscription {
  id: string;
  tenantId: string;
  subjectPattern: string;
  handlerName: string;
  handlerType: string;
  durableName?: string;
  queueGroup?: string;
  filterSubject?: string;
  status: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface JetStreamMetrics {
  available: boolean;
  metrics?: Record<string, { messages: number; bytes: number; consumers: number }>;
}

export interface DLQEvent {
  total: number;
  events: EventBusEvent[];
}

export async function getEventBusStatus() {
  return api.get<EventBusStatus>('/api/v1/eventbus/status');
}

export async function connectEventBus() {
  return api.post<void>('/api/v1/eventbus/connect');
}

export async function publishEvent(
  subject: string,
  data: unknown,
  tenantId?: string,
  publishedBy?: string
) {
  return api.post<void>('/api/v1/eventbus/publish', { subject, data, tenantId, publishedBy });
}

export async function getEvents(options?: { eventType?: string; status?: string; limit?: number }) {
  const params = new URLSearchParams();
  if (options?.eventType) params.append('eventType', options.eventType);
  if (options?.status) params.append('status', options.status);
  if (options?.limit) params.append('limit', String(options.limit));
  const qs = params.toString();
  return api.get<EventBusEvent[]>(`/api/v1/eventbus/events${qs ? '?' + qs : ''}`);
}

export async function getSubscriptions(tenantId?: string) {
  const qs = tenantId ? `?tenantId=${tenantId}` : '';
  return api.get<EventBusSubscription[]>(`/api/v1/eventbus/subscriptions${qs}`);
}

export async function getStats() {
  return api.get<{ stats: Record<string, number> }>('/api/v1/eventbus/stats');
}

export async function getJetStreamMetrics() {
  return api.get<JetStreamMetrics>('/api/v1/eventbus/jetstream/metrics');
}

export async function getStreamConsumers(streamName: string) {
  return api.get<{ stream: string; consumers: Array<{ name: string; pending: number }> }>(
    `/api/v1/eventbus/jetstream/streams/${streamName}/consumers`
  );
}

export async function getDLQEvents(limit?: number) {
  const qs = limit ? `?limit=${limit}` : '';
  return api.get<DLQEvent>(`/api/v1/eventbus/dlq${qs}`);
}
