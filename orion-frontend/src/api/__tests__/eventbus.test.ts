/**
 * EventBus API Client Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getEventBusStatus,
  publishEvent,
  getEvents,
  getSubscriptions,
  getStats,
  getJetStreamMetrics,
  getDLQEvents,
} from '../eventbus';
import { api } from '../client';

vi.mock('../client', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    patch: vi.fn(),
  },
}));

describe('EventBus API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should get eventbus status', async () => {
    const mockStatus = { status: 'up', servers: ['nats://localhost:4222'], enabled: true };
    vi.mocked(api.get).mockResolvedValue({ data: { data: mockStatus } } as any);

    const result = await getEventBusStatus();
    expect(api.get).toHaveBeenCalledWith('/v1/eventbus/status');
    expect(result.data.data).toEqual(mockStatus);
  });

  it('should publish an event', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { data: undefined } } as any);

    await publishEvent('test.event', { key: 'value' }, 'tenant-1', 'user-1');
    expect(api.post).toHaveBeenCalledWith('/v1/eventbus/publish', {
      subject: 'test.event',
      data: { key: 'value' },
      tenantId: 'tenant-1',
      publishedBy: 'user-1',
    });
  });

  it('should get events with filters', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: { events: [] } } } as any);

    await getEvents({ eventType: 'test', limit: 10 });
    expect(api.get).toHaveBeenCalledWith('/v1/eventbus/events?eventType=test&limit=10');
  });

  it('should get subscriptions', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: { subscriptions: [] } } } as any);

    await getSubscriptions('tenant-1');
    expect(api.get).toHaveBeenCalledWith('/v1/eventbus/subscriptions?tenantId=tenant-1');
  });

  it('should get stats', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: { stats: { delivered: 100 } } } } as any);

    const result = await getStats();
    expect(api.get).toHaveBeenCalledWith('/v1/eventbus/stats');
    expect(result.data.data.stats.delivered).toBe(100);
  });

  it('should get jetstream metrics', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: { available: true, metrics: {} } } } as any);

    const result = await getJetStreamMetrics();
    expect(api.get).toHaveBeenCalledWith('/v1/eventbus/jetstream/metrics');
    expect(result.data.data.available).toBe(true);
  });

  it('should get DLQ events', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: { total: 2, events: [] } } } as any);

    const result = await getDLQEvents(20);
    expect(api.get).toHaveBeenCalledWith('/v1/eventbus/dlq?limit=20');
    expect(result.data.data.total).toBe(2);
  });
});
