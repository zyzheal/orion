/**
 * EventBus Monitoring types
 * 抽取自 index.tsx (P2-9 Phase 164)
 */

export interface EventBusEvent {
  id: string;
  eventType: string;
  source: string;
  timestamp: string;
  status: 'delivered' | 'failed' | 'pending' | 'retried';
  payloadSize: number;
  subscriberCount: number;
  topic: string;
  traceId: string;
}

export interface EventBusStats {
  totalEvents: number;
  activeSubscribers: number;
  failedEvents: number;
  eventRate: number;
}

export type EventStatus = EventBusEvent['status'];
