/**
 * CostEventPublisher 单元测试
 */

import { CostEventPublisher } from '../CostEventPublisher';

// Mock EventBus
function createMockEventBus() {
  const publishedEvents: Array<{ type: string; data: any; options?: any }> = [];

  return {
    publishedEvents,
    publish: jest.fn(async (type: string, data: any, options?: any) => {
      publishedEvents.push({ type, data, options });
      return `event-${Date.now()}`;
    }),
    isHealthy: jest.fn(() => true),
    clear: () => { publishedEvents.length = 0; },
  };
}

describe('CostEventPublisher', () => {
  let publisher: CostEventPublisher;
  let mockEventBus: ReturnType<typeof createMockEventBus>;

  beforeEach(() => {
    mockEventBus = createMockEventBus();
    publisher = new CostEventPublisher({
      eventBus: mockEventBus,
      source: 'test-service',
    });
  });

  // ==================== Publish Cost Collected ====================

  describe('publishCostCollected', () => {
    it('should publish cost.collected event', async () => {
      const eventId = await publisher.publishCostCollected({
        source: 'aws',
        recordCount: 10,
        totalCost: 500.50,
        currency: 'USD',
        periodStart: '2026-04-01T00:00:00Z',
        periodEnd: '2026-04-12T00:00:00Z',
      });

      expect(eventId).toBeDefined();
      expect(mockEventBus.publish).toHaveBeenCalledWith(
        'cost.collected',
        expect.objectContaining({
          type: 'cost.collected',
          source: 'test-service',
        }),
        expect.any(Object)
      );
    });

    it('should include cost breakdown data', async () => {
      await publisher.publishCostCollected({
        source: 'all',
        recordCount: 15,
        totalCost: 1000,
        currency: 'USD',
        periodStart: '2026-04-01T00:00:00Z',
        periodEnd: '2026-04-12T00:00:00Z',
        costByType: { compute: 600, storage: 200, network: 200 },
        costByTenant: { 'tenant-001': 400, 'tenant-002': 600 },
      });

      const callArgs = mockEventBus.publish.mock.calls[0];
      expect(callArgs[1].data.costByType).toEqual({ compute: 600, storage: 200, network: 200 });
      expect(callArgs[1].data.costByTenant).toEqual({ 'tenant-001': 400, 'tenant-002': 600 });
    });

    it('should track published events', async () => {
      await publisher.publishCostCollected({
        source: 'aws',
        recordCount: 5,
        totalCost: 100,
        currency: 'USD',
        periodStart: '2026-04-01T00:00:00Z',
        periodEnd: '2026-04-12T00:00:00Z',
      });

      const events = publisher.getPublishedEvents();
      expect(events.length).toBe(1);
      expect(events[0].type).toBe('cost.collected');
    });
  });

  // ==================== Publish Cost Anomaly ====================

  describe('publishCostAnomaly', () => {
    it('should publish cost.anomaly_detected event', async () => {
      const eventId = await publisher.publishCostAnomaly({
        anomalyType: 'spend_spike',
        currentCost: 1000,
        expectedCost: 500,
        changeRate: 100,
        threshold: 50,
        recommendation: 'Review resource allocation',
      });

      expect(eventId).toBeDefined();
      expect(mockEventBus.publish).toHaveBeenCalledWith(
        'cost.anomaly_detected',
        expect.objectContaining({
          type: 'cost.anomaly_detected',
        }),
        expect.any(Object)
      );
    });

    it('should include anomaly details', async () => {
      await publisher.publishCostAnomaly({
        anomalyType: 'budget_exceeded',
        currentCost: 1200,
        expectedCost: 1000,
        changeRate: 20,
        threshold: 80,
        affectedResources: ['i-abc123', 'vol-def456'],
        tenantId: 'tenant-001',
        environment: 'production',
      });

      const callArgs = mockEventBus.publish.mock.calls[0];
      expect(callArgs[1].data.anomalyType).toBe('budget_exceeded');
      expect(callArgs[1].data.affectedResources).toEqual(['i-abc123', 'vol-def456']);
      expect(callArgs[1].data.tenantId).toBe('tenant-001');
    });

    it('should track published events', async () => {
      await publisher.publishCostAnomaly({
        anomalyType: 'spend_spike',
        currentCost: 500,
        expectedCost: 100,
        changeRate: 400,
        threshold: 50,
      });

      const events = publisher.getPublishedEvents();
      expect(events.length).toBe(1);
      expect(events[0].type).toBe('cost.anomaly_detected');
    });
  });

  // ==================== Spend Spike Detection ====================

  describe('detectAndPublishSpendSpike', () => {
    it('should detect and publish spike when threshold exceeded', async () => {
      const result = await publisher.detectAndPublishSpendSpike(1000, 500, 50);

      expect(result).toBeDefined();
      expect(mockEventBus.publish).toHaveBeenCalledWith(
        'cost.anomaly_detected',
        expect.any(Object),
        expect.any(Object)
      );
    });

    it('should not publish when below threshold', async () => {
      const result = await publisher.detectAndPublishSpendSpike(600, 500, 50);

      expect(result).toBeNull();
      expect(mockEventBus.publish).not.toHaveBeenCalled();
    });

    it('should not publish when baseline is zero', async () => {
      const result = await publisher.detectAndPublishSpendSpike(1000, 0, 50);

      expect(result).toBeNull();
      expect(mockEventBus.publish).not.toHaveBeenCalled();
    });

    it('should calculate change rate correctly', async () => {
      await publisher.detectAndPublishSpendSpike(1500, 1000, 20);

      const callArgs = mockEventBus.publish.mock.calls[0];
      expect(callArgs[1].data.changeRate).toBe(50); // (1500-1000)/1000 * 100 = 50%
      expect(callArgs[1].data.threshold).toBe(20);
    });

    it('should use default threshold of 50%', async () => {
      await publisher.detectAndPublishSpendSpike(2000, 1000);

      const callArgs = mockEventBus.publish.mock.calls[0];
      expect(callArgs[1].data.threshold).toBe(50);
    });
  });

  // ==================== Event Management ====================

  describe('getPublishedEvents', () => {
    it('should return a copy of published events', async () => {
      await publisher.publishCostCollected({
        source: 'aws',
        recordCount: 5,
        totalCost: 100,
        currency: 'USD',
        periodStart: '2026-04-01T00:00:00Z',
        periodEnd: '2026-04-12T00:00:00Z',
      });

      const events1 = publisher.getPublishedEvents();
      const events2 = publisher.getPublishedEvents();

      expect(events1).not.toBe(events2);
      expect(events1.length).toBe(events2.length);
    });

    it('should return empty array when no events published', () => {
      const events = publisher.getPublishedEvents();
      expect(events.length).toBe(0);
    });
  });

  describe('clearPublishedEvents', () => {
    it('should clear all published events', async () => {
      await publisher.publishCostCollected({
        source: 'aws',
        recordCount: 5,
        totalCost: 100,
        currency: 'USD',
        periodStart: '2026-04-01T00:00:00Z',
        periodEnd: '2026-04-12T00:00:00Z',
      });

      publisher.clearPublishedEvents();

      expect(publisher.getPublishedEvents().length).toBe(0);
    });
  });

  describe('getEventStats', () => {
    it('should return zero stats initially', () => {
      const stats = publisher.getEventStats();

      expect(stats.totalPublished).toBe(0);
      expect(stats.costCollected).toBe(0);
      expect(stats.costAnomaly).toBe(0);
    });

    it('should count events by type', async () => {
      await publisher.publishCostCollected({
        source: 'aws',
        recordCount: 5,
        totalCost: 100,
        currency: 'USD',
        periodStart: '2026-04-01T00:00:00Z',
        periodEnd: '2026-04-12T00:00:00Z',
      });

      await publisher.publishCostCollected({
        source: 'alicloud',
        recordCount: 3,
        totalCost: 50,
        currency: 'USD',
        periodStart: '2026-04-01T00:00:00Z',
        periodEnd: '2026-04-12T00:00:00Z',
      });

      await publisher.publishCostAnomaly({
        anomalyType: 'spend_spike',
        currentCost: 500,
        expectedCost: 100,
        changeRate: 400,
        threshold: 50,
      });

      const stats = publisher.getEventStats();

      expect(stats.totalPublished).toBe(3);
      expect(stats.costCollected).toBe(2);
      expect(stats.costAnomaly).toBe(1);
    });
  });

  // ==================== Without EventBus ====================

  describe('without EventBus', () => {
    it('should still track events when no EventBus is configured', async () => {
      const publisherNoBus = new CostEventPublisher({ source: 'test-service' });

      const eventId = await publisherNoBus.publishCostCollected({
        source: 'aws',
        recordCount: 5,
        totalCost: 100,
        currency: 'USD',
        periodStart: '2026-04-01T00:00:00Z',
        periodEnd: '2026-04-12T00:00:00Z',
      });

      expect(eventId).toBeDefined();
      expect(eventId).toContain('mock-cost-event');

      const events = publisherNoBus.getPublishedEvents();
      expect(events.length).toBe(1);
    });
  });
});
