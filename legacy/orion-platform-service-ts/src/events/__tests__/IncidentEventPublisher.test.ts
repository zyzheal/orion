/**
 * IncidentEventPublisher 单元测试
 *
 * ARCH-010: Updated to use EventBusAdapter pattern
 */

let mockPublish: jest.Mock;
let mockIsAvailable: jest.Mock;
let mockGetConnectionState: jest.Mock;

jest.mock('../EventBusAdapter', () => ({
  EventBusAdapter: jest.fn(),
}));

import { IncidentEventPublisher } from '../IncidentEventPublisher';
import { EventBusAdapter } from '../EventBusAdapter';

describe('IncidentEventPublisher', () => {
  let publisher: IncidentEventPublisher;

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

    publisher = new IncidentEventPublisher({
      source: 'incident-service',
      defaultTenantId: 'tenant-001',
      defaultUserId: 'user-001',
    });
  });

  describe('Incident Events', () => {
    it('should publish incident.detected event', async () => {
      await publisher.publishIncidentDetected({
        incidentId: 'incident-001',
        service: 'api-gateway',
        severity: 'critical',
        type: 'service_down',
        title: 'API Gateway unavailable',
      });

      expect(mockPublish).toHaveBeenCalledWith(
        'incident.detected',
        expect.objectContaining({ incidentId: 'incident-001', severity: 'critical' }),
        expect.objectContaining({ source: 'incident-service', tenantId: 'tenant-001' }),
      );
    });

    it('should publish incident.acknowledged event', async () => {
      await publisher.publishIncidentAcknowledged({
        incidentId: 'incident-001',
        service: 'api-gateway',
        acknowledgedBy: 'oncall-001',
      });

      expect(mockPublish).toHaveBeenCalledWith(
        'incident.acknowledged',
        expect.objectContaining({ incidentId: 'incident-001' }),
        expect.any(Object),
      );
    });

    it('should publish incident.resolved event', async () => {
      await publisher.publishIncidentResolved({
        incidentId: 'incident-001',
        service: 'api-gateway',
        resolvedBy: 'engineer-001',
        durationMs: 1800000,
      });

      expect(mockPublish).toHaveBeenCalledWith(
        'incident.resolved',
        expect.objectContaining({ incidentId: 'incident-001', durationMs: 1800000 }),
        expect.any(Object),
      );
    });

    it('should publish incident.escalated event', async () => {
      await publisher.publishIncidentEscalated({
        incidentId: 'incident-001',
        service: 'api-gateway',
        escalationLevel: 2,
        reason: 'SLA breach',
      });

      expect(mockPublish).toHaveBeenCalledWith(
        'incident.escalated',
        expect.objectContaining({ incidentId: 'incident-001', escalationLevel: 2 }),
        expect.any(Object),
      );
    });
  });

  describe('Severity variants', () => {
    it('should support LOW severity', async () => {
      await publisher.publishIncidentDetected({
        incidentId: 'incident-001',
        service: 'api-gateway',
        severity: 'low',
        type: 'performance_degradation',
      });

      expect(mockPublish).toHaveBeenCalledWith(
        'incident.detected',
        expect.objectContaining({ severity: 'low' }),
        expect.any(Object),
      );
    });

    it('should support HIGH severity', async () => {
      await publisher.publishIncidentDetected({
        incidentId: 'incident-001',
        service: 'api-gateway',
        severity: 'high',
        type: 'resource_exhaustion',
      });

      expect(mockPublish).toHaveBeenCalledWith(
        'incident.detected',
        expect.objectContaining({ severity: 'high' }),
        expect.any(Object),
      );
    });
  });

  describe('Incident type variants', () => {
    it('should support SERVICE_DOWN type', async () => {
      await publisher.publishIncidentDetected({
        incidentId: 'incident-001',
        service: 'api-gateway',
        severity: 'critical',
        type: 'service_down',
      });

      expect(mockPublish).toHaveBeenCalledWith(
        'incident.detected',
        expect.objectContaining({ type: 'service_down' }),
        expect.any(Object),
      );
    });

    it('should support SECURITY_BREACH type', async () => {
      await publisher.publishIncidentDetected({
        incidentId: 'incident-001',
        service: 'api-gateway',
        severity: 'critical',
        type: 'security_breach',
      });

      expect(mockPublish).toHaveBeenCalledWith(
        'incident.detected',
        expect.objectContaining({ type: 'security_breach' }),
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

  describe('No EventBus', () => {
    it('should gracefully degrade when EventBus is not available', async () => {
      mockIsAvailable.mockReturnValue(false);
      mockPublish.mockResolvedValue({ success: false, deliveryMode: 'disabled' });

      const result = await publisher.publishIncidentDetected({
        incidentId: 'incident-001',
        service: 'api-gateway',
        severity: 'high',
        type: 'service_down',
      });

      expect(result.success).toBe(false);
    });
  });
});
