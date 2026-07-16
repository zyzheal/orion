/**
 * Tests for ChangeService
 *
 * Mode B: Mock Repository objects, verify business logic,
 * status transitions, risk assessment, and cross-entity operations.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { ChangeService } from '../ChangeService';
import { OrionError } from '../../../errors';

// Mock repositories
const mockChangeRepo = {
  create: jest.fn(),
  findByIdAndTenant: jest.fn(),
  findByTenant: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  updateStatus: jest.fn(),
  getStats: jest.fn(),
};

const mockCabRepo = {
  create: jest.fn(),
  findByIdAndTenant: jest.fn(),
  findByTenant: jest.fn(),
  update: jest.fn(),
  addDecision: jest.fn(),
};

const mockTimelineRepo = {
  create: jest.fn(),
  findByChangeId: jest.fn(),
};

const mockRfcRepo = {
  create: jest.fn(),
  findByIdAndTenant: jest.fn(),
  findByChangeId: jest.fn(),
  findByTenant: jest.fn(),
  update: jest.fn(),
  updateStatus: jest.fn(),
};

jest.mock('../ChangeRepository', () => ({
  ChangeRequestRepository: jest.fn(() => mockChangeRepo),
  CABMeetingRepository: jest.fn(() => mockCabRepo),
  ChangeTimelineRepository: jest.fn(() => mockTimelineRepo),
  RFCRepository: jest.fn(() => mockRfcRepo),
}));

const TENANT = 'tenant-1';

const mockChange = (overrides: Record<string, any> = {}) => ({
  id: 'chg-1',
  tenantId: TENANT,
  title: 'Upgrade database',
  description: 'Major version upgrade',
  type: 'normal',
  category: 'infrastructure',
  priority: 'high',
  riskLevel: 'medium',
  status: 'draft',
  impactDescription: 'Brief downtime',
  rollbackPlan: 'Restore from backup',
  implementationPlan: 'Step-by-step',
  scheduledStart: null,
  scheduledEnd: null,
  actualStart: null,
  actualEnd: null,
  requesterId: 'user-1',
  assignedTo: 'user-2',
  approvedBy: null,
  approvedAt: null,
  rejectedBy: null,
  rejectedAt: null,
  rejectionReason: null,
  relatedIncidents: [],
  relatedProblems: [],
  affectedServices: ['db-primary'],
  metadata: {},
  createdBy: 'user-1',
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

const mockRFC = (overrides: Record<string, any> = {}) => ({
  id: 'rfc-1',
  tenantId: TENANT,
  changeRequestId: 'chg-1',
  rfcNumber: 'RFC-2026-001',
  justification: 'Security patches needed',
  riskAssessment: 'Medium',
  testPlan: 'Staging testing',
  communicationPlan: 'Email stakeholders',
  backoutPlan: 'Restore snapshot',
  cabMeetingId: null,
  status: 'draft',
  reviewedBy: null,
  reviewedAt: null,
  createdBy: 'user-1',
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

const mockMeeting = (overrides: Record<string, any> = {}) => ({
  id: 'cab-1',
  tenantId: TENANT,
  title: 'Weekly CAB',
  description: null,
  scheduledAt: new Date(),
  location: null,
  attendees: [],
  status: 'scheduled',
  minutes: null,
  decisions: [],
  createdBy: 'user-1',
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

const mockTimeline = (overrides: Record<string, any> = {}) => ({
  id: 'tl-1',
  tenantId: TENANT,
  changeRequestId: 'chg-1',
  eventType: 'status_change',
  description: 'Change created',
  createdBy: 'user-1',
  metadata: {},
  createdAt: new Date(),
  ...overrides,
});

describe('ChangeService', () => {
  let service: ChangeService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ChangeService({} as any);
    service.init();
  });

  // ==================== init ====================

  describe('init', () => {
    it('should initialize with db', () => {
      const svc = new ChangeService({} as any);
      svc.init();
      expect(svc).toBeDefined();
    });

    it('should run in degraded mode without db', async () => {
      const svc = new ChangeService();
      svc.init();
      await expect(svc.getChangeRequest('x', TENANT)).rejects.toThrow('Database not available');
    });
  });

  // ==================== createChangeRequest ====================

  describe('createChangeRequest', () => {
    it('should create with defaults', async () => {
      mockChangeRepo.create.mockResolvedValueOnce(mockChange());
      mockTimelineRepo.create.mockResolvedValueOnce(mockTimeline());

      const result = await service.createChangeRequest({ title: 'Test Change' }, TENANT);

      expect(result.id).toBe('chg-1');
      expect(mockChangeRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: TENANT,
          title: 'Test Change',
          type: 'standard',
          priority: 'medium',
          status: 'draft',
        })
      );
    });

    it('should auto-create timeline event', async () => {
      mockChangeRepo.create.mockResolvedValueOnce(mockChange());
      mockTimelineRepo.create.mockResolvedValueOnce(mockTimeline());

      await service.createChangeRequest({ title: 'Test' }, TENANT);

      expect(mockTimelineRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'status_change',
          description: expect.stringContaining('draft'),
        })
      );
    });

    it('should compute risk level automatically', async () => {
      mockChangeRepo.create.mockResolvedValueOnce(mockChange({ riskLevel: 'high' }));
      mockTimelineRepo.create.mockResolvedValueOnce(mockTimeline());

      await service.createChangeRequest({
        title: 'Emergency change',
        type: 'emergency',
        impactDescription: 'high',
      }, TENANT);

      expect(mockChangeRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ riskLevel: 'high' })
      );
    });

    it('should throw when title is empty', async () => {
      await expect(service.createChangeRequest({ title: '' }, TENANT)).rejects.toThrow(OrionError);
    });
  });

  // ==================== getChangeRequest ====================

  describe('getChangeRequest', () => {
    it('should return when found', async () => {
      mockChangeRepo.findByIdAndTenant.mockResolvedValueOnce(mockChange());

      const result = await service.getChangeRequest('chg-1', TENANT);

      expect(result.id).toBe('chg-1');
    });

    it('should throw when not found', async () => {
      mockChangeRepo.findByIdAndTenant.mockResolvedValueOnce(undefined);

      await expect(service.getChangeRequest('chg-x', TENANT)).rejects.toThrow('Change request not found');
    });
  });

  // ==================== listChangeRequests ====================

  describe('listChangeRequests', () => {
    it('should return data with total', async () => {
      mockChangeRepo.findByTenant.mockResolvedValueOnce({ entities: [mockChange()], total: 1 });

      const result = await service.listChangeRequests(TENANT);

      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
    });
  });

  // ==================== updateChangeRequest ====================

  describe('updateChangeRequest', () => {
    it('should update provided fields', async () => {
      mockChangeRepo.findByIdAndTenant.mockResolvedValueOnce(mockChange());
      mockChangeRepo.update.mockResolvedValueOnce(mockChange({ title: 'Updated' }));

      const result = await service.updateChangeRequest('chg-1', { title: 'Updated' }, TENANT);

      expect(result.title).toBe('Updated');
      expect(mockChangeRepo.update).toHaveBeenCalledWith('chg-1', { title: 'Updated' });
    });

    it('should return existing when no changes', async () => {
      const existing = mockChange();
      mockChangeRepo.findByIdAndTenant.mockResolvedValueOnce(existing);

      const result = await service.updateChangeRequest('chg-1', {}, TENANT);

      expect(result).toEqual(existing);
      expect(mockChangeRepo.update).not.toHaveBeenCalled();
    });

    it('should throw when not found', async () => {
      mockChangeRepo.findByIdAndTenant.mockResolvedValueOnce(undefined);

      await expect(service.updateChangeRequest('chg-x', { title: 'x' }, TENANT)).rejects.toThrow('Change request not found');
    });
  });

  // ==================== deleteChangeRequest ====================

  describe('deleteChangeRequest', () => {
    it('should delete draft change', async () => {
      mockChangeRepo.findByIdAndTenant.mockResolvedValueOnce(mockChange({ status: 'draft' }));
      mockChangeRepo.delete.mockResolvedValueOnce(true);

      const result = await service.deleteChangeRequest('chg-1', TENANT);

      expect(result).toBe(true);
    });

    it('should delete cancelled change', async () => {
      mockChangeRepo.findByIdAndTenant.mockResolvedValueOnce(mockChange({ status: 'cancelled' }));
      mockChangeRepo.delete.mockResolvedValueOnce(true);

      const result = await service.deleteChangeRequest('chg-1', TENANT);

      expect(result).toBe(true);
    });

    it('should reject deletion of approved change', async () => {
      mockChangeRepo.findByIdAndTenant.mockResolvedValueOnce(mockChange({ status: 'approved' }));

      await expect(service.deleteChangeRequest('chg-1', TENANT)).rejects.toThrow('Cannot delete');
    });

    it('should reject deletion of in_progress change', async () => {
      mockChangeRepo.findByIdAndTenant.mockResolvedValueOnce(mockChange({ status: 'in_progress' }));

      await expect(service.deleteChangeRequest('chg-1', TENANT)).rejects.toThrow('Cannot delete');
    });

    it('should throw when not found', async () => {
      mockChangeRepo.findByIdAndTenant.mockResolvedValueOnce(undefined);

      await expect(service.deleteChangeRequest('chg-x', TENANT)).rejects.toThrow('Change request not found');
    });
  });

  // ==================== updateStatus ====================

  describe('updateStatus', () => {
    it('should allow draft -> submitted', async () => {
      mockChangeRepo.findByIdAndTenant.mockResolvedValueOnce(mockChange({ status: 'draft' }));
      mockChangeRepo.updateStatus.mockResolvedValueOnce(mockChange({ status: 'submitted' }));
      mockTimelineRepo.create.mockResolvedValueOnce(mockTimeline());

      const result = await service.updateStatus('chg-1', 'submitted', TENANT, 'user-1');

      expect(result.status).toBe('submitted');
    });

    it('should allow submitted -> approved with extra fields', async () => {
      mockChangeRepo.findByIdAndTenant.mockResolvedValueOnce(mockChange({ status: 'submitted' }));
      mockChangeRepo.updateStatus.mockResolvedValueOnce(mockChange({ status: 'approved' }));
      mockTimelineRepo.create.mockResolvedValueOnce(mockTimeline());

      await service.updateStatus('chg-1', 'approved', TENANT, 'user-3');

      expect(mockChangeRepo.updateStatus).toHaveBeenCalledWith(
        'chg-1', 'approved', TENANT,
        expect.objectContaining({ approvedBy: 'user-3' })
      );
    });

    it('should allow submitted -> rejected with reason', async () => {
      mockChangeRepo.findByIdAndTenant.mockResolvedValueOnce(mockChange({ status: 'submitted' }));
      mockChangeRepo.updateStatus.mockResolvedValueOnce(mockChange({ status: 'rejected' }));
      mockTimelineRepo.create.mockResolvedValueOnce(mockTimeline());

      await service.updateStatus('chg-1', 'rejected', TENANT, 'user-3', 'Insufficient testing');

      expect(mockChangeRepo.updateStatus).toHaveBeenCalledWith(
        'chg-1', 'rejected', TENANT,
        expect.objectContaining({ rejectedBy: 'user-3', rejectionReason: 'Insufficient testing' })
      );
    });

    it('should allow approved -> in_progress with actualStart', async () => {
      mockChangeRepo.findByIdAndTenant.mockResolvedValueOnce(mockChange({ status: 'approved' }));
      mockChangeRepo.updateStatus.mockResolvedValueOnce(mockChange({ status: 'in_progress' }));
      mockTimelineRepo.create.mockResolvedValueOnce(mockTimeline());

      await service.updateStatus('chg-1', 'in_progress', TENANT, 'user-2');

      expect(mockChangeRepo.updateStatus).toHaveBeenCalledWith(
        'chg-1', 'in_progress', TENANT,
        expect.objectContaining({ actualStart: expect.any(String) })
      );
    });

    it('should allow in_progress -> completed with actualEnd', async () => {
      mockChangeRepo.findByIdAndTenant.mockResolvedValueOnce(mockChange({ status: 'in_progress' }));
      mockChangeRepo.updateStatus.mockResolvedValueOnce(mockChange({ status: 'completed' }));
      mockTimelineRepo.create.mockResolvedValueOnce(mockTimeline());

      await service.updateStatus('chg-1', 'completed', TENANT, 'user-2');

      expect(mockChangeRepo.updateStatus).toHaveBeenCalledWith(
        'chg-1', 'completed', TENANT,
        expect.objectContaining({ actualEnd: expect.any(String) })
      );
    });

    it('should allow completed -> closed', async () => {
      mockChangeRepo.findByIdAndTenant.mockResolvedValueOnce(mockChange({ status: 'completed' }));
      mockChangeRepo.updateStatus.mockResolvedValueOnce(mockChange({ status: 'closed' }));
      mockTimelineRepo.create.mockResolvedValueOnce(mockTimeline());

      const result = await service.updateStatus('chg-1', 'closed', TENANT, 'user-1');

      expect(result.status).toBe('closed');
    });

    it('should reject closed -> anything', async () => {
      mockChangeRepo.findByIdAndTenant.mockResolvedValueOnce(mockChange({ status: 'closed' }));

      await expect(service.updateStatus('chg-1', 'draft', TENANT, 'user-1')).rejects.toThrow('Invalid status transition');
    });

    it('should reject invalid transition', async () => {
      mockChangeRepo.findByIdAndTenant.mockResolvedValueOnce(mockChange({ status: 'draft' }));

      await expect(service.updateStatus('chg-1', 'completed', TENANT, 'user-1')).rejects.toThrow('Invalid status transition');
    });

    it('should auto-create timeline event on status change', async () => {
      mockChangeRepo.findByIdAndTenant.mockResolvedValueOnce(mockChange({ status: 'draft' }));
      mockChangeRepo.updateStatus.mockResolvedValueOnce(mockChange({ status: 'submitted' }));
      mockTimelineRepo.create.mockResolvedValueOnce(mockTimeline());

      await service.updateStatus('chg-1', 'submitted', TENANT, 'user-1');

      expect(mockTimelineRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'status_change',
          description: expect.stringContaining('draft'),
        })
      );
    });

    it('should include reason in timeline event', async () => {
      mockChangeRepo.findByIdAndTenant.mockResolvedValueOnce(mockChange({ status: 'submitted' }));
      mockChangeRepo.updateStatus.mockResolvedValueOnce(mockChange({ status: 'rejected' }));
      mockTimelineRepo.create.mockResolvedValueOnce(mockTimeline());

      await service.updateStatus('chg-1', 'rejected', TENANT, 'user-3', 'Missing tests');

      expect(mockTimelineRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          description: expect.stringContaining('Missing tests'),
        })
      );
    });
  });

  // ==================== Timeline ====================

  describe('getTimeline', () => {
    it('should return timeline events', async () => {
      mockTimelineRepo.findByChangeId.mockResolvedValueOnce([mockTimeline()]);

      const result = await service.getTimeline('chg-1', TENANT);

      expect(result).toHaveLength(1);
    });
  });

  describe('addTimelineEvent', () => {
    it('should create timeline event', async () => {
      mockTimelineRepo.create.mockResolvedValueOnce(mockTimeline());

      const result = await service.addTimelineEvent('chg-1', 'comment', 'Test comment', TENANT, 'user-1');

      expect(result.id).toBe('tl-1');
      expect(mockTimelineRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'comment',
          description: 'Test comment',
          createdBy: 'user-1',
        })
      );
    });
  });

  // ==================== RFC Management ====================

  describe('createRFC', () => {
    it('should create RFC and add timeline event', async () => {
      mockChangeRepo.findByIdAndTenant.mockResolvedValueOnce(mockChange());
      mockRfcRepo.create.mockResolvedValueOnce(mockRFC());
      mockTimelineRepo.create.mockResolvedValueOnce(mockTimeline());

      const result = await service.createRFC({
        changeRequestId: 'chg-1',
        rfcNumber: 'RFC-2026-001',
      }, TENANT);

      expect(result.id).toBe('rfc-1');
      expect(mockTimelineRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'comment',
          description: expect.stringContaining('RFC-2026-001'),
        })
      );
    });

    it('should throw when change request not found', async () => {
      mockChangeRepo.findByIdAndTenant.mockResolvedValueOnce(undefined);

      await expect(service.createRFC({
        changeRequestId: 'chg-x',
        rfcNumber: 'RFC-001',
      }, TENANT)).rejects.toThrow('Change request not found');
    });

    it('should throw when changeRequestId missing', async () => {
      await expect(service.createRFC({
        changeRequestId: '',
        rfcNumber: 'RFC-001',
      }, TENANT)).rejects.toThrow('changeRequestId and rfcNumber are required');
    });
  });

  describe('getRFC', () => {
    it('should return RFC when found', async () => {
      mockRfcRepo.findByIdAndTenant.mockResolvedValueOnce(mockRFC());

      const result = await service.getRFC('rfc-1', TENANT);

      expect(result.id).toBe('rfc-1');
    });

    it('should throw when not found', async () => {
      mockRfcRepo.findByIdAndTenant.mockResolvedValueOnce(undefined);

      await expect(service.getRFC('rfc-x', TENANT)).rejects.toThrow('RFC not found');
    });
  });

  describe('listRFCsByChange', () => {
    it('should return RFCs for change request', async () => {
      mockRfcRepo.findByChangeId.mockResolvedValueOnce([mockRFC()]);

      const result = await service.listRFCsByChange('chg-1');

      expect(result).toHaveLength(1);
    });
  });

  describe('listRFCs', () => {
    it('should return RFCs with total', async () => {
      mockRfcRepo.findByTenant.mockResolvedValueOnce({ entities: [mockRFC()], total: 1 });

      const result = await service.listRFCs(TENANT);

      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
    });
  });

  describe('updateRFC', () => {
    it('should update RFC fields', async () => {
      mockRfcRepo.findByIdAndTenant.mockResolvedValueOnce(mockRFC());
      mockRfcRepo.update.mockResolvedValueOnce(mockRFC({ justification: 'Updated' }));

      const result = await service.updateRFC('rfc-1', { justification: 'Updated' }, TENANT);

      expect(result.justification).toBe('Updated');
    });

    it('should return existing when no changes', async () => {
      const existing = mockRFC();
      mockRfcRepo.findByIdAndTenant.mockResolvedValueOnce(existing);

      const result = await service.updateRFC('rfc-1', {}, TENANT);

      expect(result).toEqual(existing);
    });

    it('should throw when not found', async () => {
      mockRfcRepo.findByIdAndTenant.mockResolvedValueOnce(undefined);

      await expect(service.updateRFC('rfc-x', { justification: 'x' }, TENANT)).rejects.toThrow('RFC not found');
    });
  });

  describe('updateRFCStatus', () => {
    it('should update status and add timeline event', async () => {
      mockRfcRepo.findByIdAndTenant.mockResolvedValueOnce(mockRFC());
      mockRfcRepo.updateStatus.mockResolvedValueOnce(mockRFC({ status: 'approved' }));
      mockTimelineRepo.create.mockResolvedValueOnce(mockTimeline());

      const result = await service.updateRFCStatus('rfc-1', 'approved', TENANT, 'user-3');

      expect(result.status).toBe('approved');
      expect(mockTimelineRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'approval',
          description: expect.stringContaining('approved'),
        })
      );
    });

    it('should throw when not found', async () => {
      mockRfcRepo.findByIdAndTenant.mockResolvedValueOnce(undefined);

      await expect(service.updateRFCStatus('rfc-x', 'approved', TENANT, 'user-1')).rejects.toThrow('RFC not found');
    });

    it('should throw when update returns null', async () => {
      mockRfcRepo.findByIdAndTenant.mockResolvedValueOnce(mockRFC());
      mockRfcRepo.updateStatus.mockResolvedValueOnce(null);

      await expect(service.updateRFCStatus('rfc-1', 'approved', TENANT, 'user-1')).rejects.toThrow('Failed to update RFC status');
    });
  });

  // ==================== CAB Meeting Management ====================

  describe('createCABMeeting', () => {
    it('should create meeting', async () => {
      mockCabRepo.create.mockResolvedValueOnce(mockMeeting());

      const result = await service.createCABMeeting({
        title: 'Weekly CAB',
        scheduledAt: '2026-07-01T10:00:00Z',
      }, TENANT);

      expect(result.id).toBe('cab-1');
      expect(mockCabRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Weekly CAB',
          status: 'scheduled',
          decisions: [],
        })
      );
    });

    it('should throw when title missing', async () => {
      await expect(service.createCABMeeting({
        title: '',
        scheduledAt: '2026-07-01',
      }, TENANT)).rejects.toThrow('title and scheduledAt are required');
    });

    it('should throw when scheduledAt missing', async () => {
      await expect(service.createCABMeeting({
        title: 'CAB',
        scheduledAt: '',
      }, TENANT)).rejects.toThrow('title and scheduledAt are required');
    });
  });

  describe('getCABMeeting', () => {
    it('should return meeting when found', async () => {
      mockCabRepo.findByIdAndTenant.mockResolvedValueOnce(mockMeeting());

      const result = await service.getCABMeeting('cab-1', TENANT);

      expect(result.id).toBe('cab-1');
    });

    it('should throw when not found', async () => {
      mockCabRepo.findByIdAndTenant.mockResolvedValueOnce(undefined);

      await expect(service.getCABMeeting('cab-x', TENANT)).rejects.toThrow('CAB meeting not found');
    });
  });

  describe('listCABMeetings', () => {
    it('should return meetings with total', async () => {
      mockCabRepo.findByTenant.mockResolvedValueOnce({ entities: [mockMeeting()], total: 1 });

      const result = await service.listCABMeetings(TENANT);

      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
    });
  });

  describe('updateCABMeeting', () => {
    it('should update meeting fields', async () => {
      mockCabRepo.findByIdAndTenant.mockResolvedValueOnce(mockMeeting());
      mockCabRepo.update.mockResolvedValueOnce(mockMeeting({ title: 'Updated' }));

      const result = await service.updateCABMeeting('cab-1', { title: 'Updated' }, TENANT);

      expect(result.title).toBe('Updated');
    });

    it('should return existing when no changes', async () => {
      const existing = mockMeeting();
      mockCabRepo.findByIdAndTenant.mockResolvedValueOnce(existing);

      const result = await service.updateCABMeeting('cab-1', {}, TENANT);

      expect(result).toEqual(existing);
    });

    it('should throw when not found', async () => {
      mockCabRepo.findByIdAndTenant.mockResolvedValueOnce(undefined);

      await expect(service.updateCABMeeting('cab-x', { title: 'x' }, TENANT)).rejects.toThrow('CAB meeting not found');
    });
  });

  describe('addCABDecision', () => {
    it('should add decision and create timeline event', async () => {
      mockCabRepo.findByIdAndTenant.mockResolvedValueOnce(mockMeeting());
      mockCabRepo.addDecision.mockResolvedValueOnce(mockMeeting({ decisions: [{ changeRequestId: 'chg-1', decision: 'approved' }] }));
      mockTimelineRepo.create.mockResolvedValueOnce(mockTimeline());

      const result = await service.addCABDecision('cab-1', {
        changeRequestId: 'chg-1',
        decision: 'approved',
        notes: 'LGTM',
      }, TENANT);

      expect(result.decisions).toHaveLength(1);
      expect(mockTimelineRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'approval',
          description: expect.stringContaining('approved'),
        })
      );
    });

    it('should throw when meeting not found', async () => {
      mockCabRepo.findByIdAndTenant.mockResolvedValueOnce(undefined);

      await expect(service.addCABDecision('cab-x', { changeRequestId: 'chg-1', decision: 'approved' }, TENANT)).rejects.toThrow('CAB meeting not found');
    });

    it('should throw when addDecision returns null', async () => {
      mockCabRepo.findByIdAndTenant.mockResolvedValueOnce(mockMeeting());
      mockCabRepo.addDecision.mockResolvedValueOnce(null);

      await expect(service.addCABDecision('cab-1', { changeRequestId: 'chg-1', decision: 'approved' }, TENANT)).rejects.toThrow('Failed to add CAB decision');
    });
  });

  // ==================== getStats ====================

  describe('getStats', () => {
    it('should return stats from repository', async () => {
      mockChangeRepo.getStats.mockResolvedValueOnce({
        total: 10,
        byStatus: { draft: 5, approved: 5 },
        byType: { normal: 8, emergency: 2 },
        byPriority: { high: 3, medium: 7 },
      });

      const result = await service.getStats(TENANT);

      expect(result.total).toBe(10);
      expect(result.byStatus).toEqual({ draft: 5, approved: 5 });
    });
  });

  // ==================== computeRiskLevel ====================

  describe('computeRiskLevel', () => {
    it('should compute emergency + high = high', () => {
      expect(service.computeRiskLevel('emergency', 'high')).toBe('high');
    });

    it('should compute emergency + medium = high', () => {
      expect(service.computeRiskLevel('emergency', 'medium')).toBe('high');
    });

    it('should compute emergency + low = medium', () => {
      expect(service.computeRiskLevel('emergency', 'low')).toBe('medium');
    });

    it('should compute normal + high = high', () => {
      expect(service.computeRiskLevel('normal', 'high')).toBe('high');
    });

    it('should compute normal + medium = medium', () => {
      expect(service.computeRiskLevel('normal', 'medium')).toBe('medium');
    });

    it('should compute normal + low = low', () => {
      expect(service.computeRiskLevel('normal', 'low')).toBe('low');
    });

    it('should compute standard + high = medium', () => {
      expect(service.computeRiskLevel('standard', 'high')).toBe('medium');
    });

    it('should compute standard + medium = low', () => {
      expect(service.computeRiskLevel('standard', 'medium')).toBe('low');
    });

    it('should compute standard + low = low', () => {
      expect(service.computeRiskLevel('standard', 'low')).toBe('low');
    });

    it('should default unknown type to standard', () => {
      expect(service.computeRiskLevel('unknown', 'high')).toBe('medium');
    });

    it('should default unknown impact to low', () => {
      expect(service.computeRiskLevel('normal', 'unknown')).toBe('low');
    });
  });
});
