/**
 * Tests for SLAService
 *
 * Mode B: Mock Repository objects, verify business logic,
 * validation, state transitions, breach detection, and statistics.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { SLAService } from '../SLAService';
import { OrionError } from '../../../errors';

// Mock repositories
const mockDefinitionRepo = {
  createDefinition: jest.fn(),
  findById: jest.fn(),
  findByTenant: jest.fn(),
  updateDefinition: jest.fn(),
  delete: jest.fn(),
  getStats: jest.fn(),
};

const mockTrackingRepo = {
  createTracking: jest.fn(),
  findById: jest.fn(),
  findByTenant: jest.fn(),
  findByEntity: jest.fn(),
  updateStatus: jest.fn(),
  findActiveBreaches: jest.fn(),
  getStats: jest.fn(),
};

const mockBreachEventRepo = {
  createEvent: jest.fn(),
  findByTrackingId: jest.fn(),
  findByTenant: jest.fn(),
};

jest.mock('../SLARepository', () => ({
  SLADefinitionRepository: jest.fn(() => mockDefinitionRepo),
  SLATrackingRepository: jest.fn(() => mockTrackingRepo),
  SLABreachEventRepository: jest.fn(() => mockBreachEventRepo),
}));

const TENANT = 'tenant-1';

const mockDefinition = (overrides: Record<string, any> = {}) => ({
  id: 'sla-1',
  tenant_id: TENANT,
  name: 'P1 Response SLA',
  description: 'Critical incident response',
  type: 'response',
  target_value: 15,
  target_unit: 'minutes',
  business_hours_only: false,
  priority: 'critical',
  category: 'incident',
  escalation_rules: {},
  metadata: {},
  status: 'active',
  created_by: 'user-1',
  created_at: new Date(),
  updated_at: new Date(),
  ...overrides,
});

const mockTracking = (overrides: Record<string, any> = {}) => ({
  id: 'track-1',
  tenant_id: TENANT,
  sla_definition_id: 'sla-1',
  entity_type: 'incident',
  entity_id: 'inc-1',
  status: 'tracking',
  start_time: new Date(),
  target_time: new Date(Date.now() + 900000), // +15 min
  actual_time: null,
  breach_time: null,
  pause_duration: '0',
  notes: null,
  created_at: new Date(),
  updated_at: new Date(),
  ...overrides,
});

const mockBreachEvent = (overrides: Record<string, any> = {}) => ({
  id: 'evt-1',
  tenant_id: TENANT,
  sla_tracking_id: 'track-1',
  event_type: 'breach',
  event_time: new Date(),
  details: {},
  notified_users: [],
  created_at: new Date(),
  ...overrides,
});

describe('SLAService', () => {
  let service: SLAService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new SLAService({} as any);
  });

  // ==================== createDefinition ====================

  describe('createDefinition', () => {
    it('should create a definition with defaults', async () => {
      mockDefinitionRepo.createDefinition.mockResolvedValueOnce(mockDefinition());

      const result = await service.createDefinition({
        name: 'P1 Response SLA',
        targetValue: 15,
      }, TENANT);

      expect(result.id).toBe('sla-1');
      expect(mockDefinitionRepo.createDefinition).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: TENANT,
          name: 'P1 Response SLA',
          targetValue: 15,
        })
      );
    });

    it('should throw when name is empty', async () => {
      await expect(service.createDefinition({ name: '', targetValue: 15 }, TENANT)).rejects.toThrow(OrionError);
    });

    it('should throw when targetValue is zero', async () => {
      await expect(service.createDefinition({ name: 'Test', targetValue: 0 }, TENANT)).rejects.toThrow('Target value must be a positive number');
    });

    it('should throw when targetValue is negative', async () => {
      await expect(service.createDefinition({ name: 'Test', targetValue: -5 }, TENANT)).rejects.toThrow('Target value must be a positive number');
    });

    it('should validate SLA type', async () => {
      await expect(service.createDefinition({
        name: 'Test',
        targetValue: 15,
        type: 'invalid',
      }, TENANT)).rejects.toThrow('Invalid SLA type');
    });

    it('should validate target unit', async () => {
      await expect(service.createDefinition({
        name: 'Test',
        targetValue: 15,
        targetUnit: 'years',
      }, TENANT)).rejects.toThrow('Invalid target unit');
    });

    it('should validate status', async () => {
      await expect(service.createDefinition({
        name: 'Test',
        targetValue: 15,
        status: 'deleted',
      }, TENANT)).rejects.toThrow('Invalid status');
    });

    it('should validate priority', async () => {
      await expect(service.createDefinition({
        name: 'Test',
        targetValue: 15,
        priority: 'urgent',
      }, TENANT)).rejects.toThrow('Invalid priority');
    });

    it('should accept valid types', async () => {
      for (const type of ['response', 'resolution', 'availability']) {
        mockDefinitionRepo.createDefinition.mockResolvedValueOnce(mockDefinition({ type }));
        const result = await service.createDefinition({ name: 'Test', targetValue: 15, type }, TENANT);
        expect(result.type).toBe(type);
      }
    });
  });

  // ==================== getDefinition ====================

  describe('getDefinition', () => {
    it('should return definition when found', async () => {
      mockDefinitionRepo.findById.mockResolvedValueOnce(mockDefinition());

      const result = await service.getDefinition('sla-1', TENANT);

      expect(result.id).toBe('sla-1');
    });

    it('should throw when not found', async () => {
      mockDefinitionRepo.findById.mockResolvedValueOnce(undefined);

      await expect(service.getDefinition('sla-x', TENANT)).rejects.toThrow('SLA definition not found');
    });

    it('should throw when tenant mismatch', async () => {
      mockDefinitionRepo.findById.mockResolvedValueOnce(mockDefinition({ tenant_id: 'other-tenant' }));

      await expect(service.getDefinition('sla-1', TENANT)).rejects.toThrow('SLA definition not found');
    });
  });

  // ==================== listDefinitions ====================

  describe('listDefinitions', () => {
    it('should return definitions with total', async () => {
      mockDefinitionRepo.findByTenant.mockResolvedValueOnce({
        entities: [mockDefinition()],
        total: 1,
      });

      const result = await service.listDefinitions(TENANT);

      expect(result.definitions).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('should pass filters to repository', async () => {
      mockDefinitionRepo.findByTenant.mockResolvedValueOnce({ entities: [], total: 0 });

      await service.listDefinitions(TENANT, { type: 'response', status: 'active', limit: 10, offset: 5 });

      expect(mockDefinitionRepo.findByTenant).toHaveBeenCalledWith(TENANT, {
        type: 'response',
        status: 'active',
        limit: 10,
        offset: 5,
      });
    });
  });

  // ==================== updateDefinition ====================

  describe('updateDefinition', () => {
    it('should update definition', async () => {
      mockDefinitionRepo.findById.mockResolvedValueOnce(mockDefinition());
      mockDefinitionRepo.updateDefinition.mockResolvedValueOnce(mockDefinition({ name: 'Updated' }));

      const result = await service.updateDefinition('sla-1', { name: 'Updated' }, TENANT);

      expect(result.name).toBe('Updated');
    });

    it('should throw when not found', async () => {
      mockDefinitionRepo.findById.mockResolvedValueOnce(undefined);

      await expect(service.updateDefinition('sla-x', { name: 'x' }, TENANT)).rejects.toThrow('SLA definition not found');
    });

    it('should validate type on update', async () => {
      mockDefinitionRepo.findById.mockResolvedValueOnce(mockDefinition());

      await expect(service.updateDefinition('sla-1', { type: 'invalid' }, TENANT)).rejects.toThrow('Invalid SLA type');
    });

    it('should validate targetUnit on update', async () => {
      mockDefinitionRepo.findById.mockResolvedValueOnce(mockDefinition());

      await expect(service.updateDefinition('sla-1', { targetUnit: 'years' }, TENANT)).rejects.toThrow('Invalid target unit');
    });

    it('should validate positive targetValue', async () => {
      mockDefinitionRepo.findById.mockResolvedValueOnce(mockDefinition());

      await expect(service.updateDefinition('sla-1', { targetValue: -1 }, TENANT)).rejects.toThrow('Target value must be a positive number');
    });

    it('should throw when update returns undefined', async () => {
      mockDefinitionRepo.findById.mockResolvedValueOnce(mockDefinition());
      mockDefinitionRepo.updateDefinition.mockResolvedValueOnce(undefined);

      await expect(service.updateDefinition('sla-1', { name: 'x' }, TENANT)).rejects.toThrow('Failed to update');
    });
  });

  // ==================== deleteDefinition ====================

  describe('deleteDefinition', () => {
    it('should delete definition', async () => {
      mockDefinitionRepo.findById.mockResolvedValueOnce(mockDefinition());
      mockDefinitionRepo.delete.mockResolvedValueOnce(true);

      const result = await service.deleteDefinition('sla-1', TENANT);

      expect(result).toBe(true);
    });

    it('should throw when not found', async () => {
      mockDefinitionRepo.findById.mockResolvedValueOnce(undefined);

      await expect(service.deleteDefinition('sla-x', TENANT)).rejects.toThrow('SLA definition not found');
    });
  });

  // ==================== startTracking ====================

  describe('startTracking', () => {
    it('should start tracking with valid inputs', async () => {
      mockDefinitionRepo.findById.mockResolvedValueOnce(mockDefinition());
      mockTrackingRepo.createTracking.mockResolvedValueOnce(mockTracking());

      const targetTime = new Date(Date.now() + 900000);
      const result = await service.startTracking({
        slaDefinitionId: 'sla-1',
        entityType: 'incident',
        entityId: 'inc-1',
        targetTime,
      }, TENANT);

      expect(result.id).toBe('track-1');
      expect(mockTrackingRepo.createTracking).toHaveBeenCalled();
    });

    it('should validate entity type', async () => {
      await expect(service.startTracking({
        slaDefinitionId: 'sla-1',
        entityType: 'invalid',
        entityId: 'x',
        targetTime: new Date(),
      }, TENANT)).rejects.toThrow('Invalid entity type');
    });

    it('should accept valid entity types', async () => {
      for (const entityType of ['incident', 'request', 'change']) {
        mockDefinitionRepo.findById.mockResolvedValueOnce(mockDefinition());
        mockTrackingRepo.createTracking.mockResolvedValueOnce(mockTracking({ entity_type: entityType }));

        const result = await service.startTracking({
          slaDefinitionId: 'sla-1',
          entityType,
          entityId: 'x',
          targetTime: new Date(),
        }, TENANT);

        expect(result.entity_type).toBe(entityType);
      }
    });

    it('should throw when definition not found', async () => {
      mockDefinitionRepo.findById.mockResolvedValueOnce(undefined);

      await expect(service.startTracking({
        slaDefinitionId: 'sla-x',
        entityType: 'incident',
        entityId: 'inc-1',
        targetTime: new Date(),
      }, TENANT)).rejects.toThrow('SLA definition not found');
    });

    it('should throw when definition is inactive', async () => {
      mockDefinitionRepo.findById.mockResolvedValueOnce(mockDefinition({ status: 'inactive' }));

      await expect(service.startTracking({
        slaDefinitionId: 'sla-1',
        entityType: 'incident',
        entityId: 'inc-1',
        targetTime: new Date(),
      }, TENANT)).rejects.toThrow('Cannot start tracking with an inactive SLA definition');
    });
  });

  // ==================== getTracking ====================

  describe('getTracking', () => {
    it('should return tracking when found', async () => {
      mockTrackingRepo.findById.mockResolvedValueOnce(mockTracking());

      const result = await service.getTracking('track-1', TENANT);

      expect(result.id).toBe('track-1');
    });

    it('should throw when not found', async () => {
      mockTrackingRepo.findById.mockResolvedValueOnce(undefined);

      await expect(service.getTracking('track-x', TENANT)).rejects.toThrow('SLA tracking record not found');
    });
  });

  // ==================== listTracking ====================

  describe('listTracking', () => {
    it('should return trackings with total', async () => {
      mockTrackingRepo.findByTenant.mockResolvedValueOnce({
        entities: [mockTracking()],
        total: 1,
      });

      const result = await service.listTracking(TENANT);

      expect(result.trackings).toHaveLength(1);
      expect(result.total).toBe(1);
    });
  });

  // ==================== markMet ====================

  describe('markMet', () => {
    it('should mark tracking as met from tracking status', async () => {
      mockTrackingRepo.findById.mockResolvedValueOnce(mockTracking({ status: 'tracking' }));
      mockTrackingRepo.updateStatus.mockResolvedValueOnce(mockTracking({ status: 'met' }));

      const result = await service.markMet('track-1', TENANT);

      expect(result.status).toBe('met');
      expect(mockTrackingRepo.updateStatus).toHaveBeenCalledWith('track-1', 'met', TENANT);
    });

    it('should mark tracking as met from paused status', async () => {
      mockTrackingRepo.findById.mockResolvedValueOnce(mockTracking({ status: 'paused' }));
      mockTrackingRepo.updateStatus.mockResolvedValueOnce(mockTracking({ status: 'met' }));

      const result = await service.markMet('track-1', TENANT);

      expect(result.status).toBe('met');
    });

    it('should throw when status is already met', async () => {
      mockTrackingRepo.findById.mockResolvedValueOnce(mockTracking({ status: 'met' }));

      await expect(service.markMet('track-1', TENANT)).rejects.toThrow("Cannot mark as met: current status is 'met'");
    });

    it('should throw when status is breached', async () => {
      mockTrackingRepo.findById.mockResolvedValueOnce(mockTracking({ status: 'breached' }));

      await expect(service.markMet('track-1', TENANT)).rejects.toThrow("Cannot mark as met: current status is 'breached'");
    });
  });

  // ==================== markBreached ====================

  describe('markBreached', () => {
    it('should mark as breached and create breach event', async () => {
      mockTrackingRepo.findById.mockResolvedValueOnce(mockTracking({ status: 'tracking' }));
      mockTrackingRepo.updateStatus.mockResolvedValueOnce(mockTracking({ status: 'breached' }));
      mockBreachEventRepo.createEvent.mockResolvedValueOnce(mockBreachEvent());

      const result = await service.markBreached('track-1', TENANT);

      expect(result.status).toBe('breached');
      expect(mockBreachEventRepo.createEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: TENANT,
          slaTrackingId: 'track-1',
          eventType: 'breach',
        })
      );
    });

    it('should include custom details in breach event', async () => {
      mockTrackingRepo.findById.mockResolvedValueOnce(mockTracking({ status: 'paused' }));
      mockTrackingRepo.updateStatus.mockResolvedValueOnce(mockTracking({ status: 'breached' }));
      mockBreachEventRepo.createEvent.mockResolvedValueOnce(mockBreachEvent());

      await service.markBreached('track-1', TENANT, { reason: 'manual' });

      expect(mockBreachEventRepo.createEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          details: expect.objectContaining({ reason: 'manual' }),
        })
      );
    });

    it('should throw when status is already met', async () => {
      mockTrackingRepo.findById.mockResolvedValueOnce(mockTracking({ status: 'met' }));

      await expect(service.markBreached('track-1', TENANT)).rejects.toThrow("Cannot mark as breached: current status is 'met'");
    });

    it('should throw when status is already breached', async () => {
      mockTrackingRepo.findById.mockResolvedValueOnce(mockTracking({ status: 'breached' }));

      await expect(service.markBreached('track-1', TENANT)).rejects.toThrow("Cannot mark as breached: current status is 'breached'");
    });
  });

  // ==================== pauseTracking ====================

  describe('pauseTracking', () => {
    it('should pause tracking from tracking status', async () => {
      mockTrackingRepo.findById.mockResolvedValueOnce(mockTracking({ status: 'tracking' }));
      mockTrackingRepo.updateStatus.mockResolvedValueOnce(mockTracking({ status: 'paused' }));

      const result = await service.pauseTracking('track-1', TENANT, 'Waiting for customer');

      expect(result.status).toBe('paused');
    });

    it('should throw when status is not tracking', async () => {
      mockTrackingRepo.findById.mockResolvedValueOnce(mockTracking({ status: 'paused' }));

      await expect(service.pauseTracking('track-1', TENANT)).rejects.toThrow("Cannot pause: current status is 'paused'");
    });
  });

  // ==================== resumeTracking ====================

  describe('resumeTracking', () => {
    it('should resume from paused status', async () => {
      mockTrackingRepo.findById.mockResolvedValueOnce(mockTracking({ status: 'paused' }));
      mockTrackingRepo.updateStatus.mockResolvedValueOnce(mockTracking({ status: 'tracking' }));

      const result = await service.resumeTracking('track-1', TENANT);

      expect(result.status).toBe('tracking');
    });

    it('should throw when status is not paused', async () => {
      mockTrackingRepo.findById.mockResolvedValueOnce(mockTracking({ status: 'tracking' }));

      await expect(service.resumeTracking('track-1', TENANT)).rejects.toThrow("Cannot resume: current status is 'tracking'");
    });
  });

  // ==================== detectBreaches ====================

  describe('detectBreaches', () => {
    it('should detect and update overdue trackings', async () => {
      mockTrackingRepo.findActiveBreaches.mockResolvedValueOnce([
        mockTracking({ id: 'track-1' }),
        mockTracking({ id: 'track-2' }),
      ]);
      mockTrackingRepo.updateStatus
        .mockResolvedValueOnce(mockTracking({ id: 'track-1', status: 'breached' }))
        .mockResolvedValueOnce(mockTracking({ id: 'track-2', status: 'breached' }));
      mockBreachEventRepo.createEvent.mockResolvedValue(mockBreachEvent());

      const result = await service.detectBreaches(TENANT);

      expect(result.detected).toBe(2);
      expect(result.breaches).toHaveLength(2);
      expect(mockTrackingRepo.updateStatus).toHaveBeenCalledTimes(2);
      expect(mockBreachEventRepo.createEvent).toHaveBeenCalledTimes(2);
    });

    it('should return zero when no overdue trackings', async () => {
      mockTrackingRepo.findActiveBreaches.mockResolvedValueOnce([]);

      const result = await service.detectBreaches(TENANT);

      expect(result.detected).toBe(0);
      expect(result.breaches).toHaveLength(0);
    });

    it('should handle partial failures gracefully', async () => {
      mockTrackingRepo.findActiveBreaches.mockResolvedValueOnce([
        mockTracking({ id: 'track-1' }),
        mockTracking({ id: 'track-2' }),
      ]);
      mockTrackingRepo.updateStatus
        .mockResolvedValueOnce(mockTracking({ id: 'track-1', status: 'breached' }))
        .mockResolvedValueOnce(undefined); // fails
      mockBreachEventRepo.createEvent.mockResolvedValueOnce(mockBreachEvent());

      const result = await service.detectBreaches(TENANT);

      expect(result.detected).toBe(1);
    });
  });

  // ==================== getBreachEvents ====================

  describe('getBreachEvents', () => {
    it('should return breach events for tracking', async () => {
      mockBreachEventRepo.findByTrackingId.mockResolvedValueOnce([mockBreachEvent()]);

      const result = await service.getBreachEvents('track-1');

      expect(result).toHaveLength(1);
      expect(mockBreachEventRepo.findByTrackingId).toHaveBeenCalledWith('track-1');
    });
  });

  // ==================== listBreachEvents ====================

  describe('listBreachEvents', () => {
    it('should return breach events with total', async () => {
      mockBreachEventRepo.findByTenant.mockResolvedValueOnce({
        entities: [mockBreachEvent()],
        total: 1,
      });

      const result = await service.listBreachEvents(TENANT);

      expect(result.events).toHaveLength(1);
      expect(result.total).toBe(1);
    });
  });

  // ==================== getStats ====================

  describe('getStats', () => {
    it('should return comprehensive stats', async () => {
      mockDefinitionRepo.getStats.mockResolvedValueOnce({
        total: 10,
        byStatus: { active: 8, inactive: 2 },
        byType: { response: 5, resolution: 5 },
      });
      mockTrackingRepo.getStats.mockResolvedValueOnce({
        total: 100,
        byStatus: { tracking: 50, met: 40, breached: 10 },
        breachRate: 10,
      });

      const result = await service.getStats(TENANT);

      expect(result.definitions.total).toBe(10);
      expect(result.definitions.active).toBe(8);
      expect(result.definitions.byType).toEqual({ response: 5, resolution: 5 });
      expect(result.tracking.total).toBe(100);
      expect(result.tracking.active).toBe(50);
      expect(result.tracking.met).toBe(40);
      expect(result.tracking.breached).toBe(10);
      expect(result.tracking.breachRate).toBe(10);
      expect(result.compliance).toBe(80); // 40/(40+10) * 100
    });

    it('should return 100% compliance when no completed trackings', async () => {
      mockDefinitionRepo.getStats.mockResolvedValueOnce({
        total: 5,
        byStatus: { active: 5 },
        byType: { response: 5 },
      });
      mockTrackingRepo.getStats.mockResolvedValueOnce({
        total: 50,
        byStatus: { tracking: 50 },
        breachRate: 0,
      });

      const result = await service.getStats(TENANT);

      expect(result.compliance).toBe(100);
    });

    it('should calculate compliance correctly', async () => {
      mockDefinitionRepo.getStats.mockResolvedValueOnce({
        total: 1,
        byStatus: { active: 1 },
        byType: { response: 1 },
      });
      mockTrackingRepo.getStats.mockResolvedValueOnce({
        total: 200,
        byStatus: { tracking: 100, met: 90, breached: 10 },
        breachRate: 5,
      });

      const result = await service.getStats(TENANT);

      expect(result.compliance).toBe(90); // 90/(90+10) * 100
    });
  });
});
