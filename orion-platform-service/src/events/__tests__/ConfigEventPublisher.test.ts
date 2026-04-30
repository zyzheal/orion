/**
 * ConfigEventPublisher 单元测试
 *
 * ARCH-010: Updated to use EventBusAdapter pattern
 */

let mockPublish: jest.Mock;
let mockIsAvailable: jest.Mock;
let mockGetConnectionState: jest.Mock;

jest.mock('../EventBusAdapter', () => ({
  EventBusAdapter: jest.fn(),
}));

import { ConfigEventPublisher } from '../ConfigEventPublisher';
import { EventBusAdapter } from '../EventBusAdapter';

describe('ConfigEventPublisher', () => {
  let publisher: ConfigEventPublisher;

  beforeEach(() => {
    jest.clearAllMocks();
    mockPublish = jest.fn().mockResolvedValue({ success: true, eventId: 'mock-id', deliveryMode: 'jetstream' });
    mockIsAvailable = jest.fn().mockReturnValue(true);
    mockGetConnectionState = jest.fn().mockReturnValue('connected');

    (EventBusAdapter as jest.Mock).mockImplementation(() => ({
      publish: mockPublish,
      isAvailable: mockIsAvailable,
      getConnectionState: mockGetConnectionState,
      setEventBus: jest.fn(),
    }));

    publisher = new ConfigEventPublisher({
      source: 'config-service',
      defaultTenantId: 'tenant-001',
      defaultUserId: 'user-001',
    });
  });

  describe('Drift Events', () => {
    it('should publish config.drift.detected event', async () => {
      await publisher.publishDriftDetected({
        configId: 'config-001',
        resourceType: 'kubernetes.deployment',
        expected: { replicas: 3 },
        actual: { replicas: 2 },
        driftType: 'modified',
      });

      expect(mockPublish).toHaveBeenCalledWith(
        'config.drift.detected',
        expect.objectContaining({ configId: 'config-001', driftType: 'modified' }),
        expect.objectContaining({ source: 'config-service', tenantId: 'tenant-001' }),
      );
    });

    it('should publish config.drift.resolved event', async () => {
      await publisher.publishDriftResolved({
        configId: 'config-001',
        resourceType: 'kubernetes.deployment',
        resolution: 'reconciled',
      });

      expect(mockPublish).toHaveBeenCalledWith(
        'config.drift.resolved',
        expect.objectContaining({ resolution: 'reconciled' }),
        expect.any(Object),
      );
    });

    it('should publish config.change.applied event', async () => {
      await publisher.publishChangeApplied({
        configId: 'config-001',
        changeType: 'update',
      });

      expect(mockPublish).toHaveBeenCalledWith(
        'config.change.applied',
        expect.objectContaining({ changeType: 'update' }),
        expect.any(Object),
      );
    });

    it('should publish config.change.rejected event', async () => {
      await publisher.publishChangeRejected({
        configId: 'config-001',
        reason: 'Validation failed',
      });

      expect(mockPublish).toHaveBeenCalledWith(
        'config.change.rejected',
        expect.objectContaining({ reason: 'Validation failed' }),
        expect.any(Object),
      );
    });
  });

  describe('Drift type variants', () => {
    it('should support added drift type', async () => {
      await publisher.publishDriftDetected({
        configId: 'config-001',
        resourceType: 'kubernetes.configmap',
        expected: {},
        actual: { newKey: 'newValue' },
        driftType: 'added',
      });

      expect(mockPublish).toHaveBeenCalledWith(
        'config.drift.detected',
        expect.objectContaining({ driftType: 'added' }),
        expect.any(Object),
      );
    });

    it('should support removed drift type', async () => {
      await publisher.publishDriftDetected({
        configId: 'config-001',
        resourceType: 'kubernetes.configmap',
        expected: { oldKey: 'oldValue' },
        actual: {},
        driftType: 'removed',
      });

      expect(mockPublish).toHaveBeenCalledWith(
        'config.drift.detected',
        expect.objectContaining({ driftType: 'removed' }),
        expect.any(Object),
      );
    });
  });

  describe('Status methods', () => {
    it('should return adapter availability', () => {
      expect(publisher.isAvailable()).toBe(true);
    });

    it('should return adapter connection state', () => {
      expect(publisher.getConnectionState()).toBe('connected');
    });
  });
});
